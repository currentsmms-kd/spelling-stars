-- Create profiles table
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('parent', 'child')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create spelling_lists table
CREATE TABLE spelling_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create words table
CREATE TABLE words (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES spelling_lists(id) ON DELETE CASCADE,
    word TEXT NOT NULL,
    audio_url TEXT,
    "order" INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create attempts table
CREATE TABLE attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    word_id UUID NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    list_id UUID NOT NULL REFERENCES spelling_lists(id) ON DELETE CASCADE,
    is_correct BOOLEAN NOT NULL,
    typed_answer TEXT,
    audio_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_spelling_lists_parent_id ON spelling_lists(parent_id);
CREATE INDEX idx_words_list_id ON words(list_id);
CREATE INDEX idx_attempts_child_id ON attempts(child_id);
CREATE INDEX idx_attempts_word_id ON attempts(word_id);
CREATE INDEX idx_attempts_list_id ON attempts(list_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE spelling_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE words ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Spelling lists policies
CREATE POLICY "Parents can view own lists"
    ON spelling_lists FOR SELECT
    USING (auth.uid() = parent_id);

CREATE POLICY "Parents can create lists"
    ON spelling_lists FOR INSERT
    WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "Parents can update own lists"
    ON spelling_lists FOR UPDATE
    USING (auth.uid() = parent_id);

CREATE POLICY "Parents can delete own lists"
    ON spelling_lists FOR DELETE
    USING (auth.uid() = parent_id);

-- Words policies
CREATE POLICY "Users can view words from accessible lists"
    ON words FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM spelling_lists
            WHERE spelling_lists.id = words.list_id
            AND spelling_lists.parent_id = auth.uid()
        )
    );

CREATE POLICY "Parents can insert words into own lists"
    ON words FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM spelling_lists
            WHERE spelling_lists.id = words.list_id
            AND spelling_lists.parent_id = auth.uid()
        )
    );

CREATE POLICY "Parents can update words in own lists"
    ON words FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM spelling_lists
            WHERE spelling_lists.id = words.list_id
            AND spelling_lists.parent_id = auth.uid()
        )
    );

CREATE POLICY "Parents can delete words from own lists"
    ON words FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM spelling_lists
            WHERE spelling_lists.id = words.list_id
            AND spelling_lists.parent_id = auth.uid()
        )
    );

-- Attempts policies
CREATE POLICY "Children can view own attempts"
    ON attempts FOR SELECT
    USING (auth.uid() = child_id);

CREATE POLICY "Children can create attempts"
    ON attempts FOR INSERT
    WITH CHECK (auth.uid() = child_id);

CREATE POLICY "Parents can view attempts for their lists"
    ON attempts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM spelling_lists
            WHERE spelling_lists.id = attempts.list_id
            AND spelling_lists.parent_id = auth.uid()
        )
    );

-- Create storage bucket for audio recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-recordings', 'audio-recordings', false);

-- Storage policies for audio recordings
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

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'parent')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to update updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_spelling_lists_updated_at
    BEFORE UPDATE ON spelling_lists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
