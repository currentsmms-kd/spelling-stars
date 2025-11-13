-- Add ignore_punctuation column to parental_settings table
-- This setting controls whether to strip ALL punctuation (including hyphens and apostrophes)
-- or preserve structural punctuation (hyphens in compound words, apostrophes in contractions)

-- Add the column with default value false (preserve hyphens/apostrophes by default)
ALTER TABLE parental_settings
ADD COLUMN IF NOT EXISTS ignore_punctuation BOOLEAN DEFAULT FALSE;

-- Add comment explaining the column's purpose
COMMENT ON COLUMN parental_settings.ignore_punctuation IS
'If true, strips ALL punctuation including hyphens and apostrophes when comparing spelling answers.
If false (default), preserves hyphens for compound words (e.g., "mother-in-law") and apostrophes
for contractions/possessives (e.g., "don''t", "cat''s"). Useful for younger learners who may
struggle with punctuation keys.';

-- Update existing rows to have the default value (idempotent)
UPDATE parental_settings
SET ignore_punctuation = FALSE
WHERE ignore_punctuation IS NULL;
