import { useState, useEffect } from "react";
import { Button } from "./Button";
import { X } from "lucide-react";
import { logger } from "@/lib/logger";

interface UpdateBannerProps {
  onUpdate: () => void;
  onDismiss: () => void;
}

/**
 * Banner that appears when a new version of the app is available.
 * Offers user control over when to apply the update.
 */
export function UpdateBanner({ onUpdate, onDismiss }: UpdateBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    logger.info("Update banner displayed");
  }, []);

  const handleUpdate = () => {
    logger.info("User initiated update from banner");
    setIsVisible(false);
    onUpdate();
  };

  const handleDismiss = () => {
    logger.info("User dismissed update banner");
    setIsVisible(false);
    onDismiss();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-4">
      <div className="bg-primary text-primary-foreground rounded-lg shadow-lg p-4 border-2 border-border">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">Update Available! 🎉</h3>
            <p className="text-sm opacity-90 mb-3">
              A new version of SpellStars is ready. Refresh to get the latest
              features and improvements.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleUpdate}
                className="text-sm"
              >
                Refresh Now
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDismiss}
                className="text-sm"
              >
                Later
              </Button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-primary-foreground/80 hover:text-primary-foreground transition-colors"
            aria-label="Dismiss update notification"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
