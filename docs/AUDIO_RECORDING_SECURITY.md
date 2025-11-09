# Audio Recording Security Implementation

## Overview

Child audio recordings are now stored in a **private** storage bucket (`audio-recordings`) with Row Level Security (RLS) policies. Access requires **signed URLs with expiration** to prevent unwanted exposure of children's recordings.

## Security Model

### Storage Bucket: `audio-recordings`

- **Privacy**: Private bucket (`public = false`)
- **Access Control**: RLS policies enforce parent-child relationships
- **Signed URLs**: Required for all playback with 1-hour TTL (3600 seconds)

### Database Schema

The `attempts` table stores:

- `audio_url`: Storage **path** (not URL), e.g., `"user-id/list-id/word-id_timestamp.webm"`

**Important**: The `audio_url` column contains storage paths, not URLs. Signed URLs must be generated on-demand for playback.

## RLS Policies

### INSERT Policy: "Parents can upload child audio recordings"

Parents can upload recordings for their children, and children can upload their own recordings.

```sql
WITH CHECK (
  bucket_id = 'audio-recordings'
  AND (
    -- Parent uploading for their child
    EXISTS (
      SELECT 1 FROM profiles parent
      JOIN profiles child ON child.id::text = (storage.foldername(name))[1]
      WHERE parent.id = auth.uid()
      AND parent.role = 'parent'
    )
    OR
    -- Child uploading their own recording
    auth.uid()::text = (storage.foldername(name))[1]
  )
);
```

### SELECT Policy: "Users can view own or child audio recordings"

Controls access to `download()` and `createSignedUrl()` operations.

```sql
USING (
  bucket_id = 'audio-recordings'
  AND (
    -- User's own recording
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- Parent viewing child's recording
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
```

### DELETE Policy: "Users can delete own or child audio recordings"

Same logic as SELECT - users can delete their own recordings, parents can delete children's recordings.

## Implementation Guide

### Uploading Audio

When saving a child's recording:

```typescript
// ✅ CORRECT: Store path, not URL
const { data, error } = await supabase.storage
  .from("audio-recordings")
  .upload(fileName, audioBlob, {
    contentType: "audio/webm",
    cacheControl: "3600",
  });

if (!error && data) {
  // Store the PATH in the database
  const audioPath = data.path;

  await supabase.from("attempts").insert({
    child_id: childId,
    word_id: wordId,
    mode: "say-spell",
    correct: true,
    audio_url: audioPath, // Store PATH, not URL
    started_at: new Date().toISOString(),
  });
}
```

```typescript
// ❌ WRONG: Don't use getPublicUrl()
const { data: urlData } = supabase.storage
  .from("audio-recordings")
  .getPublicUrl(data.path); // DON'T DO THIS

audioUrl = urlData.publicUrl; // This won't work for private buckets
```

### Playing Back Audio

When displaying attempt audio for playback:

```typescript
import { getSignedAudioUrl } from "@/app/api/supa";

// Get the attempt from database
const { data: attempt } = await supabase
  .from("attempts")
  .select("audio_url")
  .eq("id", attemptId)
  .single();

if (attempt?.audio_url) {
  // Generate signed URL on-demand
  const signedUrl = await getSignedAudioUrl(attempt.audio_url, 3600); // 1 hour TTL

  if (signedUrl) {
    // Use signed URL for playback
    const audio = new Audio(signedUrl);
    audio.play();
  }
}
```

### Bulk URL Generation

For components that need multiple audio URLs:

```typescript
import { getSignedAudioUrls } from "@/app/api/supa";

// Get multiple attempts
const { data: attempts } = await supabase
  .from("attempts")
  .select("id, audio_url")
  .in("id", attemptIds);

// Extract paths
const paths = attempts.map((a) => a.audio_url).filter(Boolean) as string[];

// Generate signed URLs in bulk
const signedUrls = await getSignedAudioUrls(paths);

// Map back to attempts
const attemptsWithUrls = attempts.map((attempt) => ({
  ...attempt,
  signedUrl: attempt.audio_url ? signedUrls[attempt.audio_url] : null,
}));
```

### Offline Queue Sync

The `sync.ts` module handles offline uploads:

```typescript
// In sync.ts
const { data, error } = await supabase.storage
  .from("audio-recordings")
  .upload(audio.filename, audio.blob, {
    contentType: audio.blob.type,
    upsert: false,
  });

if (!error) {
  // Store PATH in IndexedDB
  await db.queuedAudio.update(audio.id, {
    synced: true,
    storage_url: data.path, // PATH, not URL
  });
}

// When syncing attempts
const audioRecord = await db.queuedAudio.get(attempt.audio_blob_id);
const audioPath = audioRecord?.storage_url;

await supabase.from("attempts").insert({
  child_id: attempt.child_id,
  word_id: attempt.word_id,
  audio_url: audioPath, // PATH, not URL
  // ... other fields
});
```

## Helper Functions

### `getSignedAudioUrl(path, expiresIn?)`

Generates a single signed URL.

**Parameters:**

- `path` (string): Storage path from `attempts.audio_url`
- `expiresIn` (number, optional): TTL in seconds (default: 3600 = 1 hour)

**Returns:** `Promise<string | null>` - Signed URL or null on error

**Example:**

```typescript
const signedUrl = await getSignedAudioUrl("user-id/list-id/word_123.webm");
```

### `getSignedAudioUrls(paths, expiresIn?)`

Generates multiple signed URLs in parallel.

**Parameters:**

- `paths` (string[]): Array of storage paths
- `expiresIn` (number, optional): TTL in seconds (default: 3600 = 1 hour)

**Returns:** `Promise<Record<string, string | null>>` - Map of paths to signed URLs

**Example:**

```typescript
const urls = await getSignedAudioUrls([
  "user-id/list-id/word_123.webm",
  "user-id/list-id/word_456.webm",
]);

console.log(urls["user-id/list-id/word_123.webm"]); // Signed URL
```

## Migration Files

1. **20251109164108_secure_audio_recordings_private.sql**
   - Drops old policies
   - Ensures bucket is private
   - Adds new RLS policies with parent-child relationship checks

2. **20251109164346_document_audio_url_security.sql**
   - Adds database comments documenting the security model
   - Clarifies that `audio_url` stores paths, not URLs

## Testing

### Test Signed URL Generation

```typescript
// Test as parent
const parentUser = { id: "parent-uuid", role: "parent" };
const childUser = { id: "child-uuid", role: "child" };

// Upload as child
const { data } = await supabase.storage
  .from("audio-recordings")
  .upload(`${childUser.id}/list/word_123.webm`, audioBlob);

// Parent should be able to generate signed URL
const signedUrl = await getSignedAudioUrl(data.path);
expect(signedUrl).not.toBeNull();

// Signed URL should work for 1 hour
const response = await fetch(signedUrl);
expect(response.ok).toBe(true);
```

### Test RLS Policies

```typescript
// Test parent can access child recording
const { data, error } = await supabase.storage
  .from("audio-recordings")
  .createSignedUrl(`${childId}/list/word.webm`, 3600);

expect(error).toBeNull();

// Test stranger cannot access
await supabase.auth.signInWithPassword({
  email: "stranger@example.com",
  password: "password",
});

const { error: accessError } = await supabase.storage
  .from("audio-recordings")
  .createSignedUrl(`${childId}/list/word.webm`, 3600);

expect(accessError).not.toBeNull();
```

## Security Benefits

1. **Private by Default**: Recordings not accessible via public URLs
2. **Time-Limited Access**: Signed URLs expire after 1 hour
3. **Relationship Enforcement**: RLS policies ensure only parents/children can access
4. **No Direct Links**: URLs cannot be shared or embedded without expiration
5. **Audit Trail**: Supabase logs all storage access attempts

## Migration Checklist

- [x] Create migration for private bucket policies
- [x] Add helper functions for signed URL generation
- [x] Update `PlaySaySpell.tsx` to store paths
- [x] Update `sync.ts` to store paths
- [x] Update `supa.ts` upload function
- [x] Document security model
- [ ] Apply migrations: `.\push-migration.ps1`
- [ ] Test signed URL generation in dev environment
- [ ] Test RLS policies with different user roles
- [ ] Test offline sync with new security model
- [ ] Update analytics/parent dashboards if they display attempt audio

## Future Considerations

If you need to add audio playback to analytics or parent dashboards:

1. Query attempts with `audio_url` paths
2. Use `getSignedAudioUrls()` for bulk URL generation
3. Cache signed URLs client-side for the TTL duration
4. Regenerate URLs after expiration (1 hour)
5. Consider shorter TTL (e.g., 300s = 5 min) for sensitive contexts
