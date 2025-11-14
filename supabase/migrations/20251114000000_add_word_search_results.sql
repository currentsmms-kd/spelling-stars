-- Migration: Word Search result tracking & RPC helper
-- Adds table + RLS policies + helper function for recording puzzle sessions

CREATE TABLE IF NOT EXISTS word_search_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    list_id UUID REFERENCES word_lists(id) ON DELETE SET NULL,
    seed BIGINT NOT NULL CHECK (seed > 0),
    duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
    total_words INTEGER NOT NULL DEFAULT 0 CHECK (total_words >= 0),
    found_words INTEGER NOT NULL DEFAULT 0 CHECK (found_words >= 0),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_word_search_results_child
    ON word_search_results(child_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_word_search_results_list
    ON word_search_results(list_id, created_at DESC);

COMMENT ON TABLE word_search_results IS 'Tracks each completed word search puzzle for child profiles';
COMMENT ON COLUMN word_search_results.child_id IS 'Child profile that played the puzzle';
COMMENT ON COLUMN word_search_results.list_id IS 'Spelling list that generated the puzzle (nullable for demo lists)';
COMMENT ON COLUMN word_search_results.seed IS 'Deterministic seed used to generate the puzzle layout';
COMMENT ON COLUMN word_search_results.duration_seconds IS 'How long the puzzle took to complete, in seconds';
COMMENT ON COLUMN word_search_results.total_words IS 'How many words were successfully placed on the grid';
COMMENT ON COLUMN word_search_results.found_words IS 'How many placed words the child found';
COMMENT ON COLUMN word_search_results.metadata IS 'Additional context like grid size, options, or unplaced words';

ALTER TABLE word_search_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Children can insert own word search results"
    ON word_search_results FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = child_id
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'child'
        )
    );

CREATE POLICY "Children can read own word search results"
    ON word_search_results FOR SELECT
    TO authenticated
    USING (auth.uid() = child_id);

CREATE POLICY "Parents can read all word search results"
    ON word_search_results FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
        )
    );

CREATE OR REPLACE FUNCTION record_word_search_result(
    p_list_id UUID,
    p_seed BIGINT,
    p_duration_seconds INTEGER,
    p_total_words INTEGER,
    p_found_words INTEGER,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS word_search_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_child_id UUID;
    v_role TEXT;
    v_result word_search_results%ROWTYPE;
BEGIN
    v_child_id := auth.uid();
    IF v_child_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT role INTO v_role FROM profiles WHERE id = v_child_id;

    IF v_role IS DISTINCT FROM 'child' THEN
        RAISE EXCEPTION 'Only child profiles can record word search puzzles';
    END IF;

    INSERT INTO word_search_results (
        child_id,
        list_id,
        seed,
        duration_seconds,
        total_words,
        found_words,
        metadata
    )
    VALUES (
        v_child_id,
        p_list_id,
        GREATEST(1, COALESCE(p_seed, 1)),
        GREATEST(0, COALESCE(p_duration_seconds, 0)),
        GREATEST(0, COALESCE(p_total_words, 0)),
        GREATEST(0, COALESCE(p_found_words, 0)),
        COALESCE(p_metadata, '{}'::jsonb)
    )
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION record_word_search_result IS
'Records a completed word search puzzle for the authenticated child and returns the stored row.';
