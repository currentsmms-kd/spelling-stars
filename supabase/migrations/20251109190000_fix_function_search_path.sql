-- Fix Supabase Advisor Warnings: Function Search Path Mutable
-- This migration sets search_path on all functions to prevent SQL injection vulnerabilities
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- =====================================================
-- 1. fn_add_stars: Add stars to child rewards
-- =====================================================
CREATE OR REPLACE FUNCTION fn_add_stars(p_child UUID, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_new_total INTEGER;
BEGIN
    INSERT INTO rewards (child_id, stars_total)
    VALUES (p_child, p_amount)
    ON CONFLICT (child_id)
    DO UPDATE SET stars_total = rewards.stars_total + p_amount
    RETURNING stars_total INTO v_new_total;

    RETURN v_new_total;
END;
$$;

-- =====================================================
-- 2. handle_new_user: Create profile on user signup
-- =====================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.profiles (id, role, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'role', 'parent'),
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$;

-- =====================================================
-- 3. update_updated_at_column: Generic updated_at trigger
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- =====================================================
-- 4. update_srs_updated_at: SRS updated_at trigger
-- =====================================================
CREATE OR REPLACE FUNCTION update_srs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- =====================================================
-- Function Comments for Documentation
-- =====================================================
COMMENT ON FUNCTION fn_add_stars(UUID, INTEGER) IS
  'Adds stars to child rewards with search_path security fix applied';

COMMENT ON FUNCTION handle_new_user() IS
  'Trigger function to create user profile on signup with search_path security fix applied';

COMMENT ON FUNCTION update_updated_at_column() IS
  'Generic trigger to update updated_at timestamp with search_path security fix applied';

COMMENT ON FUNCTION update_srs_updated_at() IS
  'SRS-specific trigger to update updated_at timestamp with search_path security fix applied';
