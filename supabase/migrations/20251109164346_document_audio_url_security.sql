-- Document the security model for audio_url column in attempts table
-- This migration adds comments to clarify that audio_url stores storage paths, not URLs
-- Signed URLs must be generated on-demand for playback using createSignedUrl()

-- Add comment to attempts table
COMMENT ON TABLE attempts IS 'Tracks child spelling attempts. audio_url stores storage path (not URL) for private recordings. Use createSignedUrl() with TTL=3600s for playback.';

-- Add comment to audio_url column
-- Document that audio_url stores paths, not URLs
-- This is critical for security: private bucket requires signed URLs for playback
-- Path format: {child_id}/{list_id}/{word_id}_{timestamp}.webm
--
-- PLAYBACK REQUIREMENTS:
-- 1. Never use audio_url directly - it's a storage path, not a playable URL
-- 2. Generate signed URL via: supabase.storage.from("audio-recordings").createSignedUrl(audio_url, 3600)
-- 3. TTL = 3600 seconds (1 hour) - never cache signed URLs
-- 4. Use getSignedAudioUrl() helper from supa.ts for consistent implementation
-- 5. React Query hooks (useAttempts, useAttemptsForWord) automatically generate signed URLs
--
-- RLS POLICY VERIFICATION:
-- Path format MUST be {child_id}/{list_id}/{word_id}_{timestamp}.webm
-- Policies verify: (storage.foldername(name))[1] = child's user id
-- First path segment is used for access control
COMMENT ON COLUMN attempts.audio_url IS 'Storage path to private audio recording (e.g., "user-id/list-id/word-id_timestamp.webm"). Generate signed URL on-demand for playback using supabase.storage.from("audio-recordings").createSignedUrl(path, 3600). NEVER use path directly - always generate fresh signed URL. Path format CRITICAL for RLS: first segment must be child_id.';
