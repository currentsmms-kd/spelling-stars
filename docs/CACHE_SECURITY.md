# PWA Cache Security Implementation

## Overview

The SpellStars PWA now implements auth-aware caching strategies to prevent stale private data from being served after sign-out or user switches.

## Changes Made

### 1. Updated Caching Strategy (`vite.config.ts`)

**Previous Issue:** Child routes used `CacheFirst` strategy, which could serve stale authenticated content after sign-out.

**Solution:** Implemented granular caching strategies:

- **Auth endpoints** (`/auth/*`): `NetworkOnly` - Never cached for security
- **API endpoints** (`/rest/*`): `NetworkFirst` with 5-minute expiry - Fresh data prioritized
- **Storage/Assets** (`/storage/*`): `CacheFirst` with 7-day expiry - Safe static content
- **Child routes** (`/child/*`): `NetworkFirst` with 24-hour expiry (reduced from 7 days)
- **Parent routes** (`/parent/*`): `NetworkFirst` with 1-hour expiry

**Benefits:**

- Prevents serving stale authenticated views
- Reduces cache lifetime for sensitive routes
- Maintains offline functionality with network-first approach
- Separates static assets from dynamic content

### 2. Cache Management Utilities (`src/lib/cache.ts`)

Created comprehensive cache management functions:

```typescript
// Clear all caches (complete reset)
await clearAllCaches();

// Clear only user-specific data (preserves static assets)
await clearUserCaches();

// Clear by category
await clearCachesByCategory("auth" | "routes" | "api" | "all");

// Get cache information for debugging
const cacheInfo = await getCacheInfo();
```

**Cache Names:**

- `supabase-auth-cache` - Authentication (never cached)
- `supabase-api-cache` - API responses (5-minute TTL)
- `supabase-storage-cache` - Static assets (7-day TTL)
- `child-routes-cache` - Child pages (24-hour TTL)
- `parent-routes-cache` - Parent pages (1-hour TTL)

### 3. Automatic Cache Clearing on Sign-Out

Updated `useAuth` hook to automatically clear user caches:

```typescript
const signOut = async () => {
  try {
    // Clear user-specific caches to prevent stale data
    await clearUserCaches();
    logger.info("User caches cleared on sign-out");
  } catch (error) {
    // Don't block sign-out if cache clearing fails
    logger.error("Failed to clear caches on sign-out:", error);
  }

  await supabase.auth.signOut();
  logout();
};
```

Also clears caches on `SIGNED_OUT` auth state change for redundancy.

### 4. Manual Cache Management UI

Added Cache Management section to Parent Settings page:

**Features:**

- View cache status (number of cached items per cache)
- Clear User Data button - Removes personal content caches
- Clear All Caches button - Complete cache reset
- Helpful descriptions for each action

**Location:** `/parent/settings` → Cache Management section

## Security Benefits

1. **No Stale User Data:** User-specific caches cleared on every sign-out
2. **Reduced Cache Lifetime:** Sensitive routes have shorter TTLs
3. **Network-First Strategy:** Always attempts fresh data before serving cache
4. **Granular Control:** Different strategies for different content types
5. **Manual Override:** Users can clear caches if issues occur

## Cache Invalidation Strategy

### Automatic Invalidation

- **Sign-out:** All user caches cleared immediately
- **Auth state change:** Caches cleared on `SIGNED_OUT` event
- **Service worker update:** Outdated caches automatically removed

### Expiration Policies

- Auth: Never cached (NetworkOnly)
- API data: 5 minutes
- Parent routes: 1 hour
- Child routes: 24 hours
- Static assets: 7 days

### Manual Invalidation

Parents can manually clear caches via Settings page:

1. Navigate to `/parent/settings`
2. Scroll to "Cache Management"
3. Click "Clear User Data" or "Clear All Caches"

## Testing Cache Behavior

### Test Sign-Out Cache Clearing

1. Sign in as parent or child
2. Navigate through pages
3. Open DevTools → Application → Cache Storage
4. Note cached entries
5. Sign out
6. Check Cache Storage - user caches should be cleared

### Test Offline Functionality

1. Load a child game page
2. Enable offline mode (DevTools → Network → Offline)
3. Refresh page - should load from cache with network attempt first
4. Check console for network timeout fallback

### Test Cache Segmentation

1. Open DevTools → Application → Cache Storage
2. Verify separate caches exist:
   - `supabase-api-cache`
   - `supabase-storage-cache`
   - `child-routes-cache`
   - `parent-routes-cache`

## Migration Notes

### Breaking Changes

- **Child routes no longer use CacheFirst:** May result in slightly more network requests, but ensures fresh data
- **Reduced cache TTLs:** Users may experience more network usage on revisits

### Non-Breaking Changes

- Cache clearing is automatic on sign-out
- Manual cache management is optional
- Offline functionality preserved with NetworkFirst + timeout fallback

## Troubleshooting

### Cache Not Clearing on Sign-Out

1. Check browser console for cache clearing errors
2. Verify Cache API is supported (`'caches' in window`)
3. Manually clear via Settings page
4. Hard refresh: Clear all caches + unregister service worker

### Stale Content After Update

1. Service worker should auto-update on page load
2. Hard refresh: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)
3. Or use "Clear All Caches" button in Settings

### Offline Mode Not Working

1. Verify service worker is registered (`Application → Service Workers`)
2. Check network strategy in DevTools (`Network` tab)
3. Ensure cache entries exist before going offline
4. Check `networkTimeoutSeconds` isn't too aggressive (currently 3s for routes)

## Future Improvements

1. **Per-User Cache Segmentation:** Add user ID to cache names for multi-user devices
2. **Intelligent Preloading:** Preload likely-needed resources based on user role
3. **Cache Warming:** Background fetch for frequently accessed content
4. **Analytics:** Track cache hit/miss rates for optimization
5. **Progressive Enhancement:** More aggressive caching for known-stable content

## References

- [Workbox Caching Strategies](https://developer.chrome.com/docs/workbox/caching-strategies-overview/)
- [Service Worker Lifecycle](https://web.dev/service-worker-lifecycle/)
- [Cache API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Cache)
- [PWA Best Practices](https://web.dev/pwa-checklist/)
