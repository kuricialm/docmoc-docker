-- App settings table for runtime flags
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value_boolean BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app settings" ON public.app_settings
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admins can update app settings" ON public.app_settings
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can edit app settings" ON public.app_settings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (key, value_boolean)
VALUES ('registration_enabled', true)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.registration_enabled()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value_boolean FROM public.app_settings WHERE key = 'registration_enabled' LIMIT 1),
    true
  )
$$;

CREATE OR REPLACE FUNCTION public.enforce_registration_setting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count INT;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';

  -- Always allow bootstrap if no admin exists yet.
  IF admin_count = 0 THEN
    RETURN NEW;
  END IF;

  IF NOT public.registration_enabled() THEN
    RAISE EXCEPTION 'Registration is disabled';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_registration_on_signup ON auth.users;
CREATE TRIGGER enforce_registration_on_signup
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.enforce_registration_setting();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  admin_count INT;
  assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
  assigned_role := CASE WHEN admin_count = 0 THEN 'admin'::public.app_role ELSE 'user'::public.app_role END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
