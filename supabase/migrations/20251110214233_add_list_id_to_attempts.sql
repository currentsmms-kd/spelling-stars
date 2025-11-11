-- Migration: Re-add list_id to attempts table for list-scoped analytics
-- This field was removed in 20241108000003 but is needed for tracking
-- which list a word was practiced from, enabling list-specific reports

-- Step 1: Add list_id column (nullable initially to allow existing data)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='attempts' AND column_name='list_id') THEN
        ALTER TABLE attempts ADD COLUMN list_id UUID;

        -- Add comment explaining the column
        COMMENT ON COLUMN attempts.list_id IS 'Foreign key to word_lists - tracks which list the word was practiced from for list-scoped analytics';
    END IF;
END $$;

-- Step 2: Populate list_id for existing attempts by looking up through list_words
-- This backfills historical data so analytics can work retroactively
UPDATE attempts a
SET list_id = lw.list_id
FROM list_words lw
WHERE a.word_id = lw.word_id
  AND a.list_id IS NULL;

-- Step 3: Add foreign key constraint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name='attempts_list_id_fkey'
                   AND table_name='attempts') THEN
        ALTER TABLE attempts
        ADD CONSTRAINT attempts_list_id_fkey
        FOREIGN KEY (list_id) REFERENCES word_lists(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 4: Make list_id NOT NULL now that existing data is backfilled
-- Note: New attempts must include list_id from this point forward
DO $$
BEGIN
    -- Only set NOT NULL if all existing attempts have been backfilled
    IF NOT EXISTS (SELECT 1 FROM attempts WHERE list_id IS NULL) THEN
        ALTER TABLE attempts ALTER COLUMN list_id SET NOT NULL;
    ELSE
        -- Log warning if there are still NULL values (shouldn't happen if backfill worked)
        RAISE WARNING 'Some attempts still have NULL list_id after backfill - skipping NOT NULL constraint';
    END IF;
END $$;

-- Step 5: Re-create index for list_id queries
CREATE INDEX IF NOT EXISTS idx_attempts_list_id ON attempts(list_id);

-- Step 6: Update RLS policies to support list_id
-- Parents can view attempts for words in their lists
DROP POLICY IF EXISTS "Parents can view attempts for their lists" ON attempts;

CREATE POLICY "Parents can view attempts for their lists"
    ON attempts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM word_lists wl
            WHERE wl.id = attempts.list_id
            AND wl.created_by = auth.uid()
        )
    );

-- Step 7: Verify the schema change
DO $$
BEGIN
    -- Verify list_id column exists with correct properties
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='attempts'
        AND column_name='list_id'
        AND data_type='uuid'
    ) THEN
        RAISE EXCEPTION 'list_id column not properly created on attempts table';
    END IF;

    -- Verify foreign key constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name='attempts_list_id_fkey'
        AND table_name='attempts'
    ) THEN
        RAISE EXCEPTION 'Foreign key constraint attempts_list_id_fkey not created';
    END IF;

    -- Verify index exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename='attempts'
        AND indexname='idx_attempts_list_id'
    ) THEN
        RAISE EXCEPTION 'Index idx_attempts_list_id not created';
    END IF;

    RAISE NOTICE 'Migration completed successfully: list_id added to attempts table';
END $$;
