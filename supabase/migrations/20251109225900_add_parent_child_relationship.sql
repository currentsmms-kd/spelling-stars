-- Add parent-child relationship to profiles table
-- This enables proper child account management and analytics filtering

-- Add parent_id column to profiles table (nullable - parents won't have a parent_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='profiles' AND column_name='parent_id'
    ) THEN
        ALTER TABLE profiles
        ADD COLUMN parent_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

        -- Add index for performance
        CREATE INDEX idx_profiles_parent_id ON profiles(parent_id);

        -- Add comment for documentation
        COMMENT ON COLUMN profiles.parent_id IS
        'Reference to parent profile for child accounts. NULL for parent accounts.';
    END IF;
END $$;

-- Update RLS policies to support parent-child relationships
-- Parents can view their children's profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile or their children"
    ON profiles
    FOR SELECT
    USING (
        id = auth.uid()
        OR parent_id = auth.uid()
    );

-- Parents can update their children's profiles
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile or their children"
    ON profiles
    FOR UPDATE
    USING (
        id = auth.uid()
        OR parent_id = auth.uid()
    )
    WITH CHECK (
        id = auth.uid()
        OR parent_id = auth.uid()
    );

-- Update get_parent_overview function to use parent_id instead of created_by
CREATE OR REPLACE FUNCTION get_parent_overview(
    p_parent_id UUID,
    p_date_from DATE DEFAULT NULL,
    p_date_to DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSON;
    v_date_from DATE;
    v_date_to DATE;
BEGIN
    -- Default date range: last 30 days if not specified
    v_date_from := COALESCE(p_date_from, CURRENT_DATE - INTERVAL '30 days');
    v_date_to := COALESCE(p_date_to, CURRENT_DATE);

    -- Build comprehensive JSON response
    SELECT json_build_object(
        'summary', (
            SELECT json_build_object(
                'total_words_mastered', COUNT(DISTINCT CASE
                    WHEN s.ease >= 2.5 AND s.interval_days >= 7 THEN s.word_id
                END),
                'current_streak_days', (
                    -- Calculate consecutive days with practice
                    SELECT COUNT(DISTINCT DATE(sa.session_date))
                    FROM session_analytics sa
                    WHERE sa.child_id IN (
                        SELECT id FROM profiles
                        WHERE parent_id = p_parent_id
                    )
                    AND sa.session_date >= (
                        -- Find the last gap in practice
                        SELECT COALESCE(MAX(DATE(session_date)), CURRENT_DATE - INTERVAL '365 days')
                        FROM session_analytics
                        WHERE child_id IN (
                            SELECT id FROM profiles
                            WHERE parent_id = p_parent_id
                        )
                        AND session_date < CURRENT_DATE
                        AND NOT EXISTS (
                            SELECT 1 FROM session_analytics sa2
                            WHERE sa2.child_id = session_analytics.child_id
                            AND DATE(sa2.session_date) = DATE(session_analytics.session_date) + INTERVAL '1 day'
                        )
                    )
                ),
                'avg_accuracy_7d', ROUND(
                    AVG(CASE
                        WHEN sa.total_attempts > 0
                        THEN (sa.correct_on_first_try::DECIMAL / sa.total_attempts) * 100
                    END)::NUMERIC, 2
                ),
                'avg_accuracy_30d', ROUND(
                    AVG(CASE
                        WHEN sa.total_attempts > 0
                        THEN (sa.correct_on_first_try::DECIMAL / sa.total_attempts) * 100
                    END)::NUMERIC, 2
                ),
                'total_time_on_task_minutes', SUM(sa.session_duration_seconds) / 60,
                'total_sessions', COUNT(DISTINCT sa.id)
            )
            FROM session_analytics sa
            WHERE sa.child_id IN (
                SELECT id FROM profiles
                WHERE parent_id = p_parent_id
            )
            AND DATE(sa.session_date) >= v_date_from
            AND DATE(sa.session_date) <= v_date_to
        ),
        'hardest_words', (
            SELECT json_agg(
                json_build_object(
                    'word', w.text,
                    'word_id', s.word_id,
                    'ease', s.ease,
                    'error_rate', ROUND(
                        (s.lapses::DECIMAL / NULLIF(s.reps, 0)) * 100, 2
                    ),
                    'last_attempted', s.updated_at
                )
            )
            FROM srs s
            JOIN words w ON s.word_id = w.id
            WHERE s.child_id IN (
                SELECT id FROM profiles
                WHERE parent_id = p_parent_id
            )
            AND s.reps > 0
            ORDER BY s.ease ASC, s.lapses DESC
            LIMIT 10
        ),
        'common_mistake_patterns', (
            SELECT json_agg(
                json_build_object(
                    'pattern', ngram,
                    'common_error', typed_ngram,
                    'occurrences', error_count,
                    'last_seen', last_seen
                )
            )
            FROM (
                SELECT
                    ngram,
                    typed_ngram,
                    SUM(error_count) AS error_count,
                    MAX(last_seen) AS last_seen
                FROM view_ngram_errors
                WHERE child_id IN (
                    SELECT id FROM profiles
                    WHERE parent_id = p_parent_id
                )
                AND DATE(last_seen) >= v_date_from
                AND DATE(last_seen) <= v_date_to
                GROUP BY ngram, typed_ngram
                ORDER BY error_count DESC
                LIMIT 10
            ) AS top_patterns
        ),
        'attempts_by_mode', (
            SELECT json_object_agg(mode, attempt_count)
            FROM (
                SELECT
                    mode,
                    COUNT(*) AS attempt_count
                FROM attempts a
                WHERE a.child_id IN (
                    SELECT id FROM profiles
                    WHERE parent_id = p_parent_id
                )
                AND DATE(a.started_at) >= v_date_from
                AND DATE(a.started_at) <= v_date_to
                GROUP BY mode
            ) AS mode_counts
        ),
        'mastery_by_list', (
            SELECT json_agg(
                json_build_object(
                    'list_id', list_id,
                    'list_title', list_title,
                    'mastered_count', mastered_count,
                    'total_words', total_words_in_list,
                    'mastery_percentage', mastery_percentage,
                    'accuracy', accuracy
                )
            )
            FROM view_child_mastery
            WHERE child_id IN (
                SELECT id FROM profiles
                WHERE parent_id = p_parent_id
            )
        ),
        'accuracy_over_time', (
            SELECT json_agg(
                json_build_object(
                    'date', session_date,
                    'accuracy', ROUND(
                        CASE
                            WHEN total_attempts > 0
                            THEN (correct_on_first_try::DECIMAL / total_attempts) * 100
                            ELSE 0
                        END::NUMERIC, 2
                    ),
                    'attempts', total_attempts
                )
                ORDER BY session_date
            )
            FROM session_analytics sa
            WHERE sa.child_id IN (
                SELECT id FROM profiles
                WHERE parent_id = p_parent_id
            )
            AND DATE(sa.session_date) >= v_date_from
            AND DATE(sa.session_date) <= v_date_to
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- Update getChildrenForParent function to use parent_id
CREATE OR REPLACE FUNCTION get_children_for_parent(p_parent_id UUID)
RETURNS TABLE (
    id UUID,
    email TEXT,
    display_name TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.email,
        p.display_name,
        p.created_at
    FROM profiles p
    WHERE p.parent_id = p_parent_id
    AND p.role = 'child'
    ORDER BY p.created_at DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_children_for_parent(UUID) TO authenticated;

COMMENT ON FUNCTION get_children_for_parent IS
'Returns all child profiles for a given parent ID';

-- Add helper function to set parent_id during child creation
CREATE OR REPLACE FUNCTION set_child_parent_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- If this is a child account and parent_id is not set,
    -- try to set it from the creating user's context
    IF NEW.role = 'child' AND NEW.parent_id IS NULL THEN
        -- In a real implementation, you might get parent_id from app metadata
        -- For now, this is a placeholder that could be enhanced
        NULL;
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger (but don't activate yet - needs app-level logic)
DROP TRIGGER IF EXISTS trigger_set_child_parent_id ON profiles;
-- Uncomment when ready to use:
-- CREATE TRIGGER trigger_set_child_parent_id
--     BEFORE INSERT ON profiles
--     FOR EACH ROW
--     EXECUTE FUNCTION set_child_parent_id();

COMMENT ON FUNCTION set_child_parent_id IS
'Trigger function to automatically set parent_id for child accounts during creation';
