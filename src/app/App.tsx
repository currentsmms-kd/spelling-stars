import { useState, useEffect, useCallback } from "react";
import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { router } from "./router";
import { queryClient } from "./queryClient";
import { logger } from "@/lib/logger";
import { UpdateBanner } from "./components/UpdateBanner";
import { Toaster } from "react-hot-toast";
import { ErrorBoundary } from "./components/ErrorBoundary";
import type { ErrorInfo } from "react";

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

  const handleError = useCallback((error: Error, errorInfo: ErrorInfo) => {
    logger.metrics.errorCaptured({
      context: "App",
      message: error.message,
      stack: errorInfo.componentStack || error.stack,
      severity: "critical",
    });
  }, []);

  return (
    <>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary onError={handleError}>
          <RouterProvider router={router} />
        </ErrorBoundary>
      </QueryClientProvider>
      {showBanner && (
        <UpdateBanner onUpdate={handleUpdate} onDismiss={handleDismiss} />
      )}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "hsl(var(--card))",
            color: "hsl(var(--card-foreground))",
            border: "2px solid hsl(var(--border))",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-md)",
            fontFamily: "var(--font-sans)",
          },
          success: {
            iconTheme: {
              primary: "hsl(var(--secondary))",
              secondary: "hsl(var(--secondary-foreground))",
            },
          },
          error: {
            iconTheme: {
              primary: "hsl(var(--destructive))",
              secondary: "hsl(var(--destructive-foreground))",
            },
          },
        }}
      />
    </>
  );
}
