-- Barangay Buddy Jeepney Mobility Platform
-- External/vendor telematics gateway foundation.
--
-- Purpose:
-- - accept normalized telemetry from cooperative/vendor servers, TCP/UDP protocol
--   decoders or OEM telematics integrations;
-- - authenticate the GATEWAY, not expose a Barangay Buddy per-device secret to the
--   upstream vendor;
-- - map the upstream vendor's vehicle identifier to the authoritative physical
--   jeepney vehicle in Barangay Buddy;
-- - keep active trip + route variant authoritative for public rider telemetry.

CREATE TABLE public.jeepney_telematics_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  name text NOT NULL,
  provider text NOT NULL,
  operator_id uuid REFERENCES public.jeepney_operators(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'retired')),
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX jeepney_telematics_gateways_operator_idx
  ON public.jeepney_telematics_gateways (operator_id, status);

GRANT ALL ON public.jeepney_telematics_gateways TO service_role;
ALTER TABLE public.jeepney_telematics_gateways ENABLE ROW LEVEL SECURITY;

-- Operator-scoped gateways may be listed by their own operator for integration
-- status. Credentials/hashes are never selectable by browser roles.
GRANT SELECT (id, public_id, name, provider, operator_id, status, last_seen_at, created_at, updated_at)
  ON public.jeepney_telematics_gateways TO authenticated;
CREATE POLICY "Operators view own telematics gateways"
ON public.jeepney_telematics_gateways FOR SELECT TO authenticated
USING (
  operator_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.jeepney_operators o
    WHERE o.id = jeepney_telematics_gateways.operator_id
      AND o.user_id = auth.uid()
  )
);

CREATE TRIGGER jeepney_telematics_gateways_touch
BEFORE UPDATE ON public.jeepney_telematics_gateways
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.jeepney_external_vehicle_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_id uuid NOT NULL REFERENCES public.jeepney_telematics_gateways(id) ON DELETE CASCADE,
  external_vehicle_id text NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES public.jeepney_vehicles(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gateway_id, external_vehicle_id),
  UNIQUE (gateway_id, vehicle_id)
);

CREATE INDEX jeepney_external_vehicle_mappings_vehicle_idx
  ON public.jeepney_external_vehicle_mappings (vehicle_id, active);

GRANT ALL ON public.jeepney_external_vehicle_mappings TO service_role;
GRANT SELECT ON public.jeepney_external_vehicle_mappings TO authenticated;
ALTER TABLE public.jeepney_external_vehicle_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators view own external vehicle mappings"
ON public.jeepney_external_vehicle_mappings FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.jeepney_telematics_gateways g
    JOIN public.jeepney_operators o ON o.id = g.operator_id
    WHERE g.id = jeepney_external_vehicle_mappings.gateway_id
      AND o.user_id = auth.uid()
  )
);

CREATE TRIGGER jeepney_external_vehicle_mappings_touch
BEFORE UPDATE ON public.jeepney_external_vehicle_mappings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Enforce a scoped cooperative gateway cannot map another cooperative's vehicle.
CREATE OR REPLACE FUNCTION private.jeepney_guard_external_vehicle_mapping()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  gateway_operator uuid;
  vehicle_operator uuid;
BEGIN
  SELECT g.operator_id INTO gateway_operator
  FROM public.jeepney_telematics_gateways g
  WHERE g.id = NEW.gateway_id;

  SELECT v.operator_id INTO vehicle_operator
  FROM public.jeepney_vehicles v
  WHERE v.id = NEW.vehicle_id;

  IF vehicle_operator IS NULL THEN
    RAISE EXCEPTION 'Mapped fleet vehicle has no owning operator'
      USING ERRCODE = '23514';
  END IF;

  IF gateway_operator IS NOT NULL AND gateway_operator <> vehicle_operator THEN
    RAISE EXCEPTION 'Operator-scoped telematics gateway cannot map another operator vehicle'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.jeepney_guard_external_vehicle_mapping() FROM PUBLIC;

DROP TRIGGER IF EXISTS jeepney_external_vehicle_mappings_guard ON public.jeepney_external_vehicle_mappings;
CREATE TRIGGER jeepney_external_vehicle_mappings_guard
BEFORE INSERT OR UPDATE OF gateway_id, vehicle_id ON public.jeepney_external_vehicle_mappings
FOR EACH ROW EXECUTE FUNCTION private.jeepney_guard_external_vehicle_mapping();

CREATE TABLE public.jeepney_gateway_ingest_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_id uuid NOT NULL REFERENCES public.jeepney_telematics_gateways(id) ON DELETE CASCADE,
  external_vehicle_id text NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES public.jeepney_vehicles(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.jeepney_trips(id) ON DELETE SET NULL,
  route_id uuid REFERENCES public.jeepney_routes(id) ON DELETE SET NULL,
  route_variant_id uuid REFERENCES public.jeepney_route_variants(id) ON DELETE SET NULL,
  position_id uuid REFERENCES public.jeepney_positions(id) ON DELETE SET NULL,
  sequence_key text,
  device_recorded_at timestamptz,
  server_received_at timestamptz NOT NULL DEFAULT now(),
  event_type text,
  accuracy_m numeric,
  raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX jeepney_gateway_ingest_sequence_unique_idx
  ON public.jeepney_gateway_ingest_receipts (gateway_id, external_vehicle_id, sequence_key)
  WHERE sequence_key IS NOT NULL;
CREATE INDEX jeepney_gateway_ingest_vehicle_time_idx
  ON public.jeepney_gateway_ingest_receipts (vehicle_id, server_received_at DESC);
CREATE INDEX jeepney_gateway_ingest_gateway_time_idx
  ON public.jeepney_gateway_ingest_receipts (gateway_id, server_received_at DESC);

GRANT ALL ON public.jeepney_gateway_ingest_receipts TO service_role;
ALTER TABLE public.jeepney_gateway_ingest_receipts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.jeepney_telematics_gateways IS
  'Authenticated upstream cooperative/vendor/OEM telemetry sources. Raw gateway secrets are never stored.';
COMMENT ON TABLE public.jeepney_external_vehicle_mappings IS
  'Maps an upstream vendor vehicle identifier to the authoritative Barangay Buddy physical fleet vehicle.';
COMMENT ON TABLE public.jeepney_gateway_ingest_receipts IS
  'Private idempotency/audit receipts for normalized telemetry accepted from external gateways.';
