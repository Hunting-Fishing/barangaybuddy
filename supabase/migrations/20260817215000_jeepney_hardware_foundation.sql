-- Barangay Buddy Jeepney Mobility Platform
-- Hardware foundation: secure device identities, vehicle installation assignments,
-- and restricted ingest receipts/health metadata.
--
-- Trackers must post through the server-side telemetry gateway. They never receive
-- Supabase service-role credentials and never write directly to public tables.

CREATE TABLE public.jeepney_gps_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.jeepney_operators(id) ON DELETE CASCADE,
  public_id text NOT NULL UNIQUE DEFAULT ('bbgps_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20)),
  imei text UNIQUE,
  manufacturer text,
  model text,
  firmware_version text,
  token_hash text NOT NULL,
  sim_iccid text,
  status text NOT NULL DEFAULT 'provisioned'
    CHECK (status IN ('provisioned', 'active', 'suspended', 'retired')),
  last_seen_at timestamptz,
  last_latitude numeric,
  last_longitude numeric,
  last_speed_kph numeric,
  last_heading numeric,
  last_accuracy_m numeric,
  ignition_on boolean,
  external_voltage_v numeric,
  backup_battery_pct numeric CHECK (backup_battery_pct IS NULL OR (backup_battery_pct >= 0 AND backup_battery_pct <= 100)),
  signal_dbm numeric,
  last_event_type text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX jeepney_gps_devices_operator_idx
  ON public.jeepney_gps_devices (operator_id, status);
CREATE INDEX jeepney_gps_devices_last_seen_idx
  ON public.jeepney_gps_devices (last_seen_at DESC);

GRANT SELECT ON public.jeepney_gps_devices TO authenticated;
GRANT ALL ON public.jeepney_gps_devices TO service_role;
ALTER TABLE public.jeepney_gps_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators read their own GPS devices"
ON public.jeepney_gps_devices FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.jeepney_operators o
    WHERE o.id = jeepney_gps_devices.operator_id
      AND o.user_id = auth.uid()
  )
);

CREATE TRIGGER jeepney_gps_devices_touch
BEFORE UPDATE ON public.jeepney_gps_devices
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.jeepney_device_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.jeepney_gps_devices(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.jeepney_vehicles(id) ON DELETE CASCADE,
  installed_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  installation_note text,
  installation_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (removed_at IS NULL OR removed_at >= installed_at)
);

-- One live installation per physical tracker and per vehicle.
CREATE UNIQUE INDEX jeepney_device_assignments_active_device_idx
  ON public.jeepney_device_assignments (device_id)
  WHERE removed_at IS NULL;
CREATE UNIQUE INDEX jeepney_device_assignments_active_vehicle_idx
  ON public.jeepney_device_assignments (vehicle_id)
  WHERE removed_at IS NULL;
CREATE INDEX jeepney_device_assignments_vehicle_idx
  ON public.jeepney_device_assignments (vehicle_id, installed_at DESC);

GRANT SELECT ON public.jeepney_device_assignments TO authenticated;
GRANT ALL ON public.jeepney_device_assignments TO service_role;
ALTER TABLE public.jeepney_device_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators read their own device assignments"
ON public.jeepney_device_assignments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.jeepney_gps_devices d
    JOIN public.jeepney_operators o ON o.id = d.operator_id
    WHERE d.id = jeepney_device_assignments.device_id
      AND o.user_id = auth.uid()
  )
);

-- Restricted mapping between a public rider-position row and the physical device
-- that produced it. Keeping this separate prevents raw device identifiers/health
-- data from becoming public through the existing jeepney_positions SELECT policy.
CREATE TABLE public.jeepney_device_ingest_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.jeepney_gps_devices(id) ON DELETE CASCADE,
  position_id uuid REFERENCES public.jeepney_positions(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.jeepney_vehicles(id) ON DELETE SET NULL,
  route_id uuid REFERENCES public.jeepney_routes(id) ON DELETE SET NULL,
  sequence_key text,
  device_recorded_at timestamptz,
  server_received_at timestamptz NOT NULL DEFAULT now(),
  accuracy_m numeric,
  altitude_m numeric,
  event_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX jeepney_device_ingest_sequence_idx
  ON public.jeepney_device_ingest_receipts (device_id, sequence_key)
  WHERE sequence_key IS NOT NULL;
CREATE INDEX jeepney_device_ingest_device_time_idx
  ON public.jeepney_device_ingest_receipts (device_id, server_received_at DESC);
CREATE INDEX jeepney_device_ingest_position_idx
  ON public.jeepney_device_ingest_receipts (position_id)
  WHERE position_id IS NOT NULL;

GRANT SELECT ON public.jeepney_device_ingest_receipts TO authenticated;
GRANT ALL ON public.jeepney_device_ingest_receipts TO service_role;
ALTER TABLE public.jeepney_device_ingest_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators read their own device ingest receipts"
ON public.jeepney_device_ingest_receipts FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.jeepney_gps_devices d
    JOIN public.jeepney_operators o ON o.id = d.operator_id
    WHERE d.id = jeepney_device_ingest_receipts.device_id
      AND o.user_id = auth.uid()
  )
);

COMMENT ON TABLE public.jeepney_gps_devices IS
  'Server-provisioned physical GPS/GNSS devices. token_hash stores only the SHA-256 hash of the device secret.';
COMMENT ON TABLE public.jeepney_device_assignments IS
  'Installation history tying a physical GPS device to a fleet vehicle without permanently tying the vehicle to a route.';
COMMENT ON TABLE public.jeepney_device_ingest_receipts IS
  'Restricted audit/health metadata for hardware telemetry accepted by the server-side ingest gateway.';
