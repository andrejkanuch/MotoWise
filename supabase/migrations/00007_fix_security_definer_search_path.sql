-- Migration: Pin search_path on SECURITY DEFINER functions
-- Fixes potential privilege escalation via search_path manipulation
-- Also adds length constraint on full_name

-- ==========================================
-- FIX: is_admin() — pin search_path
-- ==========================================
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

-- ==========================================
-- FIX: handle_new_user() — pin search_path + limit full_name length
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, LEFT(NEW.raw_user_meta_data->>'full_name', 200), 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ==========================================
-- CONSTRAINT: Limit full_name length at DB level
-- ==========================================
ALTER TABLE public.users ADD CONSTRAINT chk_full_name_length CHECK (char_length(full_name) <= 200) NOT VALID;
