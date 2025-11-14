-- Add age and birthday fields to profiles table for child customization
-- Migration: 20251113000000_add_child_profile_fields.sql

-- Add age column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'age'
    ) THEN
        ALTER TABLE profiles ADD COLUMN age INTEGER DEFAULT NULL CHECK (age >= 3 AND age <= 18);
        COMMENT ON COLUMN profiles.age IS 'Child age (3-18 years), NULL for parents';
    END IF;
END $$;

-- Add birthday column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'birthday'
    ) THEN
        ALTER TABLE profiles ADD COLUMN birthday DATE DEFAULT NULL;
        COMMENT ON COLUMN profiles.birthday IS 'Child birthday, NULL for parents';
    END IF;
END $$;

-- Add favorite_color column for personalization
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'favorite_color'
    ) THEN
        ALTER TABLE profiles ADD COLUMN favorite_color TEXT DEFAULT NULL;
        COMMENT ON COLUMN profiles.favorite_color IS 'Child favorite color for UI personalization';
    END IF;
END $$;

-- Note: RLS policies for parent-child access already exist in previous migrations
-- (See 20251109225900_add_parent_child_relationship.sql)
-- We don't need to recreate them as they already handle parent access to child profiles
