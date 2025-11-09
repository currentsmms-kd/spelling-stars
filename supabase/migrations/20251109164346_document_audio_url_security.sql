-- Document the security model for audio_url column in attempts table
-- This migration adds comments to clarify that audio_url stores storage paths, not URLs
-- Signed URLs must be generated on-demand for playback using createSignedUrl()

-- Add comment to attempts table
COMMENT ON TABLE attempts IS 'Tracks child spelling attempts. audio_url stores storage path (not URL) for private recordings. Use createSignedUrl() with TTL=3600s for playback.';

-- Add comment to audio_url column
COMMENT ON COLUMN attempts.audio_url IS 'Storage path to private audio recording (e.g., "user-id/list-id/word-id_timestamp.webm"). Generate signed URL on-demand for playback using supabase.storage.from("audio-recordings").createSignedUrl(path, 3600).';
