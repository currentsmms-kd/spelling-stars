import { useEffect, useState } from "react";
import { CloudOff, WifiOff } from "lucide-react";
import { useOnline } from "@/app/hooks/useOnline";
import { cn } from "@/lib/utils";

interface NetworkStatusIndicatorProps {
  variant?: "parent" | "child";
}

export function NetworkStatusIndicator({
  variant = "parent",
}: NetworkStatusIndicatorProps) {
  const isOnline = useOnline();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Show indicator when offline, hide when online
  useEffect(() => {
    if (!isOnline && !isDismissed) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [isOnline, isDismissed]);

  // Reset dismiss state when coming back online
  useEffect(() => {
    if (isOnline) {
      setIsDismissed(false);
    }
  }, [isOnline]);

  // Don't render anything if online or dismissed
  if (!isVisible) {
    return null;
  }

  const isChild = variant === "child";

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "transform transition-all duration-300 ease-in-out",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "mx-auto max-w-screen-xl",
          "border-t-4 border-accent",
          "bg-accent/10 backdrop-blur-sm",
          "shadow-lg",
          isChild ? "p-6" : "p-4"
        )}
      >
        <div className="flex items-center justify-between gap-4">
          {/* Icon and Message */}
          <div className="flex items-center gap-3 flex-1">
            {/* Icon with pulse animation */}
            <div
              className={cn(
                "flex-shrink-0 rounded-full bg-accent/20 flex items-center justify-center",
                "animate-pulse",
                isChild ? "w-12 h-12" : "w-10 h-10"
              )}
            >
              {isChild ? (
                <WifiOff
                  className={cn("text-accent", isChild ? "w-6 h-6" : "w-5 h-5")}
                />
              ) : (
                <CloudOff
                  className={cn("text-accent", isChild ? "w-6 h-6" : "w-5 h-5")}
                />
              )}
            </div>

            {/* Message */}
            <div className="flex-1">
              {isChild ? (
                <p className="text-xl font-bold text-accent-foreground">
                  📡 Offline - Your work is being saved!
                </p>
              ) : (
                <div>
                  <p className="font-semibold text-accent-foreground text-base">
                    You're offline
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Changes will sync when you reconnect
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Dismiss Button (parent only) */}
          {!isChild && (
            <button
              onClick={() => setIsDismissed(true)}
              className={cn(
                "flex-shrink-0",
                "px-3 py-1.5",
                "text-sm font-medium",
                "text-accent-foreground hover:text-accent",
                "border-2 border-accent/20 hover:border-accent",
                "rounded-md",
                "transition-colors",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
              )}
              aria-label="Dismiss offline notification"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
