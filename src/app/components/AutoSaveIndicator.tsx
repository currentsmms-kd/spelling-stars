import { Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/app/components/Button";

export interface AutoSaveIndicatorProps {
  status: "idle" | "saving" | "saved" | "error";
  lastSavedAt?: Date;
  className?: string;
  onRetry?: () => void;
}

/**
 * Auto-save status indicator component
 * Shows saving status with icons and timestamps
 */
export function AutoSaveIndicator({
  status,
  lastSavedAt,
  className,
  onRetry,
}: AutoSaveIndicatorProps) {
  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) {
      return `${seconds} second${seconds !== 1 ? "s" : ""} ago`;
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
    }

    return date.toLocaleTimeString();
  };

  if (status === "idle") {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 text-sm transition-opacity duration-300",
        status === "saved" ? "text-secondary" : "text-muted-foreground",
        className
      )}
    >
      {status === "saving" && (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Saving...</span>
        </>
      )}

      {status === "saved" && (
        <>
          <Check className="h-4 w-4" aria-hidden="true" />
          <span>
            All changes saved
            {lastSavedAt && (
              <span className="ml-1 text-xs text-muted-foreground">
                ({formatTimeAgo(lastSavedAt)})
              </span>
            )}
          </span>
        </>
      )}

      {status === "error" && (
        <>
          <AlertCircle
            className="h-4 w-4 text-destructive"
            aria-hidden="true"
          />
          <span className="text-destructive">Failed to save</span>
          {onRetry && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRetry}
              className="ml-2 text-xs px-2 py-1 h-6"
              aria-label="Retry saving changes"
            >
              Retry
            </Button>
          )}
        </>
      )}
    </div>
  );
}
