import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { router } from "./router";
import { queryClient } from "./queryClient";
import {
  syncQueuedData,
  hasPendingSync,
  migrateSyncedFieldToBoolean,
} from "@/lib/sync";
import { logger } from "@/lib/logger";
import "../styles/index.css";

// Run one-time migration to normalize synced field types
migrateSyncedFieldToBoolean().catch((error) => {
  logger.error("Failed to migrate synced field:", error);
});

// Initialize theme before rendering
const initializeTheme = () => {
  const storedTheme = localStorage.getItem("color-theme-storage");
  if (storedTheme) {
    try {
      const { state } = JSON.parse(storedTheme);
      if (state?.currentTheme) {
        // Import and apply theme dynamically
        import("@/app/lib/themes").then(({ applyTheme }) => {
          applyTheme(state.currentTheme);
        });
      }
    } catch (error) {
      logger.error("Failed to parse stored theme:", error);
    }
  }
};

// Initialize theme immediately
initializeTheme();

// Register service worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Check for updates periodically
        setInterval(
          () => {
            registration.update();
          },
          60 * 60 * 1000
        ); // Check every hour

        // Listen for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "activated" &&
                navigator.serviceWorker.controller
              ) {
                // New service worker activated - automatically reload to get updates
                // Note: In production, consider implementing a custom update banner
                // For now, auto-reload to ensure users get latest features/fixes
                logger.info("New service worker activated, reloading page");
                window.location.reload();
              }
            });
          }
        });

        // Listen for background sync
        if ("sync" in registration) {
          // Background sync is supported
          logger.info("Background sync is available");
        }
      })
      .catch((error) => {
        logger.error("SW registration failed:", error);
      });
  });
}

// Export function to manually clear caches
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

// Handle background sync for queued attempts
if ("serviceWorker" in navigator && "SyncManager" in window) {
  navigator.serviceWorker.ready.then(() => {
    // The actual sync will be triggered when network is back
  });
}

// Listen for online/offline events
window.addEventListener("online", async () => {
  // Check if there's data to sync
  const hasPending = await hasPendingSync();

  if (hasPending) {
    try {
      await syncQueuedData();
    } catch (error) {
      logger.error("Failed to sync queued data:", error);
    }
  }

  // Register background sync as backup
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    navigator.serviceWorker.ready.then((registration) => {
      // @ts-expect-error - sync API may not be available in all browsers
      return registration.sync.register("attempt-sync");
    });
  }
});

window.addEventListener("offline", () => {
  // App is offline - operations will be queued
});

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>
  );
}
