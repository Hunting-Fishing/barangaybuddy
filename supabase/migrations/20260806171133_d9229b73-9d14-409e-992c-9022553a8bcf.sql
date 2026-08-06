SELECT cron.alter_job(1, command := $$
  SELECT net.http_post(
    url := 'https://project--be26f2e6-75d8-4129-a0d9-8a96d4b5652e.lovable.app/api/public/hooks/fuel-sync',
    headers := '{"Content-Type":"application/json","x-sync-secret":"b7d741b5e836932c9593b7512f0237f7b17875868ded5015b363cb1a40cc21aa"}'::jsonb,
    body := '{}'::jsonb
  );
$$);
SELECT cron.alter_job(2, command := $$
  SELECT net.http_post(
    url := 'https://project--be26f2e6-75d8-4129-a0d9-8a96d4b5652e.lovable.app/api/public/hooks/fuel-sync',
    headers := '{"Content-Type":"application/json","x-sync-secret":"b7d741b5e836932c9593b7512f0237f7b17875868ded5015b363cb1a40cc21aa"}'::jsonb,
    body := '{}'::jsonb
  );
$$);
SELECT cron.alter_job(3, command := $$
  SELECT net.http_post(
    url := 'https://project--be26f2e6-75d8-4129-a0d9-8a96d4b5652e.lovable.app/api/public/hooks/fuel-stations-sync',
    headers := '{"Content-Type":"application/json","x-sync-secret":"b7d741b5e836932c9593b7512f0237f7b17875868ded5015b363cb1a40cc21aa"}'::jsonb,
    body := '{}'::jsonb
  );
$$);
SELECT cron.alter_job(4, command := $$
  SELECT net.http_post(
    url := 'https://project--be26f2e6-75d8-4129-a0d9-8a96d4b5652e.lovable.app/api/public/hooks/business-osm-sync',
    headers := '{"Content-Type":"application/json","x-sync-secret":"b7d741b5e836932c9593b7512f0237f7b17875868ded5015b363cb1a40cc21aa"}'::jsonb,
    body := '{}'::jsonb
  );
$$);