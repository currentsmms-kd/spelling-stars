-- Add parental controls settings table
CREATE TABLE IF NOT EXISTS parental_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pin_code TEXT NOT NULL, -- Hashed PIN for parent area access
  show_hints_on_first_miss BOOLEAN DEFAULT true,
  enforce_case_sensitivity BOOLEAN DEFAULT false,
  auto_readback_spelling BOOLEAN DEFAULT true,
  daily_session_limit_minutes INTEGER DEFAULT 20,
  default_tts_voice TEXT DEFAULT 'en-US', -- Default TTS voice for words
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(parent_id)
);

-- Add voice preference to words table
ALTER TABLE words
  ADD COLUMN IF NOT EXISTS tts_voice TEXT DEFAULT NULL; -- Per-word TTS voice override

-- Add session analytics table
CREATE TABLE IF NOT EXISTS session_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  session_duration_seconds INTEGER DEFAULT 0,
  words_practiced INTEGER DEFAULT 0,
  correct_on_first_try INTEGER DEFAULT 0,
  total_attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_session_analytics_child_date
  ON session_analytics(child_id, session_date);

-- Add badges table
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_key TEXT UNIQUE NOT NULL, -- e.g., 'first_word', 'streak_7', 'perfect_10'
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL, -- Icon name or emoji
  required_stars INTEGER DEFAULT 0, -- Stars needed to unlock (0 if criteria-based)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add user badges (earned badges)
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(child_id, badge_id)
);

-- Insert default badges
INSERT INTO badges (badge_key, name, description, icon, required_stars) VALUES
  ('first_word', 'First Word', 'Spelled your first word!', '🌟', 0),
  ('streak_3', '3-Day Streak', 'Practiced 3 days in a row', '🔥', 0),
  ('streak_7', 'Week Warrior', 'Practiced 7 days in a row', '🏆', 0),
  ('perfect_5', 'Perfect 5', 'Got 5 words correct in a row', '✨', 0),
  ('perfect_10', 'Perfect 10', 'Got 10 words correct in a row', '⭐', 0),
  ('star_collector_25', 'Star Collector', 'Earned 25 stars', '🌠', 25),
  ('star_collector_50', 'Rising Star', 'Earned 50 stars', '💫', 50),
  ('star_collector_100', 'Superstar', 'Earned 100 stars', '🌟', 100),
  ('word_master_50', 'Word Master', 'Practiced 50 unique words', '📚', 0),
  ('speed_demon', 'Speed Demon', 'Completed a word in under 5 seconds', '⚡', 0)
ON CONFLICT (badge_key) DO NOTHING;

-- Enable RLS
ALTER TABLE parental_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for parental_settings
CREATE POLICY "Parents can view their own settings"
  ON parental_settings FOR SELECT
  USING (auth.uid() = parent_id);

CREATE POLICY "Parents can insert their own settings"
  ON parental_settings FOR INSERT
  WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "Parents can update their own settings"
  ON parental_settings FOR UPDATE
  USING (auth.uid() = parent_id);

-- RLS Policies for session_analytics
CREATE POLICY "Children can insert their own analytics"
  ON session_analytics FOR INSERT
  WITH CHECK (auth.uid() = child_id);

CREATE POLICY "Children can view their own analytics"
  ON session_analytics FOR SELECT
  USING (auth.uid() = child_id);

CREATE POLICY "Parents can view all analytics"
  ON session_analytics FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'parent'
  ));

-- RLS Policies for badges (read-only for all authenticated users)
CREATE POLICY "Anyone authenticated can view badges"
  ON badges FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for user_badges
CREATE POLICY "Children can view their own badges"
  ON user_badges FOR SELECT
  USING (auth.uid() = child_id);

CREATE POLICY "Children can earn badges"
  ON user_badges FOR INSERT
  WITH CHECK (auth.uid() = child_id);

CREATE POLICY "Parents can view all user badges"
  ON user_badges FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'parent'
  ));

-- Update function for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_parental_settings_updated_at
  BEFORE UPDATE ON parental_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_analytics_updated_at
  BEFORE UPDATE ON session_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
