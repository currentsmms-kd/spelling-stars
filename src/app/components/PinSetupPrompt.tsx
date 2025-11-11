import { Card } from "./Card";
import { Button } from "./Button";
import { Lock, AlertTriangle, Settings, ArrowLeft } from "lucide-react";

interface PinSetupPromptProps {
  onSetupNow: () => void;
  onSetupLater: () => void;
  onCancel: () => void;
}

export function PinSetupPrompt({
  onSetupNow,
  onSetupLater,
  onCancel,
}: PinSetupPromptProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-lg w-full">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Lock className="text-primary" size={32} />
            <h2 className="text-2xl font-bold">Secure Your Parent Area</h2>
          </div>

          {/* Warning Message */}
          <div className="p-4 bg-yellow-500/10 border-2 border-yellow-500 rounded-lg flex gap-3">
            <AlertTriangle
              className="text-yellow-600 flex-shrink-0"
              size={24}
            />
            <div>
              <p className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                No PIN Configured
              </p>
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Your parent area is currently unprotected. Children can access
                settings, word lists, and view analytics without restriction.
              </p>
            </div>
          </div>

          {/* Benefits */}
          <div className="space-y-3">
            <p className="font-medium">Setting a PIN will:</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">✓</span>
                <span>Prevent children from accessing parent settings</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">✓</span>
                <span>Protect your word lists and analytics from changes</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">✓</span>
                <span>Ensure only you can modify parental controls</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">✓</span>
                <span>Keep your child's learning environment consistent</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={onSetupNow}
              className="w-full flex items-center justify-center gap-2"
              size="lg"
            >
              <Settings size={20} aria-hidden="true" />
              Set Up PIN Now (Recommended)
            </Button>

            <Button
              onClick={onSetupLater}
              variant="outline"
              className="w-full"
              size="lg"
            >
              Remind Me Later
            </Button>

            <Button
              onClick={onCancel}
              variant="ghost"
              className="w-full flex items-center justify-center gap-2"
              size="sm"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Back to Child Area
            </Button>
          </div>

          {/* Footer Note */}
          <p className="text-xs text-muted-foreground text-center">
            You can always set up a PIN later in Parental Settings
          </p>
        </div>
      </Card>
    </div>
  );
}
