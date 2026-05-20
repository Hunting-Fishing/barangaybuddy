-- Extend business_type enum with more Philippine-context categories
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'sari_sari';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'market_vendor';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'wet_market';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'dry_goods';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'farmer';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'fisher';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'ambulant_vendor';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'bakery';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'pharmacy';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'hardware';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'repair_shop';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'salon';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'laundry';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'transport';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'agri_supply';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'livestock';

-- Additional types so a single place can be in multiple categories
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS additional_types public.business_type[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_businesses_additional_types
  ON public.businesses USING GIN (additional_types);