-- Ensure attempts.list_id analytics are index-backed for parent dashboard performance
-- Adds a dedicated index on list_id and a composite index for list_id + child_id filters

-- Single-column index for list-scoped analytics
CREATE INDEX IF NOT EXISTS idx_attempts_list_id ON attempts(list_id);

-- Composite index to accelerate queries filtered by list + child
CREATE INDEX IF NOT EXISTS idx_attempts_list_child ON attempts(list_id, child_id);

-- Verify indexes exist and log the outcome
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'attempts'
          AND indexname = 'idx_attempts_list_id'
    ) THEN
        RAISE NOTICE 'Index idx_attempts_list_id present';
    ELSE
        RAISE WARNING 'Index idx_attempts_list_id missing after migration';
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'attempts'
          AND indexname = 'idx_attempts_list_child'
    ) THEN
        RAISE NOTICE 'Index idx_attempts_list_child present';
    ELSE
        RAISE WARNING 'Index idx_attempts_list_child missing after migration';
    END IF;
END $$;

-- Document index purpose for future contributors
COMMENT ON INDEX idx_attempts_list_id IS 'Optimizes list-scoped analytics queries for parent dashboard views';
COMMENT ON INDEX idx_attempts_list_child IS 'Optimizes parent dashboard queries filtered by list and child';
