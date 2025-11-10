-- Add Performance Indexes
-- Migration to add critical indexes identified by database advisor
-- These indexes improve query performance for frequently accessed data patterns

-- Index for attempts table filtering by child_id and word_id
-- Used by: useCreateAttempt(), attempt history queries
-- Improves performance when fetching attempt history for specific child/word combinations
CREATE INDEX IF NOT EXISTS idx_attempts_child_word
ON attempts(child_id, word_id);

-- Index for list_words table filtering by list_id
-- Used by: useWordList(), word reordering operations
-- Improves performance when fetching all words in a list (very common operation)
CREATE INDEX IF NOT EXISTS idx_list_words_list_id
ON list_words(list_id);

-- Add comment explaining index usage
COMMENT ON INDEX idx_attempts_child_word IS
'Composite index for filtering attempts by child and word - used in attempt history queries';

COMMENT ON INDEX idx_list_words_list_id IS
'Index for fetching all words in a list - critical for list display and word management';
