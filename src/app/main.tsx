import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { router } from "./router";
import { queryClient } from "./queryClient";
import { syncQueuedData, hasPendingSync } from "@/lib/sync";
import "../styles/index.css";

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
      console.error("Failed to parse stored theme:", error);
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
        // Listen for background sync
        if ("sync" in registration) {
          // Background sync is supported
          console.log("Background sync is available");
        }
      })
      .catch((error) => {
        console.error("SW registration failed:", error);
      });
  });
}

// Handle background sync for queued attempts
if ("serviceWorker" in navigator && "SyncManager" in window) {
  navigator.serviceWorker.ready.then(() => {
    // The actual sync will be triggered when network is back
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log("Service worker ready for background sync");
    }
  });
}

// Listen for online/offline events
window.addEventListener("online", async () => {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("App is online - checking for pending sync...");
  }

  // Check if there's data to sync
  const hasPending = await hasPendingSync();

  if (hasPending) {
    try {
      await syncQueuedData();
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log("Successfully synced queued data");
      }
    } catch (error) {
      console.error("Failed to sync queued data:", error);
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
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("App is offline - will queue operations");
  }
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
