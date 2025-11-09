-- Add spaced repetition system (SRS) table
-- Uses SM-2-lite algorithm for tracking word difficulty and scheduling

CREATE TABLE IF NOT EXISTS srs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    child_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    word_id uuid NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    ease real DEFAULT 2.5 NOT NULL CHECK (ease >= 1.3),
    interval_days integer DEFAULT 0 NOT NULL CHECK (interval_days >= 0),
    due_date date DEFAULT CURRENT_DATE NOT NULL,
    reps integer DEFAULT 0 NOT NULL CHECK (reps >= 0),
    lapses integer DEFAULT 0 NOT NULL CHECK (lapses >= 0),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(child_id, word_id)
);

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_srs_child_due ON srs(child_id, due_date);
CREATE INDEX IF NOT EXISTS idx_srs_child_word ON srs(child_id, word_id);
CREATE INDEX IF NOT EXISTS idx_srs_due_date ON srs(due_date);

-- Enable RLS
ALTER TABLE srs ENABLE ROW LEVEL SECURITY;

-- RLS policies mirroring attempts table structure
-- Children can manage their own SRS entries
CREATE POLICY "Children can manage own SRS"
    ON srs FOR ALL
    TO authenticated
    USING (
        auth.uid() = child_id
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'child'
        )
    )
    WITH CHECK (
        auth.uid() = child_id
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'child'
        )
    );

-- Parents can view all SRS entries (for reporting)
CREATE POLICY "Parents can view all SRS"
    ON srs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'parent'
        )
    );

-- Service role full access
CREATE POLICY "Service role full access on SRS"
    ON srs FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_srs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_srs_updated_at
    BEFORE UPDATE ON srs
    FOR EACH ROW
    EXECUTE FUNCTION update_srs_updated_at();

-- Add comment to table for documentation
COMMENT ON TABLE srs IS 'Spaced repetition system tracking word difficulty and review schedule using SM-2-lite algorithm';
COMMENT ON COLUMN srs.ease IS 'Ease factor (>=1.3), increases on correct answers, decreases on misses';
COMMENT ON COLUMN srs.interval_days IS 'Days until next review, 0 means due immediately';
COMMENT ON COLUMN srs.due_date IS 'Date when word should be reviewed next';
COMMENT ON COLUMN srs.reps IS 'Number of successful repetitions';
COMMENT ON COLUMN srs.lapses IS 'Number of times word was missed (not first-try correct)';
