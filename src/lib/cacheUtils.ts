import { queryClient } from "@/app/queryClient";
import { logger } from "@/lib/logger";

/**
 * Manually clear all app caches
 * Useful for debugging or forcing a fresh start
 */
export async function clearAppCaches(): Promise<void> {
  try {
    // Clear all cache storage
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map((cacheName) => {
        logger.info(`Deleting cache: ${cacheName}`);
        return caches.delete(cacheName);
      })
    );

    // Clear React Query cache
    queryClient.clear();

    logger.info("All caches cleared successfully");
  } catch (error) {
    logger.error("Failed to clear caches:", error);
    throw error;
  }
}

// Expose clearAppCaches globally for debugging
if (typeof window !== "undefined") {
  interface WindowWithCache extends Window {
    clearAppCaches: typeof clearAppCaches;
  }
  (window as unknown as WindowWithCache).clearAppCaches = clearAppCaches;
}
