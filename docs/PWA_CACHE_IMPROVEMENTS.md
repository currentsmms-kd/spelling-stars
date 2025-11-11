# PWA Cache Improvements

## Summary

Implemented comprehensive PWA caching improvements to prevent stale app shell and API responses from masking fixes and causing inconsistent behavior. Changes include cache versioning, reduced TTLs, service worker activation prompts, and manual data refresh capabilities.

## Changes Made

### 1. vite.config.ts - PWA Configuration Improvements

**Cache Versioning**

- Added `CACHE_VERSION = "v1"` constant for cache invalidation
- All cache names now include version suffix: `supabase-api-v1`, `child-routes-v1`, etc.
- Incrementing the version will force all users to refresh their caches on next deployment

**Reduced Cache TTLs**

- API cache: 5 minutes → **3 minutes** (faster updates)
- Storage fallback: 30 minutes → **15 minutes** (fresher content)
- Child routes: 24 hours → **12 hours** (more frequent checks)
- Parent routes: 1 hour → **30 minutes** (quicker parent area updates)

**Service Worker Activation**

- Added `skipWaiting: true` - New service worker activates immediately
- Added `clientsClaim: true` - Takes control of all clients immediately
- Combined with `cleanupOutdatedCaches: true` ensures old caches are removed

### 2. src/app/main.tsx - Update Prompt & Manual Cache Clearing

**Update Detection & User Prompt**

```typescript
// Check for updates every hour
setInterval(
  () => {
    registration.update();
  },
  60 * 60 * 1000
);

// Prompt user when new version is available
registration.addEventListener("updatefound", () => {
  const newWorker = registration.installing;
  if (newWorker) {
    newWorker.addEventListener("statechange", () => {
      if (
        newWorker.state === "activated" &&
        navigator.serviceWorker.controller
      ) {
        const shouldRefresh = confirm(
          "A new version of SpellStars is available. Refresh now to get the latest updates?"
        );
        if (shouldRefresh) {
          window.location.reload();
        }
      }
    });
  }
});
```

**Manual Cache Clearing**

```typescript
export async function clearAppCaches(): Promise<void> {
  // Clear all cache storage
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));

  // Clear React Query cache
  queryClient.clear();

  logger.info("All caches cleared successfully");
}

// Exposed globally for debugging: window.clearAppCaches()
```

### 3. src/lib/cache.ts - Enhanced Cache Management

**Cache Versioning**

```typescript
const CACHE_VERSION = "v1";

export const CACHE_NAMES = {
  AUTH: `supabase-auth-${CACHE_VERSION}`,
  API: `supabase-api-${CACHE_VERSION}`,
  PRIVATE_AUDIO: `private-audio-${CACHE_VERSION}`,
  PUBLIC_AUDIO: `public-audio-${CACHE_VERSION}`,
  STORAGE_FALLBACK: `supabase-storage-${CACHE_VERSION}`,
  CHILD_ROUTES: `child-routes-${CACHE_VERSION}`,
  PARENT_ROUTES: `parent-routes-${CACHE_VERSION}`,
} as const;
```

**New Functions**

1. **clearAllAppData(reactQueryClient)** - Comprehensive cache clear
   - Clears all PWA caches
   - Clears React Query in-memory cache
   - Use for troubleshooting or after major updates

2. **refreshAllData(reactQueryClient)** - Smart data refresh
   - Clears user-specific caches (routes, API data)
   - Preserves static assets (public audio)
   - Invalidates and refetches all React Query data
   - Does NOT reload page - seamless UX

### 4. src/app/pages/parent/Settings.tsx - User-Facing Cache Controls

**Added "Refresh Data" Button**

- Primary action for getting latest content
- Clears user caches and invalidates React Query
- Keeps static assets cached for performance
- No page reload required

**Enhanced Cache Management UI**

```
┌─────────────────────────────────────────┐
│ Cache & Data Management                 │
├─────────────────────────────────────────┤
│ Cache Status: 42 items cached           │
│   supabase-api-v1: 15 items            │
│   child-routes-v1: 12 items            │
│   parent-routes-v1: 8 items            │
│   public-audio-v1: 7 items             │
├─────────────────────────────────────────┤
│ [Refresh Data] [Clear User Data] [Clear All] │
└─────────────────────────────────────────┘
```

**Three-Tier Clearing Strategy**

1. **Refresh Data** (Recommended for regular use)
   - Fetches latest content from server
   - Keeps static assets
   - No confirmation required
   - Seamless UX

2. **Clear User Data** (For troubleshooting)
   - Removes personal content caches
   - Clears React Query cache
   - Safe for regular use
   - No static asset re-download

3. **Clear All Caches** (Nuclear option)
   - Removes everything including static assets
   - Requires confirmation
   - Use only when experiencing issues
   - May require re-downloading audio files

## Cache Behavior Overview

### Before Changes

- API responses cached for 5 minutes
- Child routes cached for 7 days
- No version control on caches
- No update prompts
- Manual refresh only via browser hard reload

### After Changes

- API responses cached for 3 minutes
- Child routes cached for 12 hours
- Versioned cache names for controlled invalidation
- Automatic update detection with user prompt
- Three levels of manual refresh/clear options
- Service worker updates immediately with `skipWaiting`

## Deployment Strategy

### To Force Cache Refresh for All Users

1. Update `CACHE_VERSION` in both files:
   - `vite.config.ts` (line 7)
   - `src/lib/cache.ts` (line 13)

```typescript
// Before
const CACHE_VERSION = "v1";

// After (increment)
const CACHE_VERSION = "v2";
```

2. Build and deploy:

```powershell
npm run build
# Deploy to production
```

3. What happens on user's next visit:
   - Service worker detects new version
   - User sees prompt: "A new version of SpellStars is available. Refresh now?"
   - On refresh, old caches (`*-v1`) are cleaned up
   - New caches (`*-v2`) are created
   - Users get fresh content

### Regular Maintenance

**For Bug Fixes**

- Deploy normally
- Reduced TTLs ensure fixes propagate within 3-12 hours
- Users with issues can click "Refresh Data"

**For Major Updates**

- Increment `CACHE_VERSION`
- Update prompt guides users to refresh
- Old caches auto-deleted

## Testing

### Test Cache Versioning

```powershell
# 1. Open DevTools > Application > Cache Storage
# 2. Verify cache names include version: "supabase-api-v1"
# 3. Change CACHE_VERSION to "v2"
# 4. Rebuild: npm run build
# 5. Refresh app
# 6. Verify new caches: "supabase-api-v2"
# 7. Verify old caches deleted: "supabase-api-v1" gone
```

### Test Update Prompt

```powershell
# 1. Build and run: npm run build && npm run preview
# 2. Open in browser
# 3. Make a code change
# 4. Rebuild: npm run build
# 5. Wait ~1 minute (update check runs hourly, but also on page focus)
# 6. Verify prompt appears
```

### Test Manual Refresh

```powershell
# 1. Navigate to /parent/settings
# 2. Scroll to "Cache & Data Management"
# 3. Click "Refresh Data"
# 4. Verify message: "Data refreshed successfully"
# 5. Check DevTools Console for:
#    - "User-specific caches cleared"
#    - "React Query data invalidated and refetching"
```

### Test Clear All Caches

```powershell
# 1. Navigate to /parent/settings
# 2. Click "Clear All Caches"
# 3. Confirm prompt
# 4. Verify message: "All caches cleared successfully"
# 5. Check DevTools > Application > Cache Storage
# 6. Verify all caches removed
# 7. On next navigation, verify caches rebuilt
```

## Debugging

### Global Functions (Console)

```javascript
// Clear all caches (PWA + React Query)
await window.clearAppCaches();

// Get cache info
const info = await getCacheInfo();
console.log(Object.fromEntries(info));
```

### Check Service Worker Status

```javascript
// In console
navigator.serviceWorker.getRegistration().then((reg) => {
  console.log("Active SW:", reg.active?.scriptURL);
  console.log("Waiting SW:", reg.waiting?.scriptURL);
  console.log("Installing SW:", reg.installing?.scriptURL);
});
```

### Monitor Cache Operations

All cache operations are logged via `src/lib/logger.ts`:

```
[INFO] All caches cleared
[INFO] React Query cache cleared
[INFO] User-specific caches cleared (including private audio)
[INFO] React Query data invalidated and refetching
```

## User Impact

### Positive

- **Faster bug fixes propagate** - Reduced TTLs mean fixes reach users quicker
- **Clear feedback on updates** - Users know when new version is available
- **Self-service troubleshooting** - "Refresh Data" button empowers users
- **No stale content issues** - Versioned caches prevent serving outdated data

### Considerations

- **Slightly more network usage** - Shorter cache TTLs = more frequent checks
- **Update prompts may interrupt** - Users will see confirmation dialog on updates
- **"Refresh Data" not automatic** - Users must initiate when they suspect stale content

## Recommended Usage

**For Parents (in Settings)**

- Use "Refresh Data" if word lists aren't showing latest changes
- Use "Clear User Data" if experiencing weird behavior
- Use "Clear All Caches" only if app seems completely broken

**For Developers**

- Increment `CACHE_VERSION` for releases with critical fixes
- Use "Clear All Caches" when testing new features
- Use `window.clearAppCaches()` in console during development

## Files Modified

1. `vite.config.ts` - PWA plugin configuration
2. `src/app/main.tsx` - Service worker registration and update detection
3. `src/lib/cache.ts` - Cache management utilities
4. `src/app/pages/parent/Settings.tsx` - User-facing cache controls

## Related Documentation

- [PWA Best Practices](https://web.dev/pwa/)
- [Service Worker Lifecycle](https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle)
- [React Query Caching](https://tanstack.com/query/latest/docs/react/guides/caching)
- [Workbox Strategies](https://developer.chrome.com/docs/workbox/caching-strategies-overview/)
