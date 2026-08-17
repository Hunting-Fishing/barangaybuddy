-- Barangay Buddy Jeepney Mobility Platform
-- Authenticated telemetry burst protection.
--
-- Normal moving trackers report roughly every 10-15 seconds. The default ceiling
-- of 300 requests/minute per physical source (~5/sec) intentionally leaves large
-- headroom for buffered reconnect/replay while containing runaway firmware or a
-- misconfigured upstream adapter before it can hammer the ingest/database layer.

CREATE TABLE IF NOT EXISTS public.jeepney_telematics_rate_windows (
  source_key text NOT NULL CHECK (char_length(source_key) BETWEEN 1 AND 320),
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_key, window_start)
);

CREATE INDEX IF NOT EXISTS jeepney_telematics_rate_windows_time_idx
  ON public.jeepney_telematics_rate_windows (window_start DESC);

ALTER TABLE public.jeepney_telematics_rate_windows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jeepney_telematics_rate_windows FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.jeepney_telematics_rate_windows TO service_role;

CREATE OR REPLACE FUNCTION public.jeepney_take_telematics_rate_slot(
  p_source_key text,
  p_limit integer DEFAULT 300
)
RETURNS TABLE (
  allowed boolean,
  request_count integer,
  request_limit integer,
  window_start timestamptz,
  retry_after_seconds integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_source_key text := btrim(COALESCE(p_source_key, ''));
  v_window_start timestamptz := date_trunc('minute', clock_timestamp());
  v_count integer;
  v_retry_after integer;
BEGIN
  IF char_length(v_source_key) < 1 OR char_length(v_source_key) > 320 THEN
    RAISE EXCEPTION 'Telemetry rate-limit source key is invalid'
      USING ERRCODE = '22023';
  END IF;

  IF p_limit < 1 OR p_limit > 10000 THEN
    RAISE EXCEPTION 'Telemetry rate limit is out of range'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.jeepney_telematics_rate_windows (
    source_key,
    window_start,
    request_count,
    updated_at
  ) VALUES (
    v_source_key,
    v_window_start,
    1,
    clock_timestamp()
  )
  ON CONFLICT (source_key, window_start)
  DO UPDATE SET
    request_count = jeepney_telematics_rate_windows.request_count + 1,
    updated_at = clock_timestamp()
  RETURNING jeepney_telematics_rate_windows.request_count
  INTO v_count;

  v_retry_after := GREATEST(
    1,
    CEIL(EXTRACT(EPOCH FROM ((v_window_start + interval '1 minute') - clock_timestamp())))::integer
  );

  -- Opportunistic low-cost cleanup. At roughly one run per 256 accepted checks,
  -- old one-minute buckets are removed without requiring a separate scheduler.
  IF (floor(random() * 256))::integer = 0 THEN
    DELETE FROM public.jeepney_telematics_rate_windows
    WHERE window_start < clock_timestamp() - interval '1 day';
  END IF;

  RETURN QUERY
  SELECT
    v_count <= p_limit,
    v_count,
    p_limit,
    v_window_start,
    CASE WHEN v_count <= p_limit THEN 0 ELSE v_retry_after END;
END;
$$;

REVOKE ALL ON FUNCTION public.jeepney_take_telematics_rate_slot(text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jeepney_take_telematics_rate_slot(text, integer)
  TO service_role;

COMMENT ON FUNCTION public.jeepney_take_telematics_rate_slot(text, integer) IS
  'Service-role-only fixed-minute telemetry burst limiter. Default 300 authenticated requests/minute per caller-supplied physical-source key.';
