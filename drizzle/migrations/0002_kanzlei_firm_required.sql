-- Alle bestehenden Datensätze sind einer Kanzlei zugeordnet; neue erhalten sie per Default
ALTER TABLE public.services ALTER COLUMN firm_id SET NOT NULL;
ALTER TABLE public.family_applications ALTER COLUMN firm_id SET NOT NULL;

-- Reihenfolge beim Kanzleiwechsel: zuerst Anträge, dann verknüpfte Leistungen verschieben
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
        UPDATE public.family_applications SET firm_id = _inv.firm_id WHERE firm_id = _old_firm;
        UPDATE public.services SET firm_id = _inv.firm_id WHERE firm_id = _old_firm;
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
REVOKE ALL ON FUNCTION public.accept_firm_invitation(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_firm_invitation(TEXT) TO authenticated;
