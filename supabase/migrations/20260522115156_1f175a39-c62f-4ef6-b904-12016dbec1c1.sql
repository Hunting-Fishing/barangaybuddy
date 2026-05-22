CREATE UNIQUE INDEX IF NOT EXISTS businesses_import_source_unique
ON public.businesses (imported_from, import_source_id)
WHERE imported_from IS NOT NULL AND import_source_id IS NOT NULL;