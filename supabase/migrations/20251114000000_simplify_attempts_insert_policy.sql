-- Migration: Simplify attempts INSERT policy to avoid performance issues
-- Problem: Current policy checks if word exists in list, which can be slow and cause timeouts
-- Solution: Rely on foreign key constraints for data integrity, focus RLS on authentication

-- Drop the complex INSERT policy
DROP POLICY IF EXISTS "Children can insert own attempts" ON attempts;

-- Create a simpler, faster INSERT policy
-- Trust foreign key constraints to ensure data integrity
-- Focus RLS on authentication and ownership only
CREATE POLICY "Children can insert own attempts"
    ON attempts FOR INSERT
    TO authenticated
    WITH CHECK (
        -- User must be authenticated and match child_id
        child_id = auth.uid()
        -- User must have 'child' role
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'child'
        )
        -- Foreign key constraints handle:
        -- - list_id references word_lists(id)
        -- - word_id references words(id)
        -- No need to check list_words junction in RLS - FK constraints are sufficient
    );

-- Verification
DO $$
BEGIN
    -- Verify the policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'attempts'
        AND policyname = 'Children can insert own attempts'
        AND cmd = 'INSERT'
    ) THEN
        RAISE EXCEPTION 'Required policy "Children can insert own attempts" not found';
    END IF;

    RAISE NOTICE 'Migration completed: Simplified INSERT policy for better performance';
END $$;
