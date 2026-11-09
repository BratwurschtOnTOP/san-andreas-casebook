CREATE TYPE public.lawyer_type AS ENUM ('rechtsanwalt', 'orgaanwalt');
CREATE TYPE public.service_type AS ENUM ('beratung', 'verteidigung', 'revisionsantrag', 'familienantrag', 'sonstiger_antrag', 'schnellverfahren');
CREATE TYPE public.application_status AS ENUM ('entwurf', 'eingereicht', 'genehmigt', 'abgelehnt');

-- Profiles (Anwaltsdaten)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  passport_number TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  lawyer_type public.lawyer_type NOT NULL DEFAULT 'rechtsanwalt',
  organization TEXT,
  license_valid_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Familienlizenz-Anträge (§7 RAVO)
CREATE TABLE public.family_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  application_date DATE NOT NULL DEFAULT CURRENT_DATE,
  applicant_name TEXT NOT NULL,
  applicant_passport TEXT NOT NULL,
  applicant_phone TEXT NOT NULL,
  lawyer_name TEXT NOT NULL,
  lawyer_passport TEXT NOT NULL,
  lawyer_phone TEXT NOT NULL,
  family_name TEXT NOT NULL,
  house_number TEXT NOT NULL,
  sworn_statement BOOLEAN NOT NULL DEFAULT false,
  client_signature TEXT NOT NULL DEFAULT '',
  lawyer_signature TEXT NOT NULL DEFAULT '',
  status public.application_status NOT NULL DEFAULT 'entwurf',
  fee BIGINT NOT NULL DEFAULT 75000 CHECK (fee >= 0 AND fee <= 75000),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_applications TO authenticated;
GRANT ALL ON public.family_applications TO service_role;
ALTER TABLE public.family_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own applications select" ON public.family_applications FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Own applications insert" ON public.family_applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Own applications update" ON public.family_applications FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Own applications delete" ON public.family_applications FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER family_applications_touch BEFORE UPDATE ON public.family_applications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Leistungsdokumentation (§3 Abs. 5 RAVO)
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  client_name TEXT NOT NULL CHECK (length(btrim(client_name)) > 0),
  client_phone TEXT NOT NULL CHECK (length(btrim(client_phone)) > 0),
  service_type public.service_type NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  service_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  fee BIGINT NOT NULL DEFAULT 0 CHECK (fee >= 0),
  max_fee BIGINT NOT NULL DEFAULT 0,
  family_application_id UUID REFERENCES public.family_applications(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX services_owner_date_idx ON public.services (owner_id, service_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own services select" ON public.services FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Own services insert" ON public.services FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Own services update" ON public.services FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Own services delete" ON public.services FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- Höchstbeträge gem. §4 Abs. 2 RAVO
CREATE OR REPLACE FUNCTION public.ravo_max_fee(_type public.service_type, _minutes INTEGER)
RETURNS BIGINT LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _type
    WHEN 'beratung' THEN 25000::bigint * GREATEST(1, CEIL(COALESCE(_minutes, 1) / 15.0))::bigint
    WHEN 'verteidigung' THEN 115000::bigint * GREATEST(1, CEIL(COALESCE(_minutes, 1) / 30.0))::bigint
    WHEN 'schnellverfahren' THEN 125000::bigint * GREATEST(1, CEIL(COALESCE(_minutes, 1) / 30.0))::bigint
    WHEN 'revisionsantrag' THEN 125000::bigint
    WHEN 'familienantrag' THEN 75000::bigint
    WHEN 'sonstiger_antrag' THEN 100000::bigint
  END
$$;

CREATE OR REPLACE FUNCTION public.validate_service()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _lawyer public.lawyer_type;
BEGIN
  IF NEW.service_type IN ('beratung', 'verteidigung', 'schnellverfahren') AND NEW.duration_minutes IS NULL THEN
    RAISE EXCEPTION 'Für diese Leistung ist die Dauer in Minuten erforderlich.';
  END IF;

  NEW.max_fee := public.ravo_max_fee(NEW.service_type, NEW.duration_minutes);

  SELECT lawyer_type INTO _lawyer FROM public.profiles WHERE id = NEW.owner_id;
  IF _lawyer = 'orgaanwalt' AND NEW.service_type <> 'familienantrag' THEN
    NEW.max_fee := 0;
  END IF;

  IF NEW.fee > NEW.max_fee THEN
    RAISE EXCEPTION 'Gebühr überschreitet den zulässigen Höchstbetrag gem. §4 RAVO (max. % $).', NEW.max_fee;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER services_validate BEFORE INSERT OR UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.validate_service();