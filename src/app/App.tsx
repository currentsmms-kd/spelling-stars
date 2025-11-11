import { useState, useEffect, useCallback } from "react";
import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { router } from "./router";
import { queryClient } from "./queryClient";
import { logger } from "@/lib/logger";
import { UpdateBanner } from "./components/UpdateBanner";

/**
 * Root App component that manages update banner state and provides
 * React Query and Router context to the entire application
 */
export function App() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Listen for service worker updates
    const handleUpdateAvailable = () => {
      setShowBanner(true);
    };

    window.addEventListener("sw-update-available", handleUpdateAvailable);

    return () => {
      window.removeEventListener("sw-update-available", handleUpdateAvailable);
    };
  }, []);

  const handleUpdate = useCallback(() => {
    logger.info("Applying update, reloading page");
    window.location.reload();
  }, []);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    logger.info("Update deferred by user");
  }, []);

  return (
    <>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
      {showBanner && (
        <UpdateBanner onUpdate={handleUpdate} onDismiss={handleDismiss} />
      )}
    </>
  );
}
