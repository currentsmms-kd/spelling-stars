-- Safe migration to update schema without dropping existing data
-- This migration modifies the existing schema incrementally

-- Step 1: Drop old triggers that will be recreated
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_spelling_lists_updated_at ON spelling_lists;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 2: Drop old functions
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Step 3: Add new columns to profiles if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='profiles' AND column_name='display_name') THEN
        ALTER TABLE profiles ADD COLUMN display_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='profiles' AND column_name='avatar_url') THEN
        ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
    END IF;

    -- Remove email column if it exists (it's in auth.users)
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='profiles' AND column_name='email') THEN
        ALTER TABLE profiles DROP COLUMN email;
    END IF;
END $$;

-- Step 4: Rename spelling_lists to word_lists if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_name='spelling_lists') THEN
        ALTER TABLE spelling_lists RENAME TO word_lists;

        -- Rename columns
        ALTER TABLE word_lists RENAME COLUMN parent_id TO created_by;

        -- Drop description column if exists
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='word_lists' AND column_name='description') THEN
            ALTER TABLE word_lists DROP COLUMN description;
        END IF;

        -- Add week_start_date if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='word_lists' AND column_name='week_start_date') THEN
            ALTER TABLE word_lists ADD COLUMN week_start_date DATE;
        END IF;
    END IF;
END $$;

-- Step 5: Update words table structure
DO $$
BEGIN
    -- Remove list_id from words (we'll use junction table)
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='words' AND column_name='list_id') THEN
        ALTER TABLE words DROP COLUMN list_id CASCADE;
    END IF;

    -- Rename word to text
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='words' AND column_name='word') THEN
        ALTER TABLE words RENAME COLUMN word TO text;
    END IF;

    -- Drop order column
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='words' AND column_name='order') THEN
        ALTER TABLE words DROP COLUMN "order";
    END IF;

    -- Rename audio_url to prompt_audio_url
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='words' AND column_name='audio_url') THEN
        ALTER TABLE words RENAME COLUMN audio_url TO prompt_audio_url;
    END IF;

    -- Add new columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='words' AND column_name='phonetic') THEN
        ALTER TABLE words ADD COLUMN phonetic TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='words' AND column_name='tts_voice') THEN
        ALTER TABLE words ADD COLUMN tts_voice TEXT;
    END IF;
END $$;

-- Step 6: Create list_words junction table if it doesn't exist
CREATE TABLE IF NOT EXISTS list_words (
    list_id UUID REFERENCES word_lists(id) ON DELETE CASCADE,
    word_id UUID REFERENCES words(id) ON DELETE CASCADE,
    sort_index INTEGER NOT NULL,
    PRIMARY KEY (list_id, word_id)
);

-- Step 7: Update attempts table structure
-- First, drop the policy that depends on list_id
DROP POLICY IF EXISTS "Parents can view attempts for their lists" ON attempts;

DO $$
BEGIN
    -- Remove list_id column
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='attempts' AND column_name='list_id') THEN
        ALTER TABLE attempts DROP COLUMN list_id CASCADE;
    END IF;

    -- Rename is_correct to correct
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='attempts' AND column_name='is_correct') THEN
        ALTER TABLE attempts RENAME COLUMN is_correct TO correct;
    END IF;

    -- Rename created_at to started_at
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='attempts' AND column_name='created_at') THEN
        ALTER TABLE attempts RENAME COLUMN created_at TO started_at;
    END IF;

    -- Add new columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='attempts' AND column_name='mode') THEN
        ALTER TABLE attempts ADD COLUMN mode TEXT CHECK (mode IN ('listen_type', 'say_spell', 'flash'));
        -- Set a default value for existing rows
        UPDATE attempts SET mode = 'listen_type' WHERE mode IS NULL;
        ALTER TABLE attempts ALTER COLUMN mode SET NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='attempts' AND column_name='duration_ms') THEN
        ALTER TABLE attempts ADD COLUMN duration_ms INTEGER;
    END IF;
END $$;

-- Step 8: Create rewards table if it doesn't exist
CREATE TABLE IF NOT EXISTS rewards (
    child_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    stars_total INTEGER DEFAULT 0,
    streak_current INTEGER DEFAULT 0,
    badges JSONB DEFAULT '[]'::jsonb
);

-- Step 9: Drop old indexes
DROP INDEX IF EXISTS idx_spelling_lists_parent_id;
DROP INDEX IF EXISTS idx_words_list_id;
DROP INDEX IF EXISTS idx_attempts_child_id;
DROP INDEX IF EXISTS idx_attempts_word_id;
DROP INDEX IF EXISTS idx_attempts_list_id;

-- Step 10: Create new indexes
CREATE INDEX IF NOT EXISTS idx_attempts_child_word_started
    ON attempts(child_id, word_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_list_words_list_sort
    ON list_words(list_id, sort_index);
CREATE INDEX IF NOT EXISTS idx_word_lists_created_by
    ON word_lists(created_by);

-- Step 11: Recreate functions
CREATE OR REPLACE FUNCTION fn_add_stars(p_child UUID, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_total INTEGER;
BEGIN
    INSERT INTO rewards (child_id, stars_total)
    VALUES (p_child, p_amount)
    ON CONFLICT (child_id)
    DO UPDATE SET stars_total = rewards.stars_total + p_amount
    RETURNING stars_total INTO v_new_total;

    RETURN v_new_total;
END;
$$;

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

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Step 12: Recreate triggers
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_word_lists_updated_at
    BEFORE UPDATE ON word_lists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 13: Update RLS policies
-- Drop old policies (use IF EXISTS to handle renamed tables)
DO $$
BEGIN
    -- Drop policies from profiles
    DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

    -- Drop policies from word_lists (both old and new table names)
    EXECUTE 'DROP POLICY IF EXISTS "Parents can view own lists" ON word_lists';
    EXECUTE 'DROP POLICY IF EXISTS "Parents can create lists" ON word_lists';
    EXECUTE 'DROP POLICY IF EXISTS "Parents can update own lists" ON word_lists';
    EXECUTE 'DROP POLICY IF EXISTS "Parents can delete own lists" ON word_lists';

    -- Drop policies from words
    DROP POLICY IF EXISTS "Users can view words from accessible lists" ON words;
    DROP POLICY IF EXISTS "Parents can insert words into own lists" ON words;
    DROP POLICY IF EXISTS "Parents can update words in own lists" ON words;
    DROP POLICY IF EXISTS "Parents can delete words from own lists" ON words;

    -- Drop policies from attempts
    DROP POLICY IF EXISTS "Children can view own attempts" ON attempts;
    DROP POLICY IF EXISTS "Children can create attempts" ON attempts;
    DROP POLICY IF EXISTS "Parents can view attempts for their lists" ON attempts;
END $$;

-- Enable RLS on new tables
ALTER TABLE list_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

-- Create new policies for profiles
CREATE POLICY "Parents can read all profiles"
    ON profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role = 'parent'
        )
    );

CREATE POLICY "Children can read own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id AND role = 'child');

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Create policies for word_lists
CREATE POLICY "Authenticated users can read word_lists"
    ON word_lists FOR SELECT
    TO authenticated
    USING (true);

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

-- Create policies for words
CREATE POLICY "Authenticated users can read words"
    ON words FOR SELECT
    TO authenticated
    USING (true);

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

-- Create policies for list_words
CREATE POLICY "Authenticated users can read list_words"
    ON list_words FOR SELECT
    TO authenticated
    USING (true);

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

-- Create policies for attempts
CREATE POLICY "Children can insert own attempts"
    ON attempts FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = child_id);

CREATE POLICY "Children can read own attempts"
    ON attempts FOR SELECT
    TO authenticated
    USING (auth.uid() = child_id);

CREATE POLICY "Parents can read all attempts"
    ON attempts FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
        )
    );

-- Create policies for rewards
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

CREATE POLICY "Parents can read all rewards"
    ON rewards FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
        )
    );

CREATE POLICY "Parents can update all rewards"
    ON rewards FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
        )
    );
