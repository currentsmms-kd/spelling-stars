-- Parent Analytics Views and RPC Functions
-- Implements analytics features from Prompt D2: Parent Dashboard + Progress & Reports

-- ============================================================================
-- VIEW: view_child_mastery
-- Shows mastery status per child/list with accuracy and last practice date
-- ============================================================================

CREATE OR REPLACE VIEW view_child_mastery AS
SELECT
    a.child_id,
    lw.list_id,
    wl.title AS list_title,
    COUNT(DISTINCT a.word_id) AS mastered_count,
    COUNT(DISTINCT lw.word_id) AS total_words_in_list,
    ROUND(
        (COUNT(DISTINCT CASE WHEN a.correct THEN a.word_id END)::DECIMAL /
         NULLIF(COUNT(DISTINCT a.word_id), 0)) * 100,
        2
    ) AS accuracy,
    MAX(a.started_at) AS last_practiced_at,
    -- Calculate mastery percentage
    ROUND(
        (COUNT(DISTINCT CASE WHEN s.ease >= 2.5 AND s.interval_days >= 7 THEN a.word_id END)::DECIMAL /
         NULLIF(COUNT(DISTINCT lw.word_id), 0)) * 100,
        2
    ) AS mastery_percentage
FROM attempts a
JOIN list_words lw ON a.word_id = lw.word_id
JOIN word_lists wl ON lw.list_id = wl.id
LEFT JOIN srs s ON s.child_id = a.child_id AND s.word_id = a.word_id
GROUP BY a.child_id, lw.list_id, wl.title;

-- Grant access to authenticated users
GRANT SELECT ON view_child_mastery TO authenticated;

-- Note: Views cannot have RLS policies directly
-- Access control is inherited from the base tables (attempts, list_words, word_lists, srs)

-- ============================================================================
-- VIEW: view_ngram_errors
-- Analyzes common n-gram spelling mistakes across attempts
-- ============================================================================

CREATE OR REPLACE VIEW view_ngram_errors AS
WITH error_attempts AS (
    -- Get all incorrect attempts with both expected and typed text
    SELECT
        a.child_id,
        a.word_id,
        w.text AS expected_word,
        LOWER(a.typed_answer) AS typed_word,
        a.started_at
    FROM attempts a
    JOIN words w ON a.word_id = w.id
    WHERE a.correct = FALSE
    AND a.typed_answer IS NOT NULL
    AND a.mode = 'listen-type' -- Only analyze typed spelling
),
bigram_errors AS (
    -- Extract 2-character patterns (bigrams)
    SELECT
        child_id,
        word_id,
        -- Get bigrams from expected word
        SUBSTRING(expected_word FROM i FOR 2) AS expected_ngram,
        -- Get corresponding position from typed word
        SUBSTRING(typed_word FROM i FOR 2) AS typed_ngram,
        started_at,
        i AS position
    FROM error_attempts
    CROSS JOIN generate_series(1, LENGTH(expected_word) - 1) AS i
    WHERE SUBSTRING(expected_word FROM i FOR 2) != SUBSTRING(typed_word FROM i FOR 2)
),
trigram_errors AS (
    -- Extract 3-character patterns (trigrams)
    SELECT
        child_id,
        word_id,
        SUBSTRING(expected_word FROM i FOR 3) AS expected_ngram,
        SUBSTRING(typed_word FROM i FOR 3) AS typed_ngram,
        started_at,
        i AS position
    FROM error_attempts
    CROSS JOIN generate_series(1, LENGTH(expected_word) - 2) AS i
    WHERE SUBSTRING(expected_word FROM i FOR 3) != SUBSTRING(typed_word FROM i FOR 3)
)
-- Combine bigrams and trigrams
SELECT
    child_id,
    expected_ngram AS ngram,
    2 AS ngram_length,
    typed_ngram,
    COUNT(*) AS error_count,
    MAX(started_at) AS last_seen,
    ARRAY_AGG(DISTINCT word_id) AS affected_word_ids
FROM bigram_errors
GROUP BY child_id, expected_ngram, typed_ngram

UNION ALL

SELECT
    child_id,
    expected_ngram AS ngram,
    3 AS ngram_length,
    typed_ngram,
    COUNT(*) AS error_count,
    MAX(started_at) AS last_seen,
    ARRAY_AGG(DISTINCT word_id) AS affected_word_ids
FROM trigram_errors
GROUP BY child_id, expected_ngram, typed_ngram;

-- Grant access to authenticated users
GRANT SELECT ON view_ngram_errors TO authenticated;

-- Note: Views cannot have RLS policies directly
-- Access control is inherited from the base tables (attempts, words)

-- ============================================================================
-- RPC FUNCTION: get_parent_overview
-- Comprehensive analytics query for parent dashboard
-- ============================================================================

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
                        WHERE role = 'child' AND created_by = p_parent_id
                    )
                    AND sa.session_date >= (
                        -- Find the last gap in practice
                        SELECT COALESCE(MAX(DATE(session_date)), CURRENT_DATE - INTERVAL '365 days')
                        FROM session_analytics
                        WHERE child_id IN (
                            SELECT id FROM profiles
                            WHERE role = 'child' AND created_by = p_parent_id
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
                WHERE role = 'child' AND created_by = p_parent_id
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
                WHERE role = 'child' AND created_by = p_parent_id
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
                    WHERE role = 'child' AND created_by = p_parent_id
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
                    WHERE role = 'child' AND created_by = p_parent_id
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
                WHERE role = 'child' AND created_by = p_parent_id
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
                WHERE role = 'child' AND created_by = p_parent_id
            )
            AND DATE(sa.session_date) >= v_date_from
            AND DATE(sa.session_date) <= v_date_to
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_parent_overview(UUID, DATE, DATE) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_parent_overview IS
'Returns comprehensive analytics for parent dashboard including KPIs, hardest words, mistake patterns, and charts data';

-- ============================================================================
-- Helper function: Check if word is mastered
-- A word is considered mastered if ease >= 2.5 and interval >= 7 days
-- ============================================================================

CREATE OR REPLACE FUNCTION is_word_mastered(p_child_id UUID, p_word_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM srs
        WHERE child_id = p_child_id
        AND word_id = p_word_id
        AND ease >= 2.5
        AND interval_days >= 7
    );
END;
$$;

GRANT EXECUTE ON FUNCTION is_word_mastered(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION is_word_mastered IS
'Checks if a word is considered mastered for a specific child (ease >= 2.5, interval >= 7 days)';

