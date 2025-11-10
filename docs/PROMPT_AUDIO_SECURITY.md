# Prompt Audio Security Implementation

## Overview

This document describes the migration from public URLs to private storage with signed URLs for prompt audio files (word-audio bucket). This change enhances security by ensuring all audio access requires authentication and temporary signed URLs.

## Changes Made

### 1. Database Schema

**Migration:** `20251109170000_secure_prompt_audio_private.sql`

- Added `prompt_audio_path` column to `words` table to store storage paths
- Migrated existing `prompt_audio_url` data to `prompt_audio_path` (extracted paths from public URLs)
- Updated RLS policies on `storage.objects` for the `word-audio` bucket:
  - Parents can upload/update/delete audio files
  - All authenticated users can read (but need signed URLs for access)
- Created index on `prompt_audio_path` for faster lookups
- Marked `prompt_audio_url` as deprecated (kept for backward compatibility during transition)

**Note:** The `word-audio` bucket should be changed from public to private in Supabase Storage dashboard.

### 2. API Functions

**File:** `src/app/api/supa.ts`

#### New Helper Functions

```typescript
// Generate signed URL for a single prompt audio file
getSignedPromptAudioUrl(path: string, expiresIn = 3600): Promise<string | null>

// Generate signed URLs for multiple prompt audio files (batch)
getSignedPromptAudioUrls(paths: string[], expiresIn = 3600): Promise<Record<string, string | null>>
```

These functions follow the same pattern as `getSignedAudioUrl()` used for child audio recordings.

#### Updated Functions

**`useUploadAudio()`**

- Changed from storing public URL via `getPublicUrl()` to storing storage path
- Updates `prompt_audio_path` instead of `prompt_audio_url`
- Returns storage path instead of public URL

**`getListWithWords(listId)`**

- Generates signed URLs for all words with `prompt_audio_path`
- Uses batch function `getSignedPromptAudioUrls()` for efficiency
- Populates `prompt_audio_url` field with signed URLs for backward compatibility

**`getDueWords(childId)`**

- Generates signed URLs for all due words with prompt audio
- Adds signed URLs to word objects before returning

**`getHardestWords(childId, limit)`**

- Generates signed URLs for words with prompt audio
- Adds signed URLs to word objects before returning

**`getMostLapsedWords(childId, limit)`**

- Generates signed URLs for words with prompt audio
- Adds signed URLs to word objects before returning

### 3. TypeScript Types

**File:** `src/types/database.types.ts`

Added `prompt_audio_path` field to `words` table types:

- `Row`: `prompt_audio_path: string | null`
- `Insert`: `prompt_audio_path?: string | null`
- `Update`: `prompt_audio_path?: string | null`

Kept `prompt_audio_url` for backward compatibility.

## Security Benefits

1. **Authentication Required**: All audio access now requires valid Supabase authentication
2. **Time-Limited Access**: Signed URLs expire after 1 hour by default
3. **RLS Enforcement**: Row Level Security policies control who can upload/modify audio
4. **No Direct Access**: Storage paths cannot be used to access audio without a signed URL

## Backward Compatibility

- `prompt_audio_url` field is kept in the database schema (marked as deprecated)
- Signed URLs are temporarily stored in `prompt_audio_url` field when fetching words
- Existing code that reads `prompt_audio_url` continues to work without changes
- Migration handles conversion of existing public URLs to storage paths

## Usage Pattern

### Uploading Audio

```typescript
const uploadAudio = useUploadAudio();

// Upload returns storage path (not URL)
const storagePath = await uploadAudio.mutateAsync({
  file: audioBlob,
  listId: "list-id",
  wordId: "word-id",
});
// Path stored in words.prompt_audio_path
```

### Playing Audio

```typescript
const { data: list } = useWordList(listId);

// Words automatically have signed URLs in prompt_audio_url field
list?.words.forEach((word) => {
  if (word.prompt_audio_url) {
    // Use signed URL directly (valid for 1 hour)
    audio.src = word.prompt_audio_url;
  }
});
```

### Manual Signed URL Generation

```typescript
import { getSignedPromptAudioUrl } from "@/app/api/supa";

// Generate signed URL for a storage path
const signedUrl = await getSignedPromptAudioUrl(
  "lists/list-id/words/word-id.webm",
  3600 // expires in 1 hour
);
```

## Performance Considerations

1. **Batch URL Generation**: All functions use `getSignedPromptAudioUrls()` for bulk operations to minimize API calls
2. **Caching**: React Query caches word lists with signed URLs (1-hour expiry aligns with URL expiry)
3. **Efficient Filtering**: Type guards ensure only words with audio paths are processed

## Migration Steps

1. **Apply Migration**: Run `.\push-migration.ps1` to apply database changes
2. **Update Bucket Privacy**: Change `word-audio` bucket from public to private in Supabase dashboard
3. **Deploy Code**: Deploy updated application code
4. **Verify**: Test audio playback in both parent and child interfaces
5. **Monitor**: Check for any errors related to expired URLs or missing paths

## Related Files

- `supabase/migrations/20251109170000_secure_prompt_audio_private.sql` - Database migration
- `src/app/api/supa.ts` - API functions and signed URL helpers
- `src/types/database.types.ts` - TypeScript types
- `docs/AUDIO_RECORDING_SECURITY.md` - Similar implementation for child recordings

## Future Improvements

1. Consider removing `prompt_audio_url` field after confirming all code uses paths
2. Implement URL refresh mechanism for long-running sessions (before 1-hour expiry)
3. Add telemetry for signed URL generation failures
4. Optimize caching strategy to reduce signed URL generation frequency
