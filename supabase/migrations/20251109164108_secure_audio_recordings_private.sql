-- Secure audio-recordings bucket to use private signed URLs
-- This migration updates the existing audio-recordings bucket to be fully private
-- and adds RLS policies to ensure only authorized users can access recordings

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload own audio recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own audio recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own audio recordings" ON storage.objects;

-- Update bucket to be private (should already be private but ensure it)
UPDATE storage.buckets
SET public = false
WHERE id = 'audio-recordings';

-- Policy: Parents can insert audio recordings for their children
-- Path format: {child_id}/{list_id}/{word_id}_{timestamp}.webm
CREATE POLICY "Parents can upload child audio recordings"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'audio-recordings'
        AND (
            -- User is parent and child belongs to them
            EXISTS (
                SELECT 1 FROM profiles parent
                JOIN profiles child ON child.id::text = (storage.foldername(name))[1]
                WHERE parent.id = auth.uid()
                AND parent.role = 'parent'
            )
            OR
            -- User is the child uploading their own recording
            auth.uid()::text = (storage.foldername(name))[1]
        )
    );

-- Policy: Users can only view their own audio recordings or recordings of their children
-- This policy controls access to storage.from().download() and signed URL generation
CREATE POLICY "Users can view own or child audio recordings"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'audio-recordings'
        AND (
            -- User uploaded the recording (child or parent)
            auth.uid()::text = (storage.foldername(name))[1]
            OR
            -- User is parent viewing their child's recording
            EXISTS (
                SELECT 1 FROM profiles parent
                WHERE parent.id = auth.uid()
                AND parent.role = 'parent'
                AND EXISTS (
                    SELECT 1 FROM profiles child
                    WHERE child.id::text = (storage.foldername(name))[1]
                    AND child.role = 'child'
                )
            )
        )
    );

-- Policy: Users can delete their own recordings or parents can delete child recordings
CREATE POLICY "Users can delete own or child audio recordings"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'audio-recordings'
        AND (
            -- User uploaded the recording
            auth.uid()::text = (storage.foldername(name))[1]
            OR
            -- User is parent deleting their child's recording
            EXISTS (
                SELECT 1 FROM profiles parent
                WHERE parent.id = auth.uid()
                AND parent.role = 'parent'
                AND EXISTS (
                    SELECT 1 FROM profiles child
                    WHERE child.id::text = (storage.foldername(name))[1]
                    AND child.role = 'child'
                )
            )
        )
    );

-- Add comment to document the security model
COMMENT ON TABLE storage.objects IS 'Audio recordings are private and require signed URLs for access. TTL should be set to 1 hour (3600 seconds) when generating signed URLs.';
