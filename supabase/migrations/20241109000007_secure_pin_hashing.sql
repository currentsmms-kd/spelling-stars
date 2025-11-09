-- Migration: Secure PIN Hashing
-- Description: Updates pin_code column to store PBKDF2 hashes instead of reversible Base64
-- Note: This migration will invalidate all existing PINs. Parents will need to reset their PINs.

-- Add a comment to the pin_code column documenting the new format
COMMENT ON COLUMN parental_settings.pin_code IS
  'PBKDF2-HMAC-SHA256 hash in format "salt:hash" (both base64). 100k iterations, 16-byte salt, 32-byte hash.';

-- Clear all existing PINs as they are in the old Base64 format
-- Parents will be prompted to set a new PIN on their next login
UPDATE parental_settings
SET pin_code = NULL
WHERE pin_code IS NOT NULL;

-- Add helpful comment explaining the security update
DO $$
BEGIN
  RAISE NOTICE 'Security Update: All existing PINs have been cleared. Parents must reset their PINs.';
  RAISE NOTICE 'New PINs are secured with PBKDF2-HMAC-SHA256 with 100,000 iterations.';
END $$;
