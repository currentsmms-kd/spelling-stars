SET ROLE postgres;

-- Migration: Auto-confirm child accounts created by parents
-- Date: 2025-11-15
-- Description: Child accounts don't need email verification since they're created by authenticated parents
--              and use the parent's email with plus-addressing. This trigger auto-confirms them.

-- Create function to auto-confirm child accounts
CREATE OR REPLACE FUNCTION auto_confirm_child_accounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    -- Check if this is a child account (role='child' in metadata)
    IF NEW.raw_user_meta_data->>'role' = 'child' THEN
        -- Auto-confirm the email since child accounts are created by authenticated parents
        -- and don't have access to the parent's email inbox
        NEW.email_confirmed_at := NOW();
        NEW.confirmed_at := NOW();

        -- Log for debugging
        RAISE LOG 'Auto-confirmed child account: % (email: %)', NEW.id, NEW.email;
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger that runs BEFORE INSERT on auth.users
-- This must run BEFORE the insert so we can modify the NEW record
DROP TRIGGER IF EXISTS auto_confirm_child_on_signup ON auth.users;
CREATE TRIGGER auto_confirm_child_on_signup
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION auto_confirm_child_accounts();

COMMENT ON FUNCTION auto_confirm_child_accounts() IS
    'Auto-confirms email for child accounts since they are created by authenticated parents and use parent email plus-addressing';

COMMENT ON TRIGGER auto_confirm_child_on_signup ON auth.users IS
    'Automatically confirms child account emails on creation to bypass email verification requirement';

RESET ROLE;
