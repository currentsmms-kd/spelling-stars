# Signed URL Cache Security

## Overview

This document describes the caching strategy implemented to prevent signed URLs from being cached past their Time-To-Live (TTL), which would cause access errors when the token expires.

## Problem

Previously, all Supabase Storage URLs were cached with `CacheFirst` strategy for 7 days. This caused issues with signed URLs (used for private audio recordings) because:

1. **Signed URLs have 1-hour TTL** - They expire after 1 hour for security
2. **CacheFirst serves stale URLs** - Cached URLs with expired tokens would be served, causing 403 errors
3. **No distinction between public and private** - All storage URLs were treated the same

## Solution

### Split Storage Caching Strategy

The storage caching has been split into three distinct rules in `vite.config.ts`:

#### 1. Private Audio Recordings (NetworkOnly)

```typescript
{
  urlPattern: ({ url }: { url: URL }) => {
    const isStorage = url.hostname.includes('.supabase.co') && url.pathname.includes('/storage/');
    const isAudioRecordings = url.pathname.includes('/audio-recordings/');
    const hasSignedToken = url.searchParams.has('token');
    return isStorage && (isAudioRecordings || hasSignedToken);
  },
  handler: "NetworkOnly",
  options: {
    cacheName: "private-audio-cache",
  },
}
```

**When it matches:**

- URLs containing `/audio-recordings/` path (private bucket)
- Any Storage URL with a `token` query parameter (signed URL)

**Behavior:**

- `NetworkOnly` - Never caches, always fetches from network
- Prevents serving expired signed URLs
- Ensures fresh tokens on every request

#### 2. Public Static Assets (CacheFirst - Reduced TTL)

```typescript
{
  urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/word-audio\/.*/i,
  handler: "CacheFirst",
  options: {
    cacheName: "public-audio-cache",
    expiration: {
      maxEntries: 100,
      maxAgeSeconds: 60 * 60 * 24 * 2, // 2 days (reduced from 7)
    },
  },
}
```

**When it matches:**

- Public `word-audio` bucket URLs (prompt audio files)

**Behavior:**

- `CacheFirst` - Serves from cache if available
- **2-day TTL** (reduced from 7 days)
- Suitable for public, unchanging audio prompts
- Reduces bandwidth for frequently accessed files

#### 3. Other Storage (NetworkFirst - Fallback)

```typescript
{
  urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
  handler: "NetworkFirst",
  options: {
    cacheName: "supabase-storage-fallback",
    expiration: {
      maxEntries: 50,
      maxAgeSeconds: 60 * 30, // 30 minutes
    },
    networkTimeoutSeconds: 5,
  },
}
```

**When it matches:**

- Any other Supabase Storage URL not caught by rules 1 or 2

**Behavior:**

- `NetworkFirst` - Tries network first, falls back to cache
- **30-minute TTL** - Short cache for recent requests
- Catches edge cases and future storage buckets

### Cache Clearing on Sign-Out

Updated `src/lib/cache.ts` to clear all audio caches on sign-out:

```typescript
export const CACHE_NAMES = {
  AUTH: "supabase-auth-cache",
  API: "supabase-api-cache",
  STORAGE: "supabase-storage-cache", // DEPRECATED
  PRIVATE_AUDIO: "private-audio-cache",
  PUBLIC_AUDIO: "public-audio-cache",
  STORAGE_FALLBACK: "supabase-storage-fallback",
  CHILD_ROUTES: "child-routes-cache",
  PARENT_ROUTES: "parent-routes-cache",
} as const;

export async function clearUserCaches(): Promise<void> {
  await Promise.all([
    clearCache(CACHE_NAMES.AUTH),
    clearCache(CACHE_NAMES.API),
    clearCache(CACHE_NAMES.CHILD_ROUTES),
    clearCache(CACHE_NAMES.PARENT_ROUTES),
    clearCache(CACHE_NAMES.PRIVATE_AUDIO), // Clear private audio
    clearCache(CACHE_NAMES.STORAGE_FALLBACK), // Clear fallback
    clearCache(CACHE_NAMES.STORAGE), // Clear deprecated cache
  ]);
}
```

**When it's called:**

- Explicit sign-out via `useAuth().signOut()`
- Auth state change to `SIGNED_OUT`

**What it clears:**

- All private audio caches (any stale signed URLs)
- Storage fallback cache
- Auth, API, and route caches

**What it preserves:**

- `public-audio-cache` (public prompt audio files)
- These are truly public and don't need clearing

## Security Benefits

### 1. Prevents Unauthorized Access

- Signed URLs cannot be accessed after expiration
- No cached tokens that outlive their validity period
- Forces fresh authentication check on every private audio request

### 2. User Isolation

- Sign-out clears all user-specific cached data
- Prevents user A from accessing user B's cached private audio
- Protects against shared-device scenarios

### 3. Token Freshness

- Private audio always fetches with current, valid signed URL
- 1-hour TTL respected at application level
- No reliance on browser cache expiration heuristics

### 4. Defense in Depth

- Multiple detection methods: path matching + token parameter
- Fallback rule catches edge cases
- NetworkOnly ensures no accidental caching

## Performance Considerations

### Tradeoffs

**Pros:**

- ✅ Correct security behavior
- ✅ Public assets still cached (prompt audio)
- ✅ Minimal impact on bandwidth for most users

**Cons:**

- ❌ Private audio always fetches from network
- ❌ No offline playback of private recordings
- ❌ Slightly increased latency for private audio playback

### Bandwidth Impact

**Mitigated by:**

1. Private recordings are typically played once per session
2. Public prompt audio (most frequently accessed) still cached
3. Audio files are relatively small (WebM, typically < 100KB)
4. SRS algorithm spaces out repetitions (not frequently accessed)

### Offline Behavior

**Private audio:** Cannot be played offline (requires signed URL fetch)
**Public prompt audio:** Can be played offline (cached up to 2 days)
**Workaround:** Queue attempts offline, sync audio when online (existing behavior)

## Testing

### Verify Signed URLs Not Cached

1. Open DevTools > Application > Cache Storage
2. Sign in as child, play a game, record audio
3. Check `private-audio-cache` - should be empty (NetworkOnly)
4. Check Network tab - private audio fetches show no `(from ServiceWorker)` label

### Verify Public Audio Cached

1. Open DevTools > Application > Cache Storage
2. Play a game with prompt audio (listen-type mode)
3. Check `public-audio-cache` - should contain `word-audio` URLs
4. Refresh page, play same word
5. Network tab should show `(from ServiceWorker)` for prompt audio

### Verify Cache Clearing

1. Sign in, play games (generate cache entries)
2. Check Cache Storage - multiple caches populated
3. Sign out
4. Check Cache Storage - `private-audio-cache`, `supabase-storage-fallback` should be deleted
5. `public-audio-cache` should remain (optional, can persist)

## Migration Notes

### For Existing Users

**First load after update:**

- Old `supabase-storage-cache` will remain until:
  - Service worker activates and runs `cleanupOutdatedCaches`
  - User signs out (explicitly cleared)
  - Cache storage quota exceeded (browser LRU eviction)

**Graceful degradation:**

- If signed URL cached from old service worker, first playback may fail
- Retry mechanism in `AudioRecorder.tsx` will refetch with fresh URL
- Subsequent requests use new `NetworkOnly` strategy

### Breaking Changes

❌ **None** - Purely additive changes to caching strategy

### Backwards Compatibility

✅ **Fully compatible** - Old cache names still cleared on sign-out

## Related Files

- `vite.config.ts` - Service worker caching configuration
- `src/lib/cache.ts` - Cache management utilities
- `src/app/hooks/useAuth.ts` - Sign-out logic calling `clearUserCaches()`
- `docs/AUDIO_RECORDING_SECURITY.md` - Private audio bucket security
- `docs/PROMPT_AUDIO_SECURITY.md` - Public prompt audio security
- `docs/CACHE_SECURITY.md` - General cache security overview

## Monitoring

### Logs to Watch

```typescript
// Sign-out cache clearing
logger.info("User caches cleared on sign-out");
logger.info("User-specific caches cleared (including private audio)");

// Cache operation failures (should be rare)
logger.error("Failed to clear caches on sign-out:", error);
```

### Metrics to Track

1. **Cache hit rates** - Expect lower rate for private audio (always NetworkOnly)
2. **Failed audio playback** - Should decrease after this fix (no stale signed URLs)
3. **Sign-out duration** - May increase slightly (more caches to clear)
4. **Bandwidth usage** - May increase slightly (private audio not cached)

## Future Enhancements

### Potential Optimizations

1. **Client-side token refresh** - Detect expiring tokens, refresh before playback
2. **IndexedDB backup** - Store audio Blobs in IndexedDB for offline playback, re-sign on load
3. **Prefetch signed URLs** - Generate signed URLs for entire session's words upfront
4. **CDN distribution** - Serve audio through CDN with custom auth (eliminates signed URL need)

### Not Recommended

❌ **Caching signed URLs with token refresh** - Complex, error-prone, minimal benefit
❌ **Removing signed URLs entirely** - Would require making audio-recordings public (security risk)
❌ **Longer TTL on signed URLs** - Increases security window, doesn't eliminate cache issue

## Conclusion

This implementation ensures signed URLs are never cached past their TTL while maintaining efficient caching for public assets. The split strategy balances security (private audio never cached) with performance (public audio cached with reasonable TTL).

**Key takeaway:** Private audio security is more important than caching convenience. The `NetworkOnly` strategy for signed URLs is the correct approach.
