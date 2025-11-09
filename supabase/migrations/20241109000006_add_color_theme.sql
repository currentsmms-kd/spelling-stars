-- Add color_theme column to parental_settings table
ALTER TABLE parental_settings
ADD COLUMN IF NOT EXISTS color_theme TEXT DEFAULT 'kawaii-pink';

-- Add color_theme column to profiles table for child preferences
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS color_theme TEXT DEFAULT 'kawaii-pink';

-- Add comment for documentation
COMMENT ON COLUMN parental_settings.color_theme IS 'Selected color theme ID (kawaii-pink, blue-scholar, midnight-dark)';
COMMENT ON COLUMN profiles.color_theme IS 'Selected color theme ID for child users (kawaii-pink, blue-scholar, midnight-dark)';
