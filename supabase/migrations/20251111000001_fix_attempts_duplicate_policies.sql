-- Migration: Fix duplicate SELECT policies on attempts table
-- Problem: Both "Parents can view attempts for their lists" and "Users can read appropriate attempts" exist
-- Solution: Keep only the consolidated "Users can read appropriate attempts" policy that handles both children and parents

-- Drop the duplicate parent-only policy
DROP POLICY IF EXISTS "Parents can view attempts for their lists" ON attempts;

-- Verify: Only "Users can read appropriate attempts" should remain for SELECT
-- This policy handles both:
-- - Children can see their own attempts (child_id = auth.uid() AND role = 'child')
-- - Parents can see all attempts (role = 'parent')

-- Also ensure the INSERT policy validates list_id exists and is accessible
-- Update the INSERT policy to be more robust
DROP POLICY IF EXISTS "Children can insert own attempts" ON attempts;

CREATE POLICY "Children can insert own attempts"
    ON attempts FOR INSERT
    TO authenticated
    WITH CHECK (
        -- User must be a child
        child_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'child'
        )
        -- List must exist (foreign key constraint handles this, but explicit check is clearer)
        AND EXISTS (
            SELECT 1 FROM word_lists
            WHERE word_lists.id = attempts.list_id
        )
        -- Word must exist in the specified list
        AND EXISTS (
            SELECT 1 FROM list_words
            WHERE list_words.list_id = attempts.list_id
            AND list_words.word_id = attempts.word_id
        )
    );

-- Verification
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    -- Count SELECT policies on attempts - should be exactly 1
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'attempts'
    AND cmd = 'SELECT';

    IF policy_count != 1 THEN
        RAISE WARNING 'Expected 1 SELECT policy on attempts, found %', policy_count;
    END IF;

    -- Verify the correct policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'attempts'
        AND policyname = 'Users can read appropriate attempts'
        AND cmd = 'SELECT'
    ) THEN
        RAISE EXCEPTION 'Required policy "Users can read appropriate attempts" not found';
    END IF;

    RAISE NOTICE 'Migration completed: duplicate policy removed, INSERT policy enhanced';
END $$;
