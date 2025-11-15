-- Restore missing SELECT policy for word_lists table
-- Issue: Migration 20251109210000 removed the "Authenticated users can read word_lists"
--        policy but never recreated it, breaking game loading for children
-- Solution: Add back the SELECT policy for all authenticated users

-- Drop if exists to ensure idempotency
DROP POLICY IF EXISTS "Authenticated users can read word_lists" ON word_lists;

-- Allow all authenticated users (parents and children) to read word lists
CREATE POLICY "Authenticated users can read word_lists"
    ON word_lists
    FOR SELECT
    TO authenticated
    USING (true);

-- Verify the policy is active
COMMENT ON POLICY "Authenticated users can read word_lists" ON word_lists IS
    'Allows all authenticated users to view word lists. Children need this to play games.';
