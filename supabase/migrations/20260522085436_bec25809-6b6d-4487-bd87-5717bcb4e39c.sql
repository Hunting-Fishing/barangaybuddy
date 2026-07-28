-- Weekly OSM station sync is configured by the deployment scheduler.
-- Endpoint URLs and authorization headers must come from deployment secrets,
-- not from a database migration. The intended schedule is Saturday 19:00 UTC
-- (Sunday 03:00 Asia/Manila).
do $$ begin raise notice 'Configure fuel-stations-sync in the deployment scheduler'; end $$;
