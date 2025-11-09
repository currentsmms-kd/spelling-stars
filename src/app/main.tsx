import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { router } from "./router";
import { queryClient } from "./queryClient";
import "src/styles/index.css";

// Register service worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("SW registered:", registration);

        // Listen for background sync
        if ("sync" in registration) {
          console.log("Background sync is supported");
        }
      })
      .catch((error) => {
        console.log("SW registration failed:", error);
      });
  });
}

// Handle background sync for queued attempts
if ("serviceWorker" in navigator && "SyncManager" in window) {
  navigator.serviceWorker.ready.then(() => {
    // The actual sync will be triggered when network is back
    console.log("Service worker ready for background sync");
  });
}

// Listen for online/offline events
window.addEventListener("online", () => {
  console.log("Back online - triggering sync");
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    navigator.serviceWorker.ready.then((registration) => {
      // @ts-expect-error - sync API may not be available in all browsers
      return registration.sync.register("attempt-sync");
    });
  }
});

window.addEventListener("offline", () => {
  console.log("Offline - will queue operations");
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
);
