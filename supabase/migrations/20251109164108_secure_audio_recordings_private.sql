SET ROLE postgres;

-- Secure audio-recordings bucket to use private signed URLs
-- This migration updates the existing audio-recordings bucket to be fully private
-- and adds RLS policies to ensure only authorized users can access recordings

-- NOTE: Storage policies on storage.objects table cannot be managed via SQL migrations
-- due to Supabase's permission model. These policies must be set via Supabase Dashboard.
--
-- Required storage policies for 'audio-recordings' bucket:
-- 1. "Parents can upload child audio recordings" - INSERT policy
-- 2. "Users can view own or child audio recordings" - SELECT policy
-- 3. "Users can delete own or child audio recordings" - DELETE policy
--
-- To apply manually:
-- 1. Go to Supabase Dashboard → Storage → audio-recordings
-- 2. Ensure bucket is set to PRIVATE (not public)
-- 3. Add the three RLS policies via the Storage UI
--
-- See docs/PROMPT_AUDIO_SECURITY.md for policy definitions

-- Update bucket to be private (this CAN be done via SQL)
UPDATE storage.buckets
SET public = false
WHERE id = 'audio-recordings';

-- Note: Audio recordings are private and require signed URLs for access.
-- TTL should be set to 1 hour (3600 seconds) when generating signed URLs.

RESET ROLE;
