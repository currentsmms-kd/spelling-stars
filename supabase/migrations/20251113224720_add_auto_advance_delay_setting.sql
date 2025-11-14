-- Add auto_advance_delay_seconds column to parental_settings table
-- This setting controls the delay (in seconds) before automatically advancing to the next word
-- after a correct answer in the Listen & Type and Say & Spell game modes.

-- Add the column with default value 3 seconds (standardized from previous hardcoded values)
ALTER TABLE parental_settings
ADD COLUMN IF NOT EXISTS auto_advance_delay_seconds INTEGER DEFAULT 3;

-- Add comment explaining the column's purpose
COMMENT ON COLUMN parental_settings.auto_advance_delay_seconds IS
'Delay in seconds before automatically advancing to the next word after a correct answer.
Valid range: 2-8 seconds. Default: 3 seconds (standardized from previous hardcoded values
of 2-5 seconds across different game modes). This allows parents to adjust the pacing based
on their child''s reading speed and cognitive processing time. Shorter delays create faster-
paced practice sessions, while longer delays give children more time to see their success
and prepare for the next word.';

-- Add constraint to enforce valid range (2-8 seconds)
ALTER TABLE parental_settings
ADD CONSTRAINT auto_advance_delay_range
CHECK (auto_advance_delay_seconds >= 2 AND auto_advance_delay_seconds <= 8);

-- Update existing rows to have the default value (idempotent)
UPDATE parental_settings
SET auto_advance_delay_seconds = 3
WHERE auto_advance_delay_seconds IS NULL;
