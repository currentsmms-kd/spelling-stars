import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { router } from "./router";
import { queryClient } from "./queryClient";
import "../styles/index.css";

// Register service worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Listen for background sync
        if ("sync" in registration) {
          // Background sync is supported
        }
      })
      .catch(() => {
        // SW registration failed
      });
  });
}

// Handle background sync for queued attempts
if ("serviceWorker" in navigator && "SyncManager" in window) {
  navigator.serviceWorker.ready.then(() => {
    // The actual sync will be triggered when network is back
  });
}

// Listen for online/offline events
window.addEventListener("online", () => {
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    navigator.serviceWorker.ready.then((registration) => {
      // @ts-expect-error - sync API may not be available in all browsers
      return registration.sync.register("attempt-sync");
    });
  }
});

window.addEventListener("offline", () => {
  // Will queue operations
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
