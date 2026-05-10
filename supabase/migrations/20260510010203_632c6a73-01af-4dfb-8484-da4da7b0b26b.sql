
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('owner','consumer','admin');
CREATE TYPE public.business_type AS ENUM ('store','service','restaurant','food_vendor','fuel_station');
CREATE TYPE public.fuel_type AS ENUM ('gasoline_91','gasoline_95','gasoline_97','diesel');

-- ============ PSGC HIERARCHY ============
CREATE TABLE public.regions (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE public.provinces (
  code TEXT PRIMARY KEY,
  region_code TEXT NOT NULL REFERENCES public.regions(code) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE
);
CREATE INDEX idx_provinces_region ON public.provinces(region_code);

CREATE TABLE public.cities_municipalities (
  code TEXT PRIMARY KEY,
  province_code TEXT NOT NULL REFERENCES public.provinces(code) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_city BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_cities_province ON public.cities_municipalities(province_code);

CREATE TABLE public.barangays (
  code TEXT PRIMARY KEY,
  city_code TEXT NOT NULL REFERENCES public.cities_municipalities(code) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL
);
CREATE INDEX idx_barangays_city ON public.barangays(city_code);
CREATE INDEX idx_barangays_slug ON public.barangays(slug);
CREATE UNIQUE INDEX idx_barangays_city_slug ON public.barangays(city_code, slug);

-- Public read for PSGC
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities_municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barangays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "psgc public read regions" ON public.regions FOR SELECT USING (true);
CREATE POLICY "psgc public read provinces" ON public.provinces FOR SELECT USING (true);
CREATE POLICY "psgc public read cities" ON public.cities_municipalities FOR SELECT USING (true);
CREATE POLICY "psgc public read barangays" ON public.barangays FOR SELECT USING (true);

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'consumer');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ BUSINESSES ============
CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  barangay_code TEXT NOT NULL REFERENCES public.barangays(code),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type public.business_type NOT NULL,
  description TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  cover_image_url TEXT,
  logo_url TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  hours TEXT,
  address TEXT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_businesses_barangay ON public.businesses(barangay_code);
CREATE INDEX idx_businesses_type ON public.businesses(type);
CREATE INDEX idx_businesses_owner ON public.businesses(owner_id);
CREATE INDEX idx_businesses_tags ON public.businesses USING GIN(tags);

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view published businesses" ON public.businesses FOR SELECT USING (is_published = true OR auth.uid() = owner_id);
CREATE POLICY "Owners can insert" ON public.businesses FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update" ON public.businesses FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners can delete" ON public.businesses FOR DELETE USING (auth.uid() = owner_id);

-- ============ LISTINGS ============
CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2),
  unit TEXT,
  category TEXT,
  image_url TEXT,
  in_stock BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_listings_business ON public.listings(business_id);
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view listings" ON public.listings FOR SELECT USING (true);
CREATE POLICY "Owner can manage listings" ON public.listings FOR ALL
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid()));

-- ============ REVIEWS ============
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);
CREATE INDEX idx_reviews_business ON public.reviews(business_id);

CREATE OR REPLACE FUNCTION public.validate_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER reviews_rating_check BEFORE INSERT OR UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.validate_rating();

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Auth users can insert own review" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own review" ON public.reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own review" ON public.reviews FOR DELETE USING (auth.uid() = user_id);

-- ============ FUEL PRICES ============
CREATE TABLE public.fuel_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  fuel_type public.fuel_type NOT NULL,
  price NUMERIC(8,3) NOT NULL,
  reported_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  upvotes INTEGER NOT NULL DEFAULT 0,
  downvotes INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_fuel_prices_station ON public.fuel_prices(station_id);
CREATE INDEX idx_fuel_prices_recent ON public.fuel_prices(reported_at DESC);
ALTER TABLE public.fuel_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read fuel prices" ON public.fuel_prices FOR SELECT USING (true);
CREATE POLICY "Auth users can submit fuel price" ON public.fuel_prices FOR INSERT WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "Reporter can delete own" ON public.fuel_prices FOR DELETE USING (auth.uid() = reported_by);

CREATE TABLE public.fuel_price_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_price_id UUID NOT NULL REFERENCES public.fuel_prices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fuel_price_id, user_id)
);
ALTER TABLE public.fuel_price_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read votes" ON public.fuel_price_votes FOR SELECT USING (true);
CREATE POLICY "Users manage own votes" ON public.fuel_price_votes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ CONVERSATIONS / MESSAGES ============
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  consumer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, consumer_id)
);
CREATE INDEX idx_conv_consumer ON public.conversations(consumer_id);
CREATE INDEX idx_conv_owner ON public.conversations(owner_id);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can read conversations" ON public.conversations FOR SELECT USING (auth.uid() = consumer_id OR auth.uid() = owner_id);
CREATE POLICY "Consumer can start conversation" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = consumer_id);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conv ON public.messages(conversation_id, created_at);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read messages" ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.consumer_id = auth.uid() OR c.owner_id = auth.uid()))
);
CREATE POLICY "Participants send messages" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.consumer_id = auth.uid() OR c.owner_id = auth.uid())
  )
);

-- bump conversation timestamp
CREATE OR REPLACE FUNCTION public.bump_conversation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER messages_bump_conv AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.bump_conversation();

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- ============ FAVORITES ============
CREATE TABLE public.favorites (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, business_id)
);
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own favorites" ON public.favorites FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ updated_at triggers ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER businesses_touch BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER listings_touch BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public) VALUES ('business-media','business-media', true) ON CONFLICT DO NOTHING;
CREATE POLICY "Public read business media" ON storage.objects FOR SELECT USING (bucket_id = 'business-media');
CREATE POLICY "Auth users upload business media" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'business-media' AND auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "Owners update own media" ON storage.objects FOR UPDATE USING (
  bucket_id = 'business-media' AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "Owners delete own media" ON storage.objects FOR DELETE USING (
  bucket_id = 'business-media' AND (storage.foldername(name))[1] = auth.uid()::text
);
