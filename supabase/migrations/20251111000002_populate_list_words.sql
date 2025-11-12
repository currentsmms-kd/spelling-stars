-- Migration: Verify list_words data integrity
-- Problem: RLS policy requires words to be in list_words junction table
-- Solution: Verify all words have corresponding list_words entries

-- Verification and diagnostic query
DO $$
DECLARE
    words_count INTEGER;
    list_words_count INTEGER;
    orphaned_words INTEGER;
BEGIN
    -- Count total words
    SELECT COUNT(*) INTO words_count FROM words;

    -- Count list_words entries
    SELECT COUNT(*) INTO list_words_count FROM list_words;

    -- Count words not in any list (orphaned)
    SELECT COUNT(*) INTO orphaned_words
    FROM words w
    WHERE NOT EXISTS (
        SELECT 1
        FROM list_words lw
        WHERE lw.word_id = w.id
    );

    RAISE NOTICE 'Data integrity check:';
    RAISE NOTICE '  Total words: %', words_count;
    RAISE NOTICE '  Total list_words entries: %', list_words_count;
    RAISE NOTICE '  Orphaned words (not in any list): %', orphaned_words;

    IF orphaned_words > 0 THEN
        RAISE WARNING 'Found % orphaned words not associated with any list', orphaned_words;
        -- These words should be cleaned up or associated with a list
    ELSE
        RAISE NOTICE 'All words are properly associated with lists';
    END IF;
END $$;