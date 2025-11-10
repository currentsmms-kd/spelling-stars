-- Fix Multiple Permissive Policies Warning
-- Issue: Tables have overlapping SELECT policies when using FOR ALL
-- Solution: Split ALL policies into separate INSERT/UPDATE/DELETE policies
--          Keep only one SELECT policy per table per role
-- Note: PostgreSQL RLS doesn't allow filtering by command type in USING clause,
--       so we create separate policies for each command type.

-- =====================================================
-- LIST_WORDS TABLE
-- =====================================================
-- Problem: "Authenticated users can read" + "Parents can manage" (ALL includes SELECT)
-- Solution: Replace ALL with separate INSERT/UPDATE/DELETE policies

DROP POLICY IF EXISTS "Parents can manage own list_words" ON list_words;

-- Parents can insert list_words for their own lists
CREATE POLICY "Parents can insert own list_words"
    ON list_words
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM word_lists
            JOIN profiles ON profiles.id = (SELECT auth.uid())
            WHERE word_lists.id = list_words.list_id
            AND word_lists.created_by = (SELECT auth.uid())
            AND profiles.role = 'parent'
        )
    );

-- Parents can update list_words for their own lists
CREATE POLICY "Parents can update own list_words"
    ON list_words
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM word_lists
            JOIN profiles ON profiles.id = (SELECT auth.uid())
            WHERE word_lists.id = list_words.list_id
            AND word_lists.created_by = (SELECT auth.uid())
            AND profiles.role = 'parent'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM word_lists
            JOIN profiles ON profiles.id = (SELECT auth.uid())
            WHERE word_lists.id = list_words.list_id
            AND word_lists.created_by = (SELECT auth.uid())
            AND profiles.role = 'parent'
        )
    );

-- Parents can delete list_words for their own lists
CREATE POLICY "Parents can delete own list_words"
    ON list_words
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM word_lists
            JOIN profiles ON profiles.id = (SELECT auth.uid())
            WHERE word_lists.id = list_words.list_id
            AND word_lists.created_by = (SELECT auth.uid())
            AND profiles.role = 'parent'
        )
    );

-- =====================================================
-- REWARDS TABLE
-- =====================================================
-- Problem: "Users can read" + "Children can manage" (ALL) + "Parents can update"
-- Solution: Replace ALL with separate INSERT/DELETE policies (children don't UPDATE)

DROP POLICY IF EXISTS "Children can manage own rewards" ON rewards;

-- Children can insert their own rewards
CREATE POLICY "Children can insert own rewards"
    ON rewards
    FOR INSERT
    TO authenticated
    WITH CHECK (
        child_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'child'
        )
    );

-- Children can delete their own rewards
CREATE POLICY "Children can delete own rewards"
    ON rewards
    FOR DELETE
    TO authenticated
    USING (
        child_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'child'
        )
    );

-- =====================================================
-- SRS TABLE
-- =====================================================
-- Problem: "Users can read appropriate SRS" + "Children can manage own SRS" (ALL)
-- Solution: Replace ALL with separate INSERT/UPDATE/DELETE policies

DROP POLICY IF EXISTS "Children can manage own SRS" ON srs;

-- Children can insert their own SRS entries
CREATE POLICY "Children can insert own SRS"
    ON srs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        child_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'child'
        )
    );

-- Children can update their own SRS entries
CREATE POLICY "Children can update own SRS"
    ON srs
    FOR UPDATE
    TO authenticated
    USING (
        child_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'child'
        )
    )
    WITH CHECK (
        child_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'child'
        )
    );

-- Children can delete their own SRS entries
CREATE POLICY "Children can delete own SRS"
    ON srs
    FOR DELETE
    TO authenticated
    USING (
        child_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'child'
        )
    );

-- =====================================================
-- WORD_LISTS TABLE
-- =====================================================
-- Problem: "Authenticated users can read" + "Parents can manage" (ALL)
-- Solution: Replace ALL with separate INSERT/UPDATE/DELETE policies

DROP POLICY IF EXISTS "Parents can manage own word_lists" ON word_lists;

-- Parents can insert their own lists
CREATE POLICY "Parents can insert own word_lists"
    ON word_lists
    FOR INSERT
    TO authenticated
    WITH CHECK (
        created_by = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'parent'
        )
    );

-- Parents can update their own lists
CREATE POLICY "Parents can update own word_lists"
    ON word_lists
    FOR UPDATE
    TO authenticated
    USING (
        created_by = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'parent'
        )
    )
    WITH CHECK (
        created_by = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'parent'
        )
    );

-- Parents can delete their own lists
CREATE POLICY "Parents can delete own word_lists"
    ON word_lists
    FOR DELETE
    TO authenticated
    USING (
        created_by = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'parent'
        )
    );

-- =====================================================
-- WORDS TABLE
-- =====================================================
-- Problem: "Authenticated users can read" + "Parents can manage words in own lists" (ALL)
-- Solution: Replace ALL with separate INSERT/UPDATE/DELETE policies

DROP POLICY IF EXISTS "Parents can manage words in own lists" ON words;

-- Parents can insert words
CREATE POLICY "Parents can insert words"
    ON words
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'parent'
        )
    );

-- Parents can update words
CREATE POLICY "Parents can update words"
    ON words
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'parent'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'parent'
        )
    );

-- Parents can delete words
CREATE POLICY "Parents can delete words"
    ON words
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'parent'
        )
    );

-- =====================================================
-- Add documentation comments
-- =====================================================

COMMENT ON POLICY "Parents can insert own list_words" ON list_words IS
    'Allows parents to add words to their own lists. SELECT handled by separate read policy.';

COMMENT ON POLICY "Children can insert own rewards" ON rewards IS
    'Allows children to earn rewards. SELECT has separate policy, UPDATE is parent-only.';

COMMENT ON POLICY "Children can insert own SRS" ON srs IS
    'Allows children to create SRS entries. SELECT has separate consolidated policy.';

COMMENT ON POLICY "Parents can insert own word_lists" ON word_lists IS
    'Allows parents to create new lists. SELECT has separate read policy.';

COMMENT ON POLICY "Parents can insert words" ON words IS
    'Allows parents to create words. SELECT has separate read policy.';

-- =====================================================
-- Verification query
-- =====================================================

-- This query will show remaining policies to verify no duplicates exist
-- Run: SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, cmd, policyname;

