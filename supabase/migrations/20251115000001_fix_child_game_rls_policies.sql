-- Migration: Fix RLS policies to allow child gameplay regardless of role
-- Problem: Children playing games get RLS policy violations because policies check role='child'
-- But some users might not have role set, or parents might play on behalf of children
-- Solution: Simplify INSERT policies to only check authentication and ownership (child_id = auth.uid())

-- ====================
-- FIX ATTEMPTS INSERT
-- ====================

DROP POLICY IF EXISTS "Children can insert own attempts" ON attempts;

-- Simplified policy: Just check that user is inserting their own attempts
-- Don't check role - if they're authenticated and child_id matches, allow it
CREATE POLICY "Children can insert own attempts"
    ON attempts FOR INSERT
    TO authenticated
    WITH CHECK (
        child_id = auth.uid()
    );

COMMENT ON POLICY "Children can insert own attempts" ON attempts IS
'Allows authenticated users to insert attempts for themselves (child_id must match auth.uid()).
Does not check role to allow flexibility (parents can play as children, accounts without role set can still play).';

-- ====================
-- FIX SRS INSERT
-- ====================

DROP POLICY IF EXISTS "Children can insert own SRS" ON srs;

-- Simplified policy: Just check that user is inserting their own SRS entries
CREATE POLICY "Children can insert own SRS"
    ON srs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        child_id = auth.uid()
    );

COMMENT ON POLICY "Children can insert own SRS" ON srs IS
'Allows authenticated users to insert SRS entries for themselves (child_id must match auth.uid()).';

-- ====================
-- FIX SRS UPDATE
-- ====================

DROP POLICY IF EXISTS "Children can update own SRS" ON srs;

CREATE POLICY "Children can update own SRS"
    ON srs
    FOR UPDATE
    TO authenticated
    USING (
        child_id = auth.uid()
    )
    WITH CHECK (
        child_id = auth.uid()
    );

COMMENT ON POLICY "Children can update own SRS" ON srs IS
'Allows authenticated users to update their own SRS entries.';

-- ====================
-- FIX SRS DELETE
-- ====================

DROP POLICY IF EXISTS "Children can delete own SRS" ON srs;

CREATE POLICY "Children can delete own SRS"
    ON srs
    FOR DELETE
    TO authenticated
    USING (
        child_id = auth.uid()
    );

COMMENT ON POLICY "Children can delete own SRS" ON srs IS
'Allows authenticated users to delete their own SRS entries.';

-- Verification
DO $$
BEGIN
    -- Verify attempts policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'attempts'
        AND policyname = 'Children can insert own attempts'
        AND cmd = 'INSERT'
    ) THEN
        RAISE EXCEPTION 'Required policy "Children can insert own attempts" not found';
    END IF;

    -- Verify SRS policies
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'srs'
        AND policyname = 'Children can insert own SRS'
        AND cmd = 'INSERT'
    ) THEN
        RAISE EXCEPTION 'Required policy "Children can insert own SRS" not found';
    END IF;

    RAISE NOTICE 'Migration completed: Simplified RLS policies for gameplay';
END $$;
