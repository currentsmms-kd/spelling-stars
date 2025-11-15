import { useState } from "react";
import { Button } from "./Button";
import { logger } from "@/lib/logger";

interface PinSetupStepProps {
  onComplete: (pin: string) => void;
  onSkip: () => void;
}

/**
 * PIN setup component for use during parent account creation
 * Allows setting a 4-digit PIN with confirmation
 */
export function PinSetupStep({ onComplete, onSkip }: PinSetupStepProps) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handlePinChange = (value: string) => {
    // Only allow digits, max 4
    const sanitized = value.replace(/\D/g, "").slice(0, 4);
    setPin(sanitized);
    setError(null);
  };

  const handleConfirmPinChange = (value: string) => {
    // Only allow digits, max 4
    const sanitized = value.replace(/\D/g, "").slice(0, 4);
    setConfirmPin(sanitized);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (pin.length !== 4) {
      setError("PIN must be 4 digits");
      return;
    }

    if (pin !== confirmPin) {
      setError("PINs do not match");
      return;
    }

    logger.info("PIN setup completed during signup");
    onComplete(pin);
  };

  const handleSkip = () => {
    logger.info("User skipped PIN setup during signup");
    onSkip();
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Set Up Parental PIN
        </h2>
        <p className="text-muted-foreground">
          Protect your parent dashboard with a 4-digit PIN. This prevents
          children from accessing or modifying settings.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="pin"
            className="block text-sm font-medium text-foreground mb-1"
          >
            Enter PIN
          </label>
          <input
            type="password"
            id="pin"
            value={pin}
            onChange={(e) => handlePinChange(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input text-center text-2xl tracking-widest"
            placeholder="••••"
            maxLength={4}
            inputMode="numeric"
            pattern="[0-9]*"
          />
        </div>

        <div>
          <label
            htmlFor="confirmPin"
            className="block text-sm font-medium text-foreground mb-1"
          >
            Confirm PIN
          </label>
          <input
            type="password"
            id="confirmPin"
            value={confirmPin}
            onChange={(e) => handleConfirmPinChange(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input text-center text-2xl tracking-widest"
            placeholder="••••"
            maxLength={4}
            inputMode="numeric"
            pattern="[0-9]*"
          />
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleSkip}
            className="flex-1"
          >
            Skip for Now
          </Button>
          <Button
            type="submit"
            disabled={pin.length !== 4 || confirmPin.length !== 4}
            className="flex-1"
          >
            Set PIN
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          You can set or change your PIN later in Settings
        </p>
      </form>
    </div>
  );
}
