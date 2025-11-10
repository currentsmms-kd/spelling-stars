-- Optimize RLS Policies for Performance
-- Fixes Supabase Advisor Warnings:
-- 1. auth_rls_initplan: Wrap auth.uid() in SELECT to prevent re-evaluation per row
-- 2. multiple_permissive_policies: Consolidate overlapping policies

-- =====================================================
-- PROFILES TABLE
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;

-- Create optimized consolidated policy
CREATE POLICY "Users can manage own profile"
    ON profiles FOR ALL
    TO authenticated
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);

-- Service role access
CREATE POLICY "Service role full access"
    ON profiles FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- WORD_LISTS TABLE
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can read word_lists" ON word_lists;
DROP POLICY IF EXISTS "Parents can insert word_lists" ON word_lists;
DROP POLICY IF EXISTS "Parents can update word_lists" ON word_lists;
DROP POLICY IF EXISTS "Parents can delete word_lists" ON word_lists;

-- Authenticated users can read all lists
CREATE POLICY "Authenticated users can read word_lists"
    ON word_lists FOR SELECT
    TO authenticated
    USING (true);

-- Parents can manage their own lists (consolidated INSERT, UPDATE, DELETE)
CREATE POLICY "Parents can manage own word_lists"
    ON word_lists FOR ALL
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

-- =====================================================
-- WORDS TABLE
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can read words" ON words;
DROP POLICY IF EXISTS "Parents can insert words" ON words;
DROP POLICY IF EXISTS "Parents can update words" ON words;
DROP POLICY IF EXISTS "Parents can delete words" ON words;

-- Authenticated users can read all words
CREATE POLICY "Authenticated users can read words"
    ON words FOR SELECT
    TO authenticated
    USING (true);

-- Parents can manage words in their own lists (consolidated)
CREATE POLICY "Parents can manage words in own lists"
    ON words FOR ALL
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

-- =====================================================
-- LIST_WORDS TABLE
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can read list_words" ON list_words;
DROP POLICY IF EXISTS "Parents can insert list_words" ON list_words;
DROP POLICY IF EXISTS "Parents can update list_words" ON list_words;
DROP POLICY IF EXISTS "Parents can delete list_words" ON list_words;

-- Authenticated users can read all list_words
CREATE POLICY "Authenticated users can read list_words"
    ON list_words FOR SELECT
    TO authenticated
    USING (true);

-- Parents can manage list_words for their own lists (consolidated)
CREATE POLICY "Parents can manage own list_words"
    ON list_words FOR ALL
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

-- =====================================================
-- ATTEMPTS TABLE
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Children can insert own attempts" ON attempts;
DROP POLICY IF EXISTS "Children can read own attempts" ON attempts;
DROP POLICY IF EXISTS "Parents can read all attempts" ON attempts;

-- Children can insert their own attempts
CREATE POLICY "Children can insert own attempts"
    ON attempts FOR INSERT
    TO authenticated
    WITH CHECK (
        child_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'child'
        )
    );

-- Consolidated SELECT policy: children see own, parents see all
CREATE POLICY "Users can read appropriate attempts"
    ON attempts FOR SELECT
    TO authenticated
    USING (
        -- Children see their own attempts
        (child_id = (SELECT auth.uid())
         AND EXISTS (
             SELECT 1 FROM profiles
             WHERE profiles.id = (SELECT auth.uid())
             AND profiles.role = 'child'
         ))
        OR
        -- Parents see all attempts
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'parent'
        )
    );

-- =====================================================
-- REWARDS TABLE
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Children can insert own rewards" ON rewards;
DROP POLICY IF EXISTS "Children can read own rewards" ON rewards;
DROP POLICY IF EXISTS "Children can update own rewards" ON rewards;
DROP POLICY IF EXISTS "Parents can read all rewards" ON rewards;
DROP POLICY IF EXISTS "Parents can update all rewards" ON rewards;

-- Consolidated SELECT policy: children see own, parents see all
CREATE POLICY "Users can read appropriate rewards"
    ON rewards FOR SELECT
    TO authenticated
    USING (
        -- Children see their own rewards
        (child_id = (SELECT auth.uid())
         AND EXISTS (
             SELECT 1 FROM profiles
             WHERE profiles.id = (SELECT auth.uid())
             AND profiles.role = 'child'
         ))
        OR
        -- Parents see all rewards
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'parent'
        )
    );

-- Children can insert/update their own rewards
CREATE POLICY "Children can manage own rewards"
    ON rewards FOR ALL
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

-- Parents can update all rewards
CREATE POLICY "Parents can update all rewards"
    ON rewards FOR UPDATE
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

-- =====================================================
-- SRS TABLE
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Children can manage own SRS" ON srs;
DROP POLICY IF EXISTS "Parents can view all SRS" ON srs;

-- Consolidated SELECT policy: children see own, parents see all
CREATE POLICY "Users can read appropriate SRS"
    ON srs FOR SELECT
    TO authenticated
    USING (
        -- Children see their own SRS
        (child_id = (SELECT auth.uid())
         AND EXISTS (
             SELECT 1 FROM profiles
             WHERE profiles.id = (SELECT auth.uid())
             AND profiles.role = 'child'
         ))
        OR
        -- Parents see all SRS
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'parent'
        )
    );

-- Children can manage their own SRS (INSERT, UPDATE, DELETE)
CREATE POLICY "Children can manage own SRS"
    ON srs FOR ALL
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

-- =====================================================
-- PARENTAL_SETTINGS TABLE
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Parents can insert their own settings" ON parental_settings;
DROP POLICY IF EXISTS "Parents can update their own settings" ON parental_settings;
DROP POLICY IF EXISTS "Parents can view their own settings" ON parental_settings;

-- Parents can manage their own settings (consolidated)
CREATE POLICY "Parents can manage own settings"
    ON parental_settings FOR ALL
    TO authenticated
    USING (
        parent_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'parent'
        )
    )
    WITH CHECK (
        parent_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'parent'
        )
    );

-- =====================================================
-- SESSION_ANALYTICS TABLE
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Children can insert their own analytics" ON session_analytics;
DROP POLICY IF EXISTS "Children can view their own analytics" ON session_analytics;
DROP POLICY IF EXISTS "Parents can view all analytics" ON session_analytics;

-- Children can insert their own analytics
CREATE POLICY "Children can insert own analytics"
    ON session_analytics FOR INSERT
    TO authenticated
    WITH CHECK (
        child_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'child'
        )
    );

-- Consolidated SELECT policy: children see own, parents see all
CREATE POLICY "Users can read appropriate analytics"
    ON session_analytics FOR SELECT
    TO authenticated
    USING (
        -- Children see their own analytics
        (child_id = (SELECT auth.uid())
         AND EXISTS (
             SELECT 1 FROM profiles
             WHERE profiles.id = (SELECT auth.uid())
             AND profiles.role = 'child'
         ))
        OR
        -- Parents see all analytics
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'parent'
        )
    );

-- =====================================================
-- USER_BADGES TABLE
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Children can earn badges" ON user_badges;
DROP POLICY IF EXISTS "Children can view their own badges" ON user_badges;
DROP POLICY IF EXISTS "Parents can view all user badges" ON user_badges;

-- Children can insert their own badges
CREATE POLICY "Children can earn badges"
    ON user_badges FOR INSERT
    TO authenticated
    WITH CHECK (
        child_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'child'
        )
    );

-- Consolidated SELECT policy: children see own, parents see all
CREATE POLICY "Users can read appropriate badges"
    ON user_badges FOR SELECT
    TO authenticated
    USING (
        -- Children see their own badges
        (child_id = (SELECT auth.uid())
         AND EXISTS (
             SELECT 1 FROM profiles
             WHERE profiles.id = (SELECT auth.uid())
             AND profiles.role = 'child'
         ))
        OR
        -- Parents see all badges
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'parent'
        )
    );

-- =====================================================
-- Add helpful comments
-- =====================================================

COMMENT ON POLICY "Users can manage own profile" ON profiles IS
    'Optimized RLS: Uses (SELECT auth.uid()) to prevent per-row evaluation';

COMMENT ON POLICY "Parents can manage own word_lists" ON word_lists IS
    'Consolidated INSERT/UPDATE/DELETE for parent-owned lists with optimized auth check';

COMMENT ON POLICY "Users can read appropriate attempts" ON attempts IS
    'Consolidated SELECT: children see own, parents see all - resolves multiple permissive policies warning';

COMMENT ON POLICY "Users can read appropriate rewards" ON rewards IS
    'Consolidated SELECT: children see own, parents see all - resolves multiple permissive policies warning';

COMMENT ON POLICY "Users can read appropriate SRS" ON srs IS
    'Consolidated SELECT: children see own, parents see all - resolves multiple permissive policies warning';

COMMENT ON POLICY "Users can read appropriate analytics" ON session_analytics IS
    'Consolidated SELECT: children see own, parents see all - resolves multiple permissive policies warning';

COMMENT ON POLICY "Users can read appropriate badges" ON user_badges IS
    'Consolidated SELECT: children see own, parents see all - resolves multiple permissive policies warning';
