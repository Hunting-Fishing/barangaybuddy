CREATE TYPE public.delivery_rider_status AS ENUM ('pending','approved','rejected','suspended');
CREATE TYPE public.delivery_job_status AS ENUM ('open','accepted','picked_up','delivered','cancelled');
CREATE TYPE public.delivery_service_type AS ENUM ('parcel','food','grocery','laundry','medication','auto_parts','agriculture','airport');
CREATE TYPE public.delivery_payment_method AS ENUM ('cash','online');
CREATE TYPE public.delivery_sub_status AS ENUM ('trialing','active','past_due','cancelled');

CREATE OR REPLACE FUNCTION private.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin');
$$;
REVOKE EXECUTE ON FUNCTION private.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO authenticated, service_role;

-- Riders -------------------------------------------------------------
CREATE TABLE public.delivery_riders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  vehicle_type text NOT NULL DEFAULT 'motorcycle',
  plate_number text,
  licence_number text,
  city_code text REFERENCES public.cities_municipalities(code),
  barangay_code text REFERENCES public.barangays(code),
  service_notes text,
  status public.delivery_rider_status NOT NULL DEFAULT 'pending',
  branding_agreed boolean NOT NULL DEFAULT false,
  vehicle_photo_path text,
  uniform_photo_path text,
  is_online boolean NOT NULL DEFAULT false,
  last_online_at timestamptz,
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  rating_avg numeric,
  rating_count integer NOT NULL DEFAULT 0,
  jobs_completed integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.delivery_riders TO authenticated;
GRANT SELECT ON public.delivery_riders TO anon;
GRANT ALL ON public.delivery_riders TO service_role;
ALTER TABLE public.delivery_riders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved riders are public" ON public.delivery_riders FOR SELECT USING (status = 'approved');
CREATE POLICY "Riders read own application" ON public.delivery_riders FOR SELECT TO authenticated USING (auth.uid() = user_id OR private.is_admin(auth.uid()));
CREATE POLICY "Riders apply for themselves" ON public.delivery_riders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Riders edit own profile" ON public.delivery_riders FOR UPDATE TO authenticated USING (auth.uid() = user_id OR private.is_admin(auth.uid())) WITH CHECK (auth.uid() = user_id OR private.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION private.delivery_rider_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.review_note := NULL;
    NEW.rating_avg := NULL;
    NEW.rating_count := 0;
    NEW.jobs_completed := 0;
    NEW.is_online := false;
    RETURN NEW;
  END IF;
  IF NOT private.is_admin(auth.uid()) THEN
    NEW.status := OLD.status;
    NEW.reviewed_by := OLD.reviewed_by;
    NEW.reviewed_at := OLD.reviewed_at;
    NEW.review_note := OLD.review_note;
    NEW.rating_avg := OLD.rating_avg;
    NEW.rating_count := OLD.rating_count;
    NEW.jobs_completed := OLD.jobs_completed;
    IF NEW.is_online AND OLD.status <> 'approved' THEN
      NEW.is_online := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.delivery_rider_guard() FROM PUBLIC;
CREATE TRIGGER delivery_riders_guard BEFORE INSERT OR UPDATE ON public.delivery_riders FOR EACH ROW EXECUTE FUNCTION private.delivery_rider_guard();
CREATE TRIGGER delivery_riders_touch BEFORE UPDATE ON public.delivery_riders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.delivery_rider_contacts (
  rider_id uuid PRIMARY KEY REFERENCES public.delivery_riders(id) ON DELETE CASCADE,
  contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.delivery_rider_contacts TO authenticated;
GRANT ALL ON public.delivery_rider_contacts TO service_role;
ALTER TABLE public.delivery_rider_contacts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER delivery_rider_contacts_touch BEFORE UPDATE ON public.delivery_rider_contacts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Subscriptions ------------------------------------------------------
CREATE TABLE public.delivery_rider_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES public.delivery_riders(id) ON DELETE CASCADE,
  status public.delivery_sub_status NOT NULL DEFAULT 'active',
  amount_php integer NOT NULL DEFAULT 80,
  current_period_end timestamptz,
  stripe_subscription_id text,
  stripe_customer_id text,
  payment_ref text,
  payment_note text,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.delivery_rider_subscriptions TO authenticated;
GRANT ALL ON public.delivery_rider_subscriptions TO service_role;
ALTER TABLE public.delivery_rider_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Riders read own subscription" ON public.delivery_rider_subscriptions FOR SELECT TO authenticated
  USING (private.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.delivery_riders r WHERE r.id = rider_id AND r.user_id = auth.uid()));
CREATE TRIGGER delivery_rider_subs_touch BEFORE UPDATE ON public.delivery_rider_subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION private.delivery_rider_active(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.delivery_riders r
    JOIN public.delivery_rider_subscriptions s ON s.rider_id = r.id
    WHERE r.user_id = _user_id
      AND r.status = 'approved'
      AND s.status IN ('active','trialing')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  );
$$;
REVOKE EXECUTE ON FUNCTION private.delivery_rider_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.delivery_rider_active(uuid) TO authenticated, service_role;

-- Jobs ---------------------------------------------------------------
CREATE TABLE public.delivery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rider_id uuid REFERENCES public.delivery_riders(id) ON DELETE SET NULL,
  service_type public.delivery_service_type NOT NULL,
  status public.delivery_job_status NOT NULL DEFAULT 'open',
  pickup_address text NOT NULL,
  pickup_lat numeric NOT NULL,
  pickup_lng numeric NOT NULL,
  dropoff_address text NOT NULL,
  dropoff_lat numeric NOT NULL,
  dropoff_lng numeric NOT NULL,
  item_description text,
  item_size text NOT NULL DEFAULT 'small',
  notes text,
  scheduled_for timestamptz,
  distance_km numeric NOT NULL DEFAULT 0,
  base_fare_php integer NOT NULL DEFAULT 0,
  distance_fare_php integer NOT NULL DEFAULT 0,
  total_fare_php integer NOT NULL DEFAULT 0,
  payment_method public.delivery_payment_method NOT NULL DEFAULT 'cash',
  is_prepaid boolean NOT NULL DEFAULT false,
  payment_ref text,
  cancel_reason text,
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_delivery_jobs_status ON public.delivery_jobs(status, created_at DESC);
CREATE INDEX idx_delivery_jobs_customer ON public.delivery_jobs(customer_id, created_at DESC);
CREATE INDEX idx_delivery_jobs_rider ON public.delivery_jobs(rider_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.delivery_jobs TO authenticated;
GRANT ALL ON public.delivery_jobs TO service_role;
ALTER TABLE public.delivery_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers read own jobs" ON public.delivery_jobs FOR SELECT TO authenticated USING (auth.uid() = customer_id OR private.is_admin(auth.uid()));
CREATE POLICY "Riders read open and assigned jobs" ON public.delivery_jobs FOR SELECT TO authenticated
  USING (
    (status = 'open' AND private.delivery_rider_active(auth.uid()))
    OR EXISTS (SELECT 1 FROM public.delivery_riders r WHERE r.id = rider_id AND r.user_id = auth.uid())
  );
CREATE POLICY "Customers create own jobs" ON public.delivery_jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Customers update own jobs" ON public.delivery_jobs FOR UPDATE TO authenticated USING (auth.uid() = customer_id) WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Riders update their jobs" ON public.delivery_jobs FOR UPDATE TO authenticated
  USING (
    (status = 'open' AND private.delivery_rider_active(auth.uid()))
    OR EXISTS (SELECT 1 FROM public.delivery_riders r WHERE r.id = rider_id AND r.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.delivery_riders r WHERE r.id = rider_id AND r.user_id = auth.uid())
  );
CREATE POLICY "Admins manage jobs" ON public.delivery_jobs FOR UPDATE TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
CREATE TRIGGER delivery_jobs_touch BEFORE UPDATE ON public.delivery_jobs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.delivery_job_contacts (
  job_id uuid PRIMARY KEY REFERENCES public.delivery_jobs(id) ON DELETE CASCADE,
  contact_name text,
  contact_phone text,
  recipient_name text,
  recipient_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.delivery_job_contacts TO authenticated;
GRANT ALL ON public.delivery_job_contacts TO service_role;
ALTER TABLE public.delivery_job_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Job parties read contacts" ON public.delivery_job_contacts FOR SELECT TO authenticated
  USING (
    private.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.delivery_jobs j
      LEFT JOIN public.delivery_riders r ON r.id = j.rider_id
      WHERE j.id = job_id AND (j.customer_id = auth.uid() OR r.user_id = auth.uid())
    )
  );
CREATE POLICY "Customers write job contacts" ON public.delivery_job_contacts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_jobs j WHERE j.id = job_id AND j.customer_id = auth.uid()));
CREATE POLICY "Customers edit job contacts" ON public.delivery_job_contacts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.delivery_jobs j WHERE j.id = job_id AND j.customer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_jobs j WHERE j.id = job_id AND j.customer_id = auth.uid()));
CREATE TRIGGER delivery_job_contacts_touch BEFORE UPDATE ON public.delivery_job_contacts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.delivery_job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.delivery_jobs(id) ON DELETE CASCADE,
  status public.delivery_job_status NOT NULL,
  note text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_delivery_job_events_job ON public.delivery_job_events(job_id, created_at);
GRANT SELECT ON public.delivery_job_events TO authenticated;
GRANT ALL ON public.delivery_job_events TO service_role;
ALTER TABLE public.delivery_job_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Job parties read events" ON public.delivery_job_events FOR SELECT TO authenticated
  USING (
    private.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.delivery_jobs j
      LEFT JOIN public.delivery_riders r ON r.id = j.rider_id
      WHERE j.id = job_id AND (j.customer_id = auth.uid() OR r.user_id = auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION private.delivery_job_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_rider boolean;
  is_customer boolean;
  admin boolean;
BEGIN
  admin := private.is_admin(auth.uid());
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'open';
    NEW.rider_id := NULL;
    NEW.is_prepaid := false;
    NEW.payment_ref := NULL;
    NEW.accepted_at := NULL;
    NEW.picked_up_at := NULL;
    NEW.delivered_at := NULL;
    NEW.cancelled_at := NULL;
    RETURN NEW;
  END IF;

  is_customer := OLD.customer_id = auth.uid();
  is_rider := NEW.rider_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.delivery_riders r WHERE r.id = NEW.rider_id AND r.user_id = auth.uid()
  );

  IF NOT admin THEN
    NEW.is_prepaid := OLD.is_prepaid;
    NEW.payment_ref := OLD.payment_ref;
    NEW.customer_id := OLD.customer_id;
    NEW.total_fare_php := OLD.total_fare_php;
    NEW.base_fare_php := OLD.base_fare_php;
    NEW.distance_fare_php := OLD.distance_fare_php;
  END IF;

  IF OLD.status <> NEW.status THEN
    IF NEW.status = 'accepted' THEN
      IF OLD.status <> 'open' OR OLD.rider_id IS NOT NULL THEN
        RAISE EXCEPTION 'This job has already been taken';
      END IF;
      IF NOT is_rider OR NOT private.delivery_rider_active(auth.uid()) THEN
        RAISE EXCEPTION 'Only approved riders with an active membership can accept jobs';
      END IF;
      NEW.accepted_at := now();
    ELSIF NEW.status = 'picked_up' THEN
      IF OLD.status <> 'accepted' OR NOT is_rider THEN
        RAISE EXCEPTION 'Only the assigned rider can mark a pickup';
      END IF;
      NEW.picked_up_at := now();
    ELSIF NEW.status = 'delivered' THEN
      IF OLD.status <> 'picked_up' OR NOT is_rider THEN
        RAISE EXCEPTION 'Only the assigned rider can complete a delivery';
      END IF;
      NEW.delivered_at := now();
    ELSIF NEW.status = 'cancelled' THEN
      IF NOT admin AND NOT (is_customer AND OLD.status IN ('open','accepted')) THEN
        RAISE EXCEPTION 'This job can no longer be cancelled';
      END IF;
      NEW.cancelled_at := now();
    ELSE
      RAISE EXCEPTION 'Invalid job status change';
    END IF;
  ELSE
    IF NOT admin AND OLD.rider_id IS DISTINCT FROM NEW.rider_id THEN
      NEW.rider_id := OLD.rider_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.delivery_job_guard() FROM PUBLIC;
CREATE TRIGGER delivery_jobs_guard BEFORE INSERT OR UPDATE ON public.delivery_jobs FOR EACH ROW EXECUTE FUNCTION private.delivery_job_guard();

CREATE TABLE public.delivery_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL UNIQUE REFERENCES public.delivery_jobs(id) ON DELETE CASCADE,
  rider_id uuid NOT NULL REFERENCES public.delivery_riders(id) ON DELETE CASCADE,
  gross_php integer NOT NULL DEFAULT 0,
  commission_php integer NOT NULL DEFAULT 0,
  rider_php integer NOT NULL DEFAULT 0,
  collected_in_cash boolean NOT NULL DEFAULT true,
  settled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.delivery_payouts TO authenticated;
GRANT ALL ON public.delivery_payouts TO service_role;
ALTER TABLE public.delivery_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Riders read own payouts" ON public.delivery_payouts FOR SELECT TO authenticated
  USING (private.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.delivery_riders r WHERE r.id = rider_id AND r.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION private.delivery_job_after_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  commission integer;
BEGIN
  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.delivery_job_events (job_id, status, actor_id)
    VALUES (NEW.id, NEW.status, auth.uid());
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'delivered' AND OLD.status <> 'delivered' AND NEW.rider_id IS NOT NULL THEN
    commission := GREATEST(0, ROUND(NEW.total_fare_php * 0.15));
    INSERT INTO public.delivery_payouts (job_id, rider_id, gross_php, commission_php, rider_php, collected_in_cash)
    VALUES (NEW.id, NEW.rider_id, NEW.total_fare_php, commission, NEW.total_fare_php - commission, NOT NEW.is_prepaid)
    ON CONFLICT (job_id) DO NOTHING;

    UPDATE public.delivery_riders SET jobs_completed = jobs_completed + 1 WHERE id = NEW.rider_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.delivery_job_after_status() FROM PUBLIC;
CREATE TRIGGER delivery_jobs_after_status AFTER INSERT OR UPDATE ON public.delivery_jobs FOR EACH ROW EXECUTE FUNCTION private.delivery_job_after_status();

-- Live positions -----------------------------------------------------
CREATE TABLE public.delivery_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES public.delivery_riders(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.delivery_jobs(id) ON DELETE SET NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  heading numeric,
  speed_kph numeric,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_delivery_positions_rider ON public.delivery_positions(rider_id, recorded_at DESC);
GRANT SELECT, INSERT ON public.delivery_positions TO authenticated;
GRANT ALL ON public.delivery_positions TO service_role;
ALTER TABLE public.delivery_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Riders post own positions" ON public.delivery_positions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_riders r WHERE r.id = rider_id AND r.user_id = auth.uid() AND r.status = 'approved'));
CREATE POLICY "Rider and active customer read positions" ON public.delivery_positions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.delivery_riders r WHERE r.id = rider_id AND r.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.delivery_jobs j
      WHERE j.rider_id = delivery_positions.rider_id
        AND j.customer_id = auth.uid()
        AND j.status IN ('accepted','picked_up')
    )
  );

-- Ratings ------------------------------------------------------------
CREATE TABLE public.delivery_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL UNIQUE REFERENCES public.delivery_jobs(id) ON DELETE CASCADE,
  rider_id uuid NOT NULL REFERENCES public.delivery_riders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.delivery_ratings TO authenticated;
GRANT SELECT ON public.delivery_ratings TO anon;
GRANT ALL ON public.delivery_ratings TO service_role;
ALTER TABLE public.delivery_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ratings are public" ON public.delivery_ratings FOR SELECT USING (true);
CREATE POLICY "Customers rate own delivered jobs" ON public.delivery_ratings FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = customer_id
    AND EXISTS (
      SELECT 1 FROM public.delivery_jobs j
      WHERE j.id = job_id AND j.customer_id = auth.uid() AND j.rider_id = delivery_ratings.rider_id AND j.status = 'delivered'
    )
  );
CREATE TRIGGER delivery_ratings_check BEFORE INSERT OR UPDATE ON public.delivery_ratings FOR EACH ROW EXECUTE FUNCTION public.validate_rating();

CREATE OR REPLACE FUNCTION private.delivery_sync_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.delivery_riders r
  SET rating_avg = sub.avg_rating, rating_count = sub.total
  FROM (
    SELECT rider_id, ROUND(AVG(rating)::numeric, 2) AS avg_rating, COUNT(*)::int AS total
    FROM public.delivery_ratings WHERE rider_id = NEW.rider_id GROUP BY rider_id
  ) sub
  WHERE r.id = sub.rider_id;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.delivery_sync_rating() FROM PUBLIC;
CREATE TRIGGER delivery_ratings_sync AFTER INSERT ON public.delivery_ratings FOR EACH ROW EXECUTE FUNCTION private.delivery_sync_rating();

-- Rider contact visibility (needs jobs table to exist)
CREATE POLICY "Rider contact self and counterparty" ON public.delivery_rider_contacts FOR SELECT TO authenticated
  USING (
    private.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.delivery_riders r WHERE r.id = rider_id AND r.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.delivery_jobs j
      WHERE j.rider_id = delivery_rider_contacts.rider_id
        AND j.customer_id = auth.uid()
        AND j.status IN ('accepted','picked_up','delivered')
    )
  );
CREATE POLICY "Riders write own contact" ON public.delivery_rider_contacts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_riders r WHERE r.id = rider_id AND r.user_id = auth.uid()));
CREATE POLICY "Riders edit own contact" ON public.delivery_rider_contacts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.delivery_riders r WHERE r.id = rider_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_riders r WHERE r.id = rider_id AND r.user_id = auth.uid()));