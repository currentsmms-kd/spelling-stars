-- Create storage bucket for word prompt audio
INSERT INTO storage.buckets (id, name, public)
VALUES ('word-audio', 'word-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for word-audio bucket
-- Allow parents to upload word prompt audio
CREATE POLICY "Parents can upload word audio"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'word-audio'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'parent'
        )
    );

-- Allow public read access to word audio
CREATE POLICY "Public can view word audio"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'word-audio');

-- Allow parents to update their word audio
CREATE POLICY "Parents can update word audio"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'word-audio'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'parent'
        )
    );

-- Allow parents to delete their word audio
CREATE POLICY "Parents can delete word audio"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'word-audio'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'parent'
        )
    );
