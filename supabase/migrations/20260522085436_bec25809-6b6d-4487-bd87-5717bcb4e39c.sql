-- Weekly OSM station sync (Sundays 03:00 PHT = 19:00 UTC Saturday)
SELECT cron.schedule(
  'fuel-stations-osm-weekly',
  '0 19 * * 6',
  $$
  SELECT net.http_post(
    url := 'https://project--be26f2e6-75d8-4129-a0d9-8a96d4b5652e.lovable.app/api/public/hooks/fuel-stations-sync',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0d2Zwb2d4cGZpbXlpbWRleHFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNjAzMzUsImV4cCI6MjA5MzkzNjMzNX0.wAVAr9vvzKmd2XeXMIMIMyOOV19cktXwEOjXGoWJuoQ"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);