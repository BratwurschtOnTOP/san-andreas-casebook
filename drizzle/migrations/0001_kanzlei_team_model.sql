-- Kanzlei-/Team-Modell: Kanzleien, Mitglieder, Einladungen, gemeinsame Fallakten
CREATE TYPE public.firm_role AS ENUM ('owner', 'member');

CREATE TABLE public.law_firms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Alles oder nichts' CHECK (length(btrim(name)) > 0),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.law_firms TO authenticated;
GRANT ALL ON public.law_firms TO service_role;
ALTER TABLE public.law_firms ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.law_firm_members (
  firm_id UUID NOT NULL REFERENCES public.law_firms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE,
  role public.firm_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (firm_id, user_id)
);
GRANT SELECT ON public.law_firm_members TO authenticated;
GRANT ALL ON public.law_firm_members TO service_role;
ALTER TABLE public.law_firm_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.firm_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.law_firms(id) ON DELETE CASCADE,
  email TEXT NOT NULL CHECK (email = lower(btrim(email)) AND position('@' in email) > 1),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX firm_invitations_firm_idx ON public.firm_invitations (firm_id, created_at DESC);
-- token_hash bleibt für Clients unsichtbar (Spalten-Grant)
GRANT SELECT (id, firm_id, email, invited_by, expires_at, accepted_at, accepted_by, revoked_at, created_at)
  ON public.firm_invitations TO authenticated;
GRANT ALL ON public.firm_invitations TO service_role;
ALTER TABLE public.firm_invitations ENABLE ROW LEVEL SECURITY;

-- Hilfsfunktionen (SECURITY DEFINER, damit Policies nicht rekursiv werden)
CREATE OR REPLACE FUNCTION public.current_firm_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT firm_id FROM public.law_firm_members WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_firm_member(_firm UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.law_firm_members WHERE firm_id = _firm AND user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.is_firm_owner(_firm UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.law_firm_members WHERE firm_id = _firm AND user_id = auth.uid() AND role = 'owner')
$$;

REVOKE ALL ON FUNCTION public.current_firm_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_firm_member(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_firm_owner(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_firm_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_firm_member(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_firm_owner(UUID) TO authenticated, service_role;

CREATE POLICY "Members read own firm" ON public.law_firms FOR SELECT TO authenticated
  USING (public.is_firm_member(id));
CREATE POLICY "Members read firm members" ON public.law_firm_members FOR SELECT TO authenticated
  USING (public.is_firm_member(firm_id));
CREATE POLICY "Owners read invitations" ON public.firm_invitations FOR SELECT TO authenticated
  USING (public.is_firm_owner(firm_id));

-- Interne Funktion: legt für einen Nutzer ohne Kanzlei die Kanzlei „Alles oder nichts“ an (Owner)
CREATE OR REPLACE FUNCTION public.ensure_personal_firm(_user UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _firm UUID;
BEGIN
  SELECT firm_id INTO _firm FROM public.law_firm_members WHERE user_id = _user;
  IF _firm IS NOT NULL THEN
    RETURN _firm;
  END IF;
  INSERT INTO public.law_firms (name, created_by) VALUES ('Alles oder nichts', _user) RETURNING id INTO _firm;
  INSERT INTO public.law_firm_members (firm_id, user_id, role) VALUES (_firm, _user, 'owner');
  RETURN _firm;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_personal_firm(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_personal_firm(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''))
  ON CONFLICT (id) DO NOTHING;
  PERFORM public.ensure_personal_firm(NEW.id);
  RETURN NEW;
END;
$$;

-- Backfill: jeder bestehende Nutzer erhält seine erste Kanzlei
SELECT public.ensure_personal_firm(u.id) FROM auth.users u;

-- Bestehende Dokumente der Kanzlei zuordnen
ALTER TABLE public.services ADD COLUMN firm_id UUID REFERENCES public.law_firms(id) ON DELETE RESTRICT;
ALTER TABLE public.family_applications ADD COLUMN firm_id UUID REFERENCES public.law_firms(id) ON DELETE RESTRICT;

UPDATE public.services s SET firm_id = m.firm_id
  FROM public.law_firm_members m WHERE m.user_id = s.owner_id AND s.firm_id IS NULL;
UPDATE public.family_applications f SET firm_id = m.firm_id
  FROM public.law_firm_members m WHERE m.user_id = f.owner_id AND f.firm_id IS NULL;

ALTER TABLE public.services ALTER COLUMN firm_id SET DEFAULT public.current_firm_id();
ALTER TABLE public.family_applications ALTER COLUMN firm_id SET DEFAULT public.current_firm_id();
CREATE INDEX services_firm_date_idx ON public.services (firm_id, service_date DESC);
CREATE INDEX family_applications_firm_idx ON public.family_applications (firm_id, created_at DESC);

-- Ersteller eines Datensatzes bleibt unveränderlich
CREATE OR REPLACE FUNCTION public.keep_record_owner()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.owner_id := OLD.owner_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER services_keep_owner BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.keep_record_owner();
CREATE TRIGGER family_applications_keep_owner BEFORE UPDATE ON public.family_applications
  FOR EACH ROW EXECUTE FUNCTION public.keep_record_owner();

-- RLS: Zugriff nur für Mitglieder derselben Kanzlei
DROP POLICY "Own services select" ON public.services;
DROP POLICY "Own services insert" ON public.services;
DROP POLICY "Own services update" ON public.services;
DROP POLICY "Own services delete" ON public.services;
CREATE POLICY "Firm services select" ON public.services FOR SELECT TO authenticated
  USING (public.is_firm_member(firm_id));
CREATE POLICY "Firm services insert" ON public.services FOR INSERT TO authenticated
  WITH CHECK (public.is_firm_member(firm_id) AND owner_id = auth.uid());
CREATE POLICY "Firm services update" ON public.services FOR UPDATE TO authenticated
  USING (public.is_firm_member(firm_id)) WITH CHECK (public.is_firm_member(firm_id));
CREATE POLICY "Firm services delete" ON public.services FOR DELETE TO authenticated
  USING (public.is_firm_member(firm_id));

DROP POLICY "Own applications select" ON public.family_applications;
DROP POLICY "Own applications insert" ON public.family_applications;
DROP POLICY "Own applications update" ON public.family_applications;
DROP POLICY "Own applications delete" ON public.family_applications;
CREATE POLICY "Firm applications select" ON public.family_applications FOR SELECT TO authenticated
  USING (public.is_firm_member(firm_id));
CREATE POLICY "Firm applications insert" ON public.family_applications FOR INSERT TO authenticated
  WITH CHECK (public.is_firm_member(firm_id) AND owner_id = auth.uid());
CREATE POLICY "Firm applications update" ON public.family_applications FOR UPDATE TO authenticated
  USING (public.is_firm_member(firm_id)) WITH CHECK (public.is_firm_member(firm_id));
CREATE POLICY "Firm applications delete" ON public.family_applications FOR DELETE TO authenticated
  USING (public.is_firm_member(firm_id));

-- Gebührenprüfung: Anwaltstyp des erfassenden Anwalts auch bei Bearbeitung durch Kanzleipartner lesen
CREATE OR REPLACE FUNCTION public.validate_service()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _lawyer public.lawyer_type;
BEGIN
  IF NEW.service_type IN ('beratung', 'verteidigung', 'schnellverfahren') AND NEW.duration_minutes IS NULL THEN
    RAISE EXCEPTION 'Für diese Leistung ist die Dauer in Minuten erforderlich.';
  END IF;

  IF NEW.family_application_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.family_applications fa
    WHERE fa.id = NEW.family_application_id AND fa.firm_id IS NOT DISTINCT FROM NEW.firm_id
  ) THEN
    RAISE EXCEPTION 'Der verknüpfte Antrag gehört nicht zu dieser Kanzlei.';
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
REVOKE ALL ON FUNCTION public.validate_service() FROM PUBLIC, anon, authenticated;

-- Gespeicherte Fallakten aus dem Bußgeldkatalog
CREATE TABLE public.case_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.current_firm_id() REFERENCES public.law_firms(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  updated_by UUID DEFAULT auth.uid(),
  client_name TEXT NOT NULL DEFAULT '',
  case_number TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  offense_ids TEXT[] NOT NULL DEFAULT '{}',
  third_repeat_52a BOOLEAN NOT NULL DEFAULT false,
  total_fine BIGINT NOT NULL DEFAULT 0 CHECK (total_fine >= 0),
  total_wanteds INTEGER NOT NULL DEFAULT 0 CHECK (total_wanteds >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX case_files_firm_idx ON public.case_files (firm_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_files TO authenticated;
GRANT ALL ON public.case_files TO service_role;
ALTER TABLE public.case_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Firm case files select" ON public.case_files FOR SELECT TO authenticated
  USING (public.is_firm_member(firm_id));
CREATE POLICY "Firm case files insert" ON public.case_files FOR INSERT TO authenticated
  WITH CHECK (public.is_firm_member(firm_id) AND created_by = auth.uid());
CREATE POLICY "Firm case files update" ON public.case_files FOR UPDATE TO authenticated
  USING (public.is_firm_member(firm_id)) WITH CHECK (public.is_firm_member(firm_id));
CREATE POLICY "Firm case files delete" ON public.case_files FOR DELETE TO authenticated
  USING (public.is_firm_member(firm_id));

CREATE OR REPLACE FUNCTION public.touch_case_file()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER case_files_touch BEFORE INSERT OR UPDATE ON public.case_files
  FOR EACH ROW EXECUTE FUNCTION public.touch_case_file();

-- Mitgliederliste der eigenen Kanzlei (nur nötige Profildaten)
CREATE OR REPLACE FUNCTION public.firm_members()
RETURNS TABLE (user_id UUID, role public.firm_role, full_name TEXT, lawyer_type public.lawyer_type, joined_at TIMESTAMPTZ, is_self BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.user_id, m.role, COALESCE(p.full_name, ''), COALESCE(p.lawyer_type, 'rechtsanwalt'::public.lawyer_type), m.joined_at, m.user_id = auth.uid()
  FROM public.law_firm_members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.firm_id = public.current_firm_id()
  ORDER BY m.role, m.joined_at
$$;

-- Einladung erstellen (nur Owner). Gibt den Klartext-Token genau einmal zurück.
CREATE OR REPLACE FUNCTION public.create_firm_invitation(_email TEXT)
RETURNS TABLE (invitation_id UUID, token TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _firm UUID := public.current_firm_id();
  _mail TEXT := lower(btrim(COALESCE(_email, '')));
  _token TEXT;
  _id UUID;
  _exp TIMESTAMPTZ := now() + interval '7 days';
BEGIN
  IF auth.uid() IS NULL OR _firm IS NULL OR NOT public.is_firm_owner(_firm) THEN
    RAISE EXCEPTION 'Nur der Kanzleiinhaber darf Mitglieder einladen.';
  END IF;
  IF _mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Bitte eine gültige E-Mail-Adresse eingeben.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.law_firm_members m JOIN auth.users u ON u.id = m.user_id
    WHERE m.firm_id = _firm AND lower(u.email) = _mail
  ) THEN
    RAISE EXCEPTION 'Diese Person ist bereits Mitglied der Kanzlei.';
  END IF;

  UPDATE public.firm_invitations SET revoked_at = now()
    WHERE firm_id = _firm AND email = _mail AND accepted_at IS NULL AND revoked_at IS NULL;

  _token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  INSERT INTO public.firm_invitations (firm_id, email, token_hash, invited_by, expires_at)
  VALUES (_firm, _mail, encode(sha256(convert_to(_token, 'UTF8')), 'hex'), auth.uid(), _exp)
  RETURNING id INTO _id;

  RETURN QUERY SELECT _id, _token, _exp;
END;
$$;

-- Einladung widerrufen (nur Owner)
CREATE OR REPLACE FUNCTION public.revoke_firm_invitation(_invitation UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.firm_invitations SET revoked_at = now()
  WHERE id = _invitation AND accepted_at IS NULL AND revoked_at IS NULL
    AND public.is_firm_owner(firm_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Einladung nicht gefunden oder nicht mehr offen.';
  END IF;
END;
$$;

-- Vorschau für den Einladungslink (nur mit gültigem Token)
CREATE OR REPLACE FUNCTION public.get_invitation_preview(_token TEXT)
RETURNS TABLE (firm_name TEXT, email TEXT, expires_at TIMESTAMPTZ, status TEXT, email_matches BOOLEAN, email_confirmed BOOLEAN, already_member BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _inv public.firm_invitations%ROWTYPE;
  _mail TEXT;
  _confirmed BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Bitte zuerst anmelden.';
  END IF;
  SELECT * INTO _inv FROM public.firm_invitations
    WHERE token_hash = encode(sha256(convert_to(COALESCE(_token, ''), 'UTF8')), 'hex');
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT lower(u.email), u.email_confirmed_at IS NOT NULL INTO _mail, _confirmed FROM auth.users u WHERE u.id = auth.uid();
  RETURN QUERY SELECT
    f.name,
    _inv.email,
    _inv.expires_at,
    CASE
      WHEN _inv.accepted_at IS NOT NULL THEN 'angenommen'
      WHEN _inv.revoked_at IS NOT NULL THEN 'widerrufen'
      WHEN _inv.expires_at <= now() THEN 'abgelaufen'
      ELSE 'offen'
    END,
    _mail = _inv.email,
    COALESCE(_confirmed, false),
    EXISTS (SELECT 1 FROM public.law_firm_members m WHERE m.firm_id = _inv.firm_id AND m.user_id = auth.uid())
  FROM public.law_firms f WHERE f.id = _inv.firm_id;
END;
$$;

-- Einladung annehmen: nur mit passender, bestätigter E-Mail, gültig und einmalig
CREATE OR REPLACE FUNCTION public.accept_firm_invitation(_token TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _inv public.firm_invitations%ROWTYPE;
  _mail TEXT;
  _confirmed BOOLEAN;
  _old_firm UUID;
  _old_role public.firm_role;
  _others INTEGER;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Bitte zuerst anmelden.';
  END IF;

  SELECT * INTO _inv FROM public.firm_invitations
    WHERE token_hash = encode(sha256(convert_to(COALESCE(_token, ''), 'UTF8')), 'hex')
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Einladung ungültig.';
  END IF;
  IF _inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Diese Einladung wurde bereits verwendet.';
  END IF;
  IF _inv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Diese Einladung wurde widerrufen.';
  END IF;
  IF _inv.expires_at <= now() THEN
    RAISE EXCEPTION 'Diese Einladung ist abgelaufen.';
  END IF;

  SELECT lower(u.email), u.email_confirmed_at IS NOT NULL INTO _mail, _confirmed FROM auth.users u WHERE u.id = _uid;
  IF _mail IS DISTINCT FROM _inv.email THEN
    RAISE EXCEPTION 'Diese Einladung gilt für eine andere E-Mail-Adresse.';
  END IF;
  IF NOT COALESCE(_confirmed, false) THEN
    RAISE EXCEPTION 'Bitte bestätige zuerst deine E-Mail-Adresse.';
  END IF;

  SELECT firm_id, role INTO _old_firm, _old_role FROM public.law_firm_members WHERE user_id = _uid;

  IF _old_firm IS DISTINCT FROM _inv.firm_id THEN
    IF _old_firm IS NOT NULL THEN
      SELECT count(*) INTO _others FROM public.law_firm_members WHERE firm_id = _old_firm AND user_id <> _uid;
      IF _others > 0 AND _old_role = 'owner' THEN
        RAISE EXCEPTION 'Du bist Inhaber einer Kanzlei mit weiteren Mitgliedern und kannst nicht wechseln.';
      END IF;
      IF _others = 0 THEN
        -- Eigene bisherige Unterlagen gehen mit in die neue Kanzlei, nichts wird gelöscht
        UPDATE public.services SET firm_id = _inv.firm_id WHERE firm_id = _old_firm;
        UPDATE public.family_applications SET firm_id = _inv.firm_id WHERE firm_id = _old_firm;
        UPDATE public.case_files SET firm_id = _inv.firm_id WHERE firm_id = _old_firm;
      END IF;
      DELETE FROM public.law_firm_members WHERE user_id = _uid;
      IF _others = 0 THEN
        DELETE FROM public.law_firms WHERE id = _old_firm;
      END IF;
    END IF;
    INSERT INTO public.law_firm_members (firm_id, user_id, role) VALUES (_inv.firm_id, _uid, 'member');
  END IF;

  UPDATE public.firm_invitations SET accepted_at = now(), accepted_by = _uid WHERE id = _inv.id;
  RETURN _inv.firm_id;
END;
$$;

-- Mitglied entfernen (nur Owner, nicht sich selbst). Das Mitglied erhält wieder eine eigene Kanzlei.
CREATE OR REPLACE FUNCTION public.remove_firm_member(_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _firm UUID := public.current_firm_id();
BEGIN
  IF _firm IS NULL OR NOT public.is_firm_owner(_firm) THEN
    RAISE EXCEPTION 'Nur der Kanzleiinhaber darf Mitglieder entfernen.';
  END IF;
  IF _user = auth.uid() THEN
    RAISE EXCEPTION 'Du kannst dich nicht selbst entfernen.';
  END IF;
  DELETE FROM public.law_firm_members WHERE firm_id = _firm AND user_id = _user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mitglied nicht gefunden.';
  END IF;
  PERFORM public.ensure_personal_firm(_user);
END;
$$;

REVOKE ALL ON FUNCTION public.firm_members() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_firm_invitation(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_firm_invitation(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_invitation_preview(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_firm_invitation(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_firm_member(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.firm_members() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_firm_invitation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_firm_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_preview(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_firm_invitation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_firm_member(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
