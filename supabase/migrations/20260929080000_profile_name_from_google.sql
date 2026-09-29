-- Migration: 20260929080000_profile_name_from_google.sql
-- Description: Derives display_name on signup from Google user metadata (full_name, name) falling back to email
-- Rollback: Restore handle_new_user definition from 20260506123622_41343433-c860-4c00-b7e8-6f921439b6c3.sql

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(new.email, '@', 1)
    )
  );
  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
