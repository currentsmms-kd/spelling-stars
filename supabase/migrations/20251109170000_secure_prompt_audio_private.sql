-- Migration: Make prompt audio private with signed URLs
-- Date: 2025-11-09
-- Description: Add prompt_audio_path column, make word-audio bucket private, and update RLS policies

-- Step 1: Add prompt_audio_path column to store storage paths
ALTER TABLE words ADD COLUMN IF NOT EXISTS prompt_audio_path TEXT;

-- Step 2: Migrate existing prompt_audio_url data to prompt_audio_path
-- Extract the storage path from existing public URLs
-- Format: https://{project}.supabase.co/storage/v1/object/public/word-audio/{path}
-- We need to extract just the {path} part
UPDATE words
SET prompt_audio_path = SUBSTRING(prompt_audio_url FROM 'word-audio/(.*)$')
WHERE prompt_audio_url IS NOT NULL
  AND prompt_audio_url LIKE '%/storage/v1/object/public/word-audio/%';

-- Step 3: Update the word-audio bucket to be private
-- Note: This is done via Supabase Storage API, but we document it here
-- The bucket configuration should be changed from public to private

-- Step 4: Update RLS policies for word-audio bucket
-- Parents can upload/update/delete their own list audio (write access)
-- All authenticated users can read (but will need signed URLs)

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Parents can upload word audio" ON storage.objects;
DROP POLICY IF EXISTS "Parents can update word audio" ON storage.objects;
DROP POLICY IF EXISTS "Parents can delete word audio" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read word audio" ON storage.objects;

-- Create new policies for private word-audio bucket
CREATE POLICY "Parents can upload word audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'word-audio'
  AND (storage.foldername(name))[1] = 'lists'
  AND auth.role() = 'authenticated'
  -- Verify parent role via profiles table
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'parent'
  )
);

CREATE POLICY "Parents can update word audio"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'word-audio'
  AND (storage.foldername(name))[1] = 'lists'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'parent'
  )
)
WITH CHECK (
  bucket_id = 'word-audio'
  AND (storage.foldername(name))[1] = 'lists'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'parent'
  )
);

CREATE POLICY "Parents can delete word audio"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'word-audio'
  AND (storage.foldername(name))[1] = 'lists'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'parent'
  )
);

-- All authenticated users can read (but will need signed URLs since bucket is private)
CREATE POLICY "Authenticated users can read word audio"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'word-audio');

-- Step 5: Add comment to document the change
COMMENT ON COLUMN words.prompt_audio_path IS 'Storage path for prompt audio (requires signed URL for access)';
COMMENT ON COLUMN words.prompt_audio_url IS 'DEPRECATED: Legacy public URL field, use prompt_audio_path with signed URLs';

-- Step 6: Create index for faster lookups by audio path
CREATE INDEX IF NOT EXISTS idx_words_prompt_audio_path ON words(prompt_audio_path) WHERE prompt_audio_path IS NOT NULL;
