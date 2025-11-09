-- Migration to align schema with requirements
-- Drop existing tables and recreate with correct structure

-- Drop existing tables in correct order
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS update_updated_at_column();

DROP TABLE IF EXISTS attempts CASCADE;
DROP TABLE IF EXISTS words CASCADE;
DROP TABLE IF EXISTS spelling_lists CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Create profiles table with required fields
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('parent', 'child')),
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create word_lists table (renamed from spelling_lists)
CREATE TABLE word_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    week_start_date DATE,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create words table (separate from lists)
CREATE TABLE words (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    phonetic TEXT,
    tts_voice TEXT,
    prompt_audio_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create list_words junction table
CREATE TABLE list_words (
    list_id UUID REFERENCES word_lists(id) ON DELETE CASCADE,
    word_id UUID REFERENCES words(id) ON DELETE CASCADE,
    sort_index INTEGER NOT NULL,
    PRIMARY KEY (list_id, word_id)
);

-- Create attempts table with updated structure
CREATE TABLE attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    word_id UUID NOT NULL REFERENCES words(id) ON DELETE RESTRICT,
    mode TEXT NOT NULL CHECK (mode IN ('listen_type', 'say_spell', 'flash')),
    correct BOOLEAN NOT NULL,
    typed_answer TEXT,
    duration_ms INTEGER,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    audio_url TEXT
);

-- Create rewards table
CREATE TABLE rewards (
    child_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    stars_total INTEGER DEFAULT 0,
    streak_current INTEGER DEFAULT 0,
    badges JSONB DEFAULT '[]'::jsonb
);

-- Create indexes
CREATE INDEX idx_attempts_child_word_started ON attempts(child_id, word_id, started_at DESC);
CREATE INDEX idx_list_words_list_sort ON list_words(list_id, sort_index);
CREATE INDEX idx_word_lists_created_by ON word_lists(created_by);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE word_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE words ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
-- Parents can read all profiles (will be scoped to family later)
CREATE POLICY "Parents can read all profiles"
    ON profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role = 'parent'
        )
    );

-- Children can read only their own profile
CREATE POLICY "Children can read own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id AND role = 'child');

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- word_lists, words, list_words RLS policies
-- All authenticated users can read
CREATE POLICY "Authenticated users can read word_lists"
    ON word_lists FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can read words"
    ON words FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can read list_words"
    ON list_words FOR SELECT
    TO authenticated
    USING (true);

-- Only parents can insert/update/delete
CREATE POLICY "Parents can insert word_lists"
    ON word_lists FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
        )
    );

CREATE POLICY "Parents can update word_lists"
    ON word_lists FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
        )
    );

CREATE POLICY "Parents can delete word_lists"
    ON word_lists FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
        )
    );

CREATE POLICY "Parents can insert words"
    ON words FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
        )
    );

CREATE POLICY "Parents can update words"
    ON words FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
        )
    );

CREATE POLICY "Parents can delete words"
    ON words FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
        )
    );

CREATE POLICY "Parents can insert list_words"
    ON list_words FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
        )
    );

CREATE POLICY "Parents can update list_words"
    ON list_words FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
        )
    );

CREATE POLICY "Parents can delete list_words"
    ON list_words FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
        )
    );

-- Attempts RLS policies
-- Children can insert their own attempts
CREATE POLICY "Children can insert own attempts"
    ON attempts FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = child_id);

-- Children can read their own attempts
CREATE POLICY "Children can read own attempts"
    ON attempts FOR SELECT
    TO authenticated
    USING (auth.uid() = child_id);

-- Parents can read all attempts (placeholder, will be scoped to their children later)
CREATE POLICY "Parents can read all attempts"
    ON attempts FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
        )
    );

-- Rewards RLS policies
-- Children can read and update only their own rewards
CREATE POLICY "Children can read own rewards"
    ON rewards FOR SELECT
    TO authenticated
    USING (auth.uid() = child_id);

CREATE POLICY "Children can update own rewards"
    ON rewards FOR UPDATE
    TO authenticated
    USING (auth.uid() = child_id);

CREATE POLICY "Children can insert own rewards"
    ON rewards FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = child_id);

-- Parents can read all rewards (placeholder, will be scoped to their children later)
CREATE POLICY "Parents can read all rewards"
    ON rewards FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
        )
    );

-- Parents can update all rewards (placeholder)
CREATE POLICY "Parents can update all rewards"
    ON rewards FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
        )
    );

-- Function to add stars to a child's rewards
CREATE OR REPLACE FUNCTION fn_add_stars(p_child UUID, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_total INTEGER;
BEGIN
    -- Insert or update rewards
    INSERT INTO rewards (child_id, stars_total)
    VALUES (p_child, p_amount)
    ON CONFLICT (child_id)
    DO UPDATE SET stars_total = rewards.stars_total + p_amount
    RETURNING stars_total INTO v_new_total;

    RETURN v_new_total;
END;
$$;

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.profiles (id, role, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'role', 'parent'),
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Triggers to update updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_word_lists_updated_at
    BEFORE UPDATE ON word_lists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Recreate storage bucket for audio recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-recordings', 'audio-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for audio recordings
DROP POLICY IF EXISTS "Users can upload own audio recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own audio recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own audio recordings" ON storage.objects;

CREATE POLICY "Users can upload own audio recordings"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'audio-recordings'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can view own audio recordings"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'audio-recordings'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete own audio recordings"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'audio-recordings'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
