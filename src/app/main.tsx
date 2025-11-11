import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import {
  syncQueuedData,
  hasPendingSync,
  migrateSyncedFieldToBoolean,
} from "@/lib/sync";
import { logger } from "@/lib/logger";
import { hasSupabaseConfig, getSupabaseConfigErrors } from "./supabase";
import { SetupError } from "./components/SetupError";
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

// Check for force update flag (for critical releases)
const FORCE_UPDATE_ON_ACTIVATION =
  import.meta.env.VITE_FORCE_UPDATE === "true" || false;

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
                // New service worker activated
                logger.info("New service worker activated");

                if (FORCE_UPDATE_ON_ACTIVATION) {
                  // Critical release: force immediate reload
                  logger.info("Force update enabled, reloading immediately");
                  window.location.reload();
                } else {
                  // Standard update: show banner for user control
                  logger.info("Update available, showing banner");
                  // Trigger re-render to show banner
                  window.dispatchEvent(new CustomEvent("sw-update-available"));
                }
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

// Import clearAppCaches side effect to expose it globally
// The cacheUtils module registers window.clearAppCaches for debugging
import "@/lib/cacheUtils";

// Periodic sync fallback for browsers without Background Sync API
let periodicSyncInterval: NodeJS.Timeout | null = null;

/**
 * Start periodic sync as fallback when Background Sync API is not available
 */
function startPeriodicSyncFallback(): void {
  // Clear existing interval if any
  if (periodicSyncInterval) {
    clearInterval(periodicSyncInterval);
  }

  // Check for pending data every 30 seconds when online
  periodicSyncInterval = setInterval(async () => {
    if (!navigator.onLine) {
      return;
    }

    try {
      const hasPending = await hasPendingSync();
      if (hasPending) {
        logger.info("Periodic sync: syncing queued data");
        await syncQueuedData();
      }
    } catch (error) {
      logger.error("Periodic sync failed:", error);
    }
  }, 30000); // 30 seconds

  logger.info("Periodic sync fallback started");
}

/**
 * Stop periodic sync fallback
 */
function stopPeriodicSyncFallback(): void {
  if (periodicSyncInterval) {
    clearInterval(periodicSyncInterval);
    periodicSyncInterval = null;
    logger.info("Periodic sync fallback stopped");
  }
}

/**
 * Check if Background Sync API is supported
 */
async function isBackgroundSyncSupported(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) {
    return false;
  }

  if (!("SyncManager" in window)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    // Check if sync property exists and is usable
    const syncRegistration = registration as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    };

    if (
      !syncRegistration.sync ||
      typeof syncRegistration.sync.register !== "function"
    ) {
      return false;
    }
    return true;
  } catch (error) {
    logger.warn("Background Sync capability check failed:", error);
    return false;
  }
}

/**
 * Register background sync with proper error handling
 */
async function registerBackgroundSync(): Promise<boolean> {
  try {
    const isSupported = await isBackgroundSyncSupported();

    if (!isSupported) {
      logger.info("Background Sync API not supported, using periodic fallback");
      startPeriodicSyncFallback();
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const syncRegistration = registration as ServiceWorkerRegistration & {
      sync: { register: (tag: string) => Promise<void> };
    };

    await syncRegistration.sync.register("attempt-sync");
    logger.info("Background sync registered successfully");

    // Stop periodic fallback since Background Sync is working
    stopPeriodicSyncFallback();
    return true;
  } catch (error) {
    logger.error("Failed to register background sync:", error);
    // Fallback to periodic sync on failure
    logger.info("Falling back to periodic sync");
    startPeriodicSyncFallback();
    return false;
  }
} // Listen for online/offline events
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

  // Register background sync with proper error handling and fallback
  await registerBackgroundSync();
});

window.addEventListener("offline", () => {
  // App is offline - operations will be queued
  // Stop periodic sync to save resources
  stopPeriodicSyncFallback();
});

// Render the application
const rootElement = document.getElementById("root");
if (rootElement) {
  // Check for Supabase configuration in production
  // In development, the error is thrown immediately in supabase.ts
  if (!hasSupabaseConfig() && !import.meta.env.DEV) {
    const configErrors = getSupabaseConfigErrors();

    createRoot(rootElement).render(
      <StrictMode>
        <SetupError
          message="SpellStars requires Supabase configuration to function."
          details={configErrors}
        />
      </StrictMode>
    );
  } else {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  }
}
