-- Migration: Drop Unused SRS Indexes
-- Date: November 11, 2025
-- Description: Removes 2 unused/redundant indexes identified by database health monitoring
-- Reference: db-health-report.txt findings from November 2025
--
-- Background:
-- After monitoring index usage via pg_stat_user_indexes, we identified two indexes
-- on the srs table that are either unused or redundant:
--
-- 1. idx_srs_due_date (0 scans) - Index on just due_date column
-- 2. idx_srs_child_word (0 scans) - Redundant with unique constraint index
--
-- This migration safely removes these indexes to:
-- - Reduce storage overhead
-- - Improve write performance on srs table
-- - Eliminate duplicate index maintenance
--
-- Data integrity is fully preserved - the UNIQUE constraint remains intact.

-- ============================================================================
-- Drop idx_srs_due_date
-- ============================================================================
-- This index on just due_date is unused because all queries filter by child_id first,
-- and the composite index idx_srs_child_due covers all due date queries.
--
-- Queries analyzed:
-- - getDueWords() in supa.ts (line 665-670): Filters by child_id AND due_date <= today
--   → Uses idx_srs_child_due composite index (child_id, due_date)
-- - get_next_batch() function (migration 20251109235400, line 152): Filters by child_id AND due_date
--   → Uses idx_srs_child_due composite index (child_id, due_date)
--
-- No application queries use this standalone due_date index because PostgreSQL query
-- planner prefers the composite index that covers both columns.

DROP INDEX IF EXISTS public.idx_srs_due_date;

-- ============================================================================
-- Drop idx_srs_child_word
-- ============================================================================
-- This index is redundant with the unique constraint on (child_id, word_id).
-- PostgreSQL automatically creates an index (srs_child_id_word_id_key) to enforce
-- the unique constraint, making this manual index unnecessary.
--
-- The UNIQUE constraint remains intact, ensuring no duplicate (child_id, word_id) pairs.
--
-- Queries analyzed:
-- - getSrsEntry() in supa.ts (line 581-586): Queries by child_id and word_id
--   → Uses unique constraint index srs_child_id_word_id_key
-- - upsertSrsEntry() in supa.ts (line 610): Uses onConflict: "child_id,word_id"
--   → Requires unique constraint (remains intact)
-- - Sync operations in sync.ts (line 902-906): Queries by child_id and word_id
--   → Uses unique constraint index srs_child_id_word_id_key
--
-- All queries will continue to use the unique constraint's backing index efficiently.

DROP INDEX IF EXISTS public.idx_srs_child_word;

-- ============================================================================
-- Verification
-- ============================================================================
-- After this migration, the srs table will have the following indexes:
--
-- 1. Primary key index on `id` (automatic)
-- 2. idx_srs_child_due on (child_id, due_date) - For due word queries
-- 3. srs_child_id_word_id_key on (child_id, word_id) - Unique constraint index for lookups
-- 4. idx_srs_last_reviewed on last_reviewed - For leech detection
--
-- All application queries will continue to function optimally with these indexes.

-- ============================================================================
-- Rollback Instructions (for reference - not recommended)
-- ============================================================================
-- If you need to recreate these indexes (not recommended), use:
--
-- CREATE INDEX idx_srs_due_date ON public.srs(due_date);
-- CREATE INDEX idx_srs_child_word ON public.srs(child_id, word_id);
--
-- However, these indexes provide no performance benefit and only add overhead.
