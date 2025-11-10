-- Migration: Add D3 Spaced Repetition Scheduler Features
-- Adds quality field to attempts, strict spaced mode toggle, and scheduler support

-- Step 1: Add quality field to attempts table
-- Quality represents how well the word was answered (0-5):
-- 5 = perfect (correct first try, no hesitation)
-- 4 = minor hesitation (correct first try with pause)
-- 3 = correct after hint
-- 2 = wrong then correct (second try)
-- 1 = wrong (failed attempt)
-- 0 = no attempt
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'attempts' AND column_name = 'quality'
    ) THEN
        ALTER TABLE attempts ADD COLUMN quality INTEGER DEFAULT NULL CHECK (quality >= 0 AND quality <= 5);

        -- Create index for quality-based queries (leeches, etc.)
        CREATE INDEX IF NOT EXISTS idx_attempts_quality ON attempts(quality);

        COMMENT ON COLUMN attempts.quality IS 'Quality score 0-5: 5=perfect, 4=minor hesitation, 3=correct after hint, 2=wrong then correct, 1=wrong, 0=no attempt';
    END IF;
END $$;

-- Step 2: Add strict_spaced_mode to parental_settings
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'parental_settings' AND column_name = 'strict_spaced_mode'
    ) THEN
        ALTER TABLE parental_settings ADD COLUMN strict_spaced_mode BOOLEAN DEFAULT false;

        COMMENT ON COLUMN parental_settings.strict_spaced_mode IS 'When enabled, only serves due words and leeches (high error rate words) to the child';
    END IF;
END $$;

-- Step 3: Create function to compute quality from attempt result
-- This can be called when creating attempts to automatically set quality
CREATE OR REPLACE FUNCTION compute_attempt_quality(
    p_correct BOOLEAN,
    p_is_first_try BOOLEAN,
    p_used_hint BOOLEAN DEFAULT false
) RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF NOT p_correct THEN
        RETURN 1; -- Wrong answer
    END IF;

    IF p_is_first_try THEN
        IF p_used_hint THEN
            RETURN 3; -- Correct after hint
        ELSE
            RETURN 5; -- Perfect (correct first try)
        END IF;
    ELSE
        RETURN 2; -- Wrong then correct (second try)
    END IF;
END;
$$;

COMMENT ON FUNCTION compute_attempt_quality IS 'Computes quality score (0-5) from attempt result for spaced repetition algorithm';

-- Step 4: Add helper columns to SRS for leech detection
DO $$
BEGIN
    -- Add last_reviewed timestamp to track when word was last practiced
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'srs' AND column_name = 'last_reviewed'
    ) THEN
        ALTER TABLE srs ADD COLUMN last_reviewed TIMESTAMPTZ DEFAULT now();
        CREATE INDEX IF NOT EXISTS idx_srs_last_reviewed ON srs(last_reviewed);
    END IF;
END $$;

-- Step 5: Create view for identifying "leech" words (high error rate)
-- Leeches are words that have been attempted multiple times but still have low ease or high lapses
CREATE OR REPLACE VIEW srs_leeches AS
SELECT
    s.*,
    w.text as word_text,
    w.phonetic,
    CAST(s.lapses AS FLOAT) / NULLIF(s.reps + s.lapses, 0) as error_rate
FROM srs s
JOIN words w ON s.word_id = w.id
WHERE s.reps + s.lapses >= 3  -- At least 3 total attempts
  AND (
    s.ease <= 1.8  -- Low ease factor
    OR CAST(s.lapses AS FLOAT) / NULLIF(s.reps + s.lapses, 0) >= 0.4  -- 40%+ error rate
  );

COMMENT ON VIEW srs_leeches IS 'Words with high error rates that need extra practice (leeches)';

-- Step 6: Create function to get next practice batch with smart scheduling
-- Implements the D3 requirement: due words + 20% leeches + 10% near-future review
CREATE OR REPLACE FUNCTION get_next_batch(
    p_child_id UUID,
    p_list_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 15,
    p_strict_mode BOOLEAN DEFAULT false
) RETURNS TABLE (
    word_id UUID,
    word_text TEXT,
    word_phonetic TEXT,
    word_prompt_audio_path TEXT,
    word_tts_voice TEXT,
    due_date DATE,
    ease REAL,
    interval_days INTEGER,
    reps INTEGER,
    lapses INTEGER,
    batch_type TEXT  -- 'due', 'leech', 'review', or 'new'
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_due_count INTEGER;
    v_leech_count INTEGER;
    v_review_count INTEGER;
    v_target_leech_count INTEGER;
    v_target_review_count INTEGER;
BEGIN
    -- Calculate target counts based on limit
    v_target_leech_count := CEIL(p_limit * 0.2);  -- 20% leeches
    v_target_review_count := CEIL(p_limit * 0.1); -- 10% near-future review

    -- Return due words (priority 1)
    RETURN QUERY
    WITH due_words AS (
        SELECT
            s.word_id,
            w.text as word_text,
            w.phonetic as word_phonetic,
            w.prompt_audio_path as word_prompt_audio_path,
            w.tts_voice as word_tts_voice,
            s.due_date,
            s.ease,
            s.interval_days,
            s.reps,
            s.lapses,
            'due'::TEXT as batch_type
        FROM srs s
        JOIN words w ON s.word_id = w.id
        WHERE s.child_id = p_child_id
          AND s.due_date <= CURRENT_DATE
          AND (p_list_id IS NULL OR EXISTS (
              SELECT 1 FROM list_words lw
              WHERE lw.word_id = s.word_id AND lw.list_id = p_list_id
          ))
        ORDER BY s.due_date ASC, s.ease ASC
        LIMIT p_limit
    ),
    leech_words AS (
        SELECT
            l.word_id,
            l.word_text,
            l.phonetic as word_phonetic,
            w.prompt_audio_path as word_prompt_audio_path,
            w.tts_voice as word_tts_voice,
            l.due_date,
            l.ease,
            l.interval_days,
            l.reps,
            l.lapses,
            'leech'::TEXT as batch_type
        FROM srs_leeches l
        JOIN words w ON l.word_id = w.id
        WHERE l.child_id = p_child_id
          AND NOT EXISTS (SELECT 1 FROM due_words WHERE due_words.word_id = l.word_id)
          AND (p_list_id IS NULL OR EXISTS (
              SELECT 1 FROM list_words lw
              WHERE lw.word_id = l.word_id AND lw.list_id = p_list_id
          ))
        ORDER BY l.error_rate DESC, l.lapses DESC
        LIMIT v_target_leech_count
    ),
    review_words AS (
        SELECT
            s.word_id,
            w.text as word_text,
            w.phonetic as word_phonetic,
            w.prompt_audio_path as word_prompt_audio_path,
            w.tts_voice as word_tts_voice,
            s.due_date,
            s.ease,
            s.interval_days,
            s.reps,
            s.lapses,
            'review'::TEXT as batch_type
        FROM srs s
        JOIN words w ON s.word_id = w.id
        WHERE s.child_id = p_child_id
          AND s.due_date BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 7  -- Due in next week
          AND NOT EXISTS (SELECT 1 FROM due_words WHERE due_words.word_id = s.word_id)
          AND NOT EXISTS (SELECT 1 FROM leech_words WHERE leech_words.word_id = s.word_id)
          AND NOT p_strict_mode  -- Only include if not in strict mode
          AND (p_list_id IS NULL OR EXISTS (
              SELECT 1 FROM list_words lw
              WHERE lw.word_id = s.word_id AND lw.list_id = p_list_id
          ))
        ORDER BY s.due_date ASC
        LIMIT v_target_review_count
    ),
    new_words AS (
        SELECT
            w.id as word_id,
            w.text as word_text,
            w.phonetic as word_phonetic,
            w.prompt_audio_path as word_prompt_audio_path,
            w.tts_voice as word_tts_voice,
            CURRENT_DATE as due_date,
            2.5::REAL as ease,
            0 as interval_days,
            0 as reps,
            0 as lapses,
            'new'::TEXT as batch_type
        FROM words w
        WHERE NOT EXISTS (
            SELECT 1 FROM srs s
            WHERE s.word_id = w.id AND s.child_id = p_child_id
        )
        AND NOT p_strict_mode  -- Only include if not in strict mode
        AND (p_list_id IS NULL OR EXISTS (
            SELECT 1 FROM list_words lw
            WHERE lw.word_id = w.id AND lw.list_id = p_list_id
        ))
        ORDER BY RANDOM()
        LIMIT (p_limit - (SELECT COUNT(*) FROM due_words) - v_target_leech_count - v_target_review_count)
    )
    SELECT * FROM due_words
    UNION ALL
    SELECT * FROM leech_words
    UNION ALL
    SELECT * FROM review_words
    UNION ALL
    SELECT * FROM new_words
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_next_batch IS 'Smart scheduler that returns next practice batch: due words + 20% leeches + 10% near-future review. Set strict_mode=true to only get due words and leeches.';

-- Step 7: Update trigger to set last_reviewed on SRS updates
CREATE OR REPLACE FUNCTION update_srs_last_reviewed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.last_reviewed = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_srs_last_reviewed ON srs;
CREATE TRIGGER set_srs_last_reviewed
    BEFORE UPDATE ON srs
    FOR EACH ROW
    EXECUTE FUNCTION update_srs_last_reviewed();

COMMENT ON FUNCTION update_srs_last_reviewed IS 'Automatically updates last_reviewed timestamp when SRS entry is modified';

-- Step 8: Grant permissions
GRANT SELECT ON srs_leeches TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_batch TO authenticated;
GRANT EXECUTE ON FUNCTION compute_attempt_quality TO authenticated;
