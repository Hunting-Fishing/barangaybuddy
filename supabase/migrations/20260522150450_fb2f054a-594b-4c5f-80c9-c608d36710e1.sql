CREATE UNIQUE INDEX IF NOT EXISTS businesses_import_source_full_unique
ON public.businesses (imported_from, import_source_id);