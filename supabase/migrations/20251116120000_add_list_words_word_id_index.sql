-- Add Index for list_words.word_id
-- Migration to add missing foreign key index
-- This index improves performance when deleting words that appear in multiple lists

-- Index for list_words table filtering by word_id
-- Used by: Word deletion operations, finding which lists contain a specific word
-- Improves performance when deleting words or finding all lists that reference a word
CREATE INDEX IF NOT EXISTS idx_list_words_word_id
ON list_words(word_id);

-- Add comment explaining index usage
COMMENT ON INDEX idx_list_words_word_id IS
'Index for foreign key constraint on word_id - improves word deletion performance and reverse list lookups';
