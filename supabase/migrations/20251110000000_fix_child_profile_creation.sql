-- Migration: Fix child profile creation to properly set parent_id from metadata
-- Date: 2025-11-10
-- Description: Updates handle_new_user trigger to extract parent_id from user metadata

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Recreate handle_new_user function with parent_id support
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        role,
        display_name,
        parent_id,
        stars,
        streak_days
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'role', 'parent'),
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        NULLIF(NEW.raw_user_meta_data->>'parent_id', '')::uuid, -- Extract parent_id from metadata
        COALESCE((NEW.raw_user_meta_data->>'stars')::integer, 0), -- Default 0 stars
        COALESCE((NEW.raw_user_meta_data->>'streak_days')::integer, 0) -- Default 0 streak
    );
    RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

COMMENT ON FUNCTION handle_new_user() IS
  'Trigger function to create user profile on signup with parent_id extraction from metadata';
