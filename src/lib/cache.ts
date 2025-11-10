/**
 * PWA Cache Management Utilities
 *
 * Provides auth-aware cache management to prevent stale private data
 * from being served after sign-out or user switches.
 */

import { logger } from "./logger";

/**
 * Cache names used by the application
 * These should match the cacheName values in vite.config.ts
 */
export const CACHE_NAMES = {
  AUTH: "supabase-auth-cache",
  API: "supabase-api-cache",
  STORAGE: "supabase-storage-cache",
  CHILD_ROUTES: "child-routes-cache",
  PARENT_ROUTES: "parent-routes-cache",
} as const;

/**
 * Cache categories for selective clearing
 */
export type CacheCategory = "all" | "auth" | "routes" | "api";

/**
 * Clear all PWA caches
 * Use this on sign-out to prevent serving stale authenticated content
 */
export async function clearAllCaches(): Promise<void> {
  if (!("caches" in window)) {
    logger.warn("Cache API not available");
    return;
  }

  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    logger.info("All caches cleared");
  } catch (error) {
    logger.error("Failed to clear all caches:", error);
    throw error;
  }
}

/**
 * Clear specific cache by name
 */
export async function clearCache(cacheName: string): Promise<void> {
  if (!("caches" in window)) {
    logger.warn("Cache API not available");
    return;
  }

  try {
    const deleted = await caches.delete(cacheName);
    if (deleted) {
      logger.info(`Cache cleared: ${cacheName}`);
    } else {
      logger.warn(`Cache not found: ${cacheName}`);
    }
  } catch (error) {
    logger.error(`Failed to clear cache ${cacheName}:`, error);
    throw error;
  }
}

/**
 * Clear user-specific caches (routes and API data)
 * Preserves static assets (storage cache)
 */
export async function clearUserCaches(): Promise<void> {
  if (!("caches" in window)) {
    logger.warn("Cache API not available");
    return;
  }

  try {
    await Promise.all([
      clearCache(CACHE_NAMES.AUTH),
      clearCache(CACHE_NAMES.API),
      clearCache(CACHE_NAMES.CHILD_ROUTES),
      clearCache(CACHE_NAMES.PARENT_ROUTES),
    ]);
    logger.info("User-specific caches cleared");
  } catch (error) {
    logger.error("Failed to clear user caches:", error);
    throw error;
  }
}

/**
 * Clear caches by category
 */
export async function clearCachesByCategory(
  category: CacheCategory
): Promise<void> {
  if (!("caches" in window)) {
    logger.warn("Cache API not available");
    return;
  }

  try {
    switch (category) {
      case "all":
        await clearAllCaches();
        break;
      case "auth":
        await clearCache(CACHE_NAMES.AUTH);
        break;
      case "routes":
        await Promise.all([
          clearCache(CACHE_NAMES.CHILD_ROUTES),
          clearCache(CACHE_NAMES.PARENT_ROUTES),
        ]);
        break;
      case "api":
        await clearCache(CACHE_NAMES.API);
        break;
      default:
        logger.warn(`Unknown cache category: ${category}`);
    }
  } catch (error) {
    logger.error(`Failed to clear caches for category ${category}:`, error);
    throw error;
  }
}

/**
 * Get cache size information (debugging utility)
 */
export async function getCacheInfo(): Promise<Map<string, number>> {
  if (!("caches" in window)) {
    return new Map();
  }

  const cacheInfo = new Map<string, number>();

  try {
    const cacheNames = await caches.keys();

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      cacheInfo.set(cacheName, keys.length);
    }
  } catch (error) {
    logger.error("Failed to get cache info:", error);
  }

  return cacheInfo;
}

/**
 * Clear expired entries from a specific cache
 * (Service worker should handle this automatically, but this can be used as fallback)
 */
export async function pruneCache(
  cacheName: string,
  maxAge: number
): Promise<void> {
  if (!("caches" in window)) {
    return;
  }

  try {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    const now = Date.now();

    for (const request of requests) {
      const response = await cache.match(request);
      if (!response) continue;

      const dateHeader = response.headers.get("date");
      if (!dateHeader) continue;

      const responseDate = new Date(dateHeader).getTime();
      const age = now - responseDate;

      if (age > maxAge) {
        await cache.delete(request);
        logger.debug(`Pruned expired entry from ${cacheName}: ${request.url}`);
      }
    }
  } catch (error) {
    logger.error(`Failed to prune cache ${cacheName}:`, error);
  }
}

/**
 * Invalidate all caches and reload the page
 * Use this for critical updates or when cache corruption is suspected
 */
export async function hardRefresh(): Promise<void> {
  try {
    await clearAllCaches();

    // Unregister service worker
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map((registration) => registration.unregister())
      );
    }

    // Hard reload
    window.location.reload();
  } catch (error) {
    logger.error("Failed to perform hard refresh:", error);
    // Reload anyway
    window.location.reload();
  }
}
