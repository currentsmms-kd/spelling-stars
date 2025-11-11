# Attempt Audio Playback Implementation

## Overview

Say & Spell game mode records children's audio as they spell words aloud. This document details how audio recordings are stored and played back securely.

## Storage Architecture

### Path vs. URL Storage

**CRITICAL:** The `attempts.audio_url` column stores **STORAGE PATHS**, not playable URLs.

```typescript
// ✅ CORRECT: Store path
audio_url: "uuid-child-id/uuid-list-id/uuid-word-id_1699999999999.webm";

// ❌ WRONG: Store URL (expires, breaks security)
audio_url: "https://xyz.supabase.co/storage/v1/object/sign/...";
```

### Path Format Requirements

**Format:** `{child_id}/{list_id}/{word_id}_{timestamp}.webm`

**Why this format?**

- RLS policies verify access using `(storage.foldername(name))[1]`
- First path segment MUST be the child's user ID for security checks
- Parent-child relationship validation depends on this structure

## Security Model

### Private Bucket with Signed URLs

The `audio-recordings` bucket is **PRIVATE** (not public):

- Direct URL access returns 403 Forbidden
- Access requires signed URL with 1-hour TTL
- Signed URLs generated on-demand, never cached

### RLS Policies (from migration 20251109164108)

```sql
-- SELECT policy: Who can generate signed URLs?
-- 1. Child who created the recording (auth.uid() matches first path segment)
-- 2. Parent of the child (role='parent' + child relationship)
CREATE POLICY "Users can view own or child audio recordings"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'audio-recordings'
        AND (
            auth.uid()::text = (storage.foldername(name))[1]
            OR
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

## Implementation Guide

### Storing Audio (Say & Spell Game)

#### Online Mode

```typescript
// PlaySaySpell.tsx - lines 569-584
const timestamp = Date.now();
const fileName = `${profile.id}/${listId}/${wordId}_${timestamp}.webm`;

const { data, error } = await supabase.storage
  .from("audio-recordings")
  .upload(fileName, audioBlob, {
    contentType: "audio/webm",
    cacheControl: "3600",
  });

if (!error && data) {
  audioPath = data.path; // ✅ Store PATH, not URL
}

// Insert attempt with path
await supabase.from("attempts").insert({
  child_id: profile.id,
  word_id: wordId,
  audio_url: audioPath, // ✅ Path stored here
  // ... other fields
});
```

#### Offline Mode

```typescript
// PlaySaySpell.tsx - lines 655-658
const timestamp = Date.now();
const fileName = `${profile?.id}/${listId}/${currentWord?.id}_${timestamp}.webm`;
const audioBlobId = await queueAudio(recordedBlob, fileName);

// Later, sync.ts uploads with same path format
await supabase.storage
  .from("audio-recordings")
  .upload(audio.filename, audio.blob);
```

### Playing Back Audio (Parent Dashboard / Review UI)

#### Option 1: React Query Hooks (Recommended)

```typescript
import { useAttempts, useAttemptsForWord } from '@/app/api/supa';

function AttemptHistory({ childId }: { childId: string }) {
  // Hook automatically generates signed URLs
  const { data: attempts, isLoading } = useAttempts(childId);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {attempts?.map(attempt => (
        <div key={attempt.id}>
          <p>Word: {attempt.word_id}</p>
          <p>Correct: {attempt.correct ? "✓" : "✗"}</p>

          {/* Play audio if available */}
          {attempt.audio_signed_url && (
            <audio src={attempt.audio_signed_url} controls />
          )}
        </div>
      ))}
    </div>
  );
}
```

**Hook Features:**

- `staleTime: 0` - Always fetches fresh to avoid expired signed URLs
- `gcTime: 1000 * 60 * 30` - Caches for 30 min (within 1hr TTL)
- Batch generates signed URLs efficiently

#### Option 2: Manual Helper (Not Recommended)

```typescript
import { getAttempts, getAttemptsWithSignedUrls } from "@/app/api/supa";

async function loadAttempts(childId: string) {
  // Fetch attempts (paths only)
  const attempts = await getAttempts(childId);

  // Generate signed URLs for playback
  const attemptsWithAudio = await getAttemptsWithSignedUrls(attempts);

  return attemptsWithAudio; // Now includes audio_signed_url field
}
```

#### Option 3: Single Audio URL Generation

```typescript
import { getSignedAudioUrl } from "@/app/api/supa";

async function playAttemptAudio(attempt: Attempt) {
  if (!attempt.audio_url) return;

  // Generate signed URL from path
  const signedUrl = await getSignedAudioUrl(attempt.audio_url);

  if (signedUrl) {
    const audio = new Audio(signedUrl);
    await audio.play();
  }
}
```

## Migration Documentation

### 20251109164108_secure_audio_recordings_private.sql

- Sets bucket to PRIVATE
- Creates RLS policies for INSERT, SELECT, DELETE
- Path format verification: `(storage.foldername(name))[1]`

### 20251109164346_document_audio_url_security.sql

- Documents that `attempts.audio_url` stores paths
- Explains signed URL requirement
- Warning against direct path usage

## Service Worker Caching

**CRITICAL:** Signed URLs are excluded from service worker cache.

```typescript
// vite.config.ts - NetworkOnly handler
{
  urlPattern: ({ url }) => {
    const isStorage = url.hostname.includes('.supabase.co')
      && url.pathname.includes('/storage/');
    const isAudioRecordings = url.pathname.includes('/audio-recordings/');
    const hasSignedToken = url.searchParams.has('token');
    return isStorage && (isAudioRecordings || hasSignedToken);
  },
  handler: 'NetworkOnly', // ✅ Never cache signed URLs
}
```

**Why?** Signed URLs expire after 1 hour. Cached URLs would become invalid, breaking audio playback.

## Common Mistakes to Avoid

### ❌ Don't Cache Signed URLs

```typescript
// BAD: Signed URL will expire
const signedUrl = await getSignedAudioUrl(path);
localStorage.setItem("cachedAudioUrl", signedUrl); // ❌ Will break
```

### ❌ Don't Use Paths Directly as URLs

```typescript
// BAD: Path is not a URL
<audio src={attempt.audio_url} /> // ❌ 403 Forbidden
```

### ❌ Don't Use Public URLs for Private Buckets

```typescript
// BAD: getPublicUrl() doesn't work on private buckets
const { data } = supabase.storage.from("audio-recordings").getPublicUrl(path); // ❌ Returns URL that 403s
```

### ✅ Do Generate Fresh Signed URLs

```typescript
// GOOD: Fresh signed URL every time
const signedUrl = await getSignedAudioUrl(attempt.audio_url);
<audio src={signedUrl} /> // ✅ Works for 1 hour
```

### ✅ Do Use React Query Hooks

```typescript
// GOOD: Automatic signed URL management
const { data: attempts } = useAttempts(childId);
<audio src={attempts[0].audio_signed_url} /> // ✅ Auto-refreshed
```

## Testing Checklist

### Upload Path Verification

```typescript
// After recording in PlaySaySpell:
// 1. Check database: attempts.audio_url should be path format
SELECT audio_url FROM attempts WHERE child_id = 'uuid' ORDER BY started_at DESC LIMIT 1;
// Expected: "uuid/uuid/uuid_1699999999999.webm"

// 2. Check Storage bucket:
// Navigate to Storage > audio-recordings in Supabase dashboard
// Verify file exists at path shown in database
```

### Signed URL Generation Test

```typescript
// In browser console or test file:
import { getSignedAudioUrl } from "@/app/api/supa";

const path = "child-id/list-id/word-id_1699999999999.webm";
const signedUrl = await getSignedAudioUrl(path);

console.log(signedUrl); // Should include ?token=...
// Should be able to play in <audio> element
```

### RLS Policy Test

```typescript
// Test as child user:
// 1. Should be able to access own recordings
// 2. Should NOT be able to access other children's recordings

// Test as parent user:
// 1. Should be able to access their children's recordings
// 2. Should NOT be able to access unrelated children's recordings
```

## Future Enhancements

### Parent Analytics UI (Not Yet Implemented)

When building attempt history/review UI for parents:

```typescript
import { useAttemptsForWord } from '@/app/api/supa';

function WordDetailView({ childId, wordId }: Props) {
  const { data: attempts } = useAttemptsForWord(childId, wordId);

  return (
    <div>
      <h3>Practice History</h3>
      {attempts?.map(attempt => (
        <Card key={attempt.id}>
          <p>Date: {new Date(attempt.started_at).toLocaleString()}</p>
          <p>Typed: {attempt.typed_answer}</p>
          <p>Result: {attempt.correct ? "✓" : "✗"}</p>

          {attempt.audio_signed_url && (
            <div>
              <p>Audio Recording:</p>
              <audio
                src={attempt.audio_signed_url}
                controls
                preload="none" // Don't preload (saves bandwidth)
              />
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
```

## Related Files

- **Storage:** `src/app/pages/child/PlaySaySpell.tsx` (lines 569-593, 655-658)
- **Sync:** `src/lib/sync.ts` (lines 70-200, 485-505)
- **Helpers:** `src/app/api/supa.ts` (lines 51-144, 482-576, 1407-1444)
- **RLS Policies:** `supabase/migrations/20251109164108_secure_audio_recordings_private.sql`
- **Documentation:** `supabase/migrations/20251109164346_document_audio_url_security.sql`
- **Service Worker:** `vite.config.ts` (NetworkOnly cache handler)

## Summary

✅ **Storage:** Paths stored in `attempts.audio_url`, NOT URLs
✅ **Format:** `{child_id}/{list_id}/{word_id}_{timestamp}.webm`
✅ **Security:** Private bucket with RLS policies based on first path segment
✅ **Playback:** Generate fresh signed URLs (1hr TTL) using helpers/hooks
✅ **Caching:** Signed URLs excluded from service worker cache
✅ **Consistency:** Online and offline modes use identical path format
