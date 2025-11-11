import { useState, useEffect, useCallback } from "react";
import { Button } from "./Button";
import { Card } from "./Card";
import { Lock, X, AlertTriangle } from "lucide-react";
import { useParentalSettingsStore } from "../store/parentalSettings";
import { verifyPin, isValidStoredPinFormat } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { useNavigate } from "react-router-dom";

interface PinLockProps {
  onUnlock: () => void;
  onCancel?: () => void;
}

function PinDisplay({ pin }: { pin: string }) {
  return (
    <div className="flex justify-center gap-3 mb-8">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`w-16 h-16 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-colors ${
            pin.length > i
              ? "bg-primary border-primary text-primary-foreground"
              : "bg-muted border-border"
          }`}
          aria-label={`PIN digit ${i + 1}${pin.length > i ? " entered" : " empty"}`}
        >
          {pin.length > i ? "●" : ""}
        </div>
      ))}
    </div>
  );
}

function NumberPad({
  onNumberClick,
  onClear,
  onBackspace,
}: {
  onNumberClick: (num: number) => void;
  onClear: () => void;
  onBackspace: () => void;
}) {
  const handleNumber1 = useCallback(() => onNumberClick(1), [onNumberClick]);
  const handleNumber2 = useCallback(() => onNumberClick(2), [onNumberClick]);
  const handleNumber3 = useCallback(() => onNumberClick(3), [onNumberClick]);
  const handleNumber4 = useCallback(() => onNumberClick(4), [onNumberClick]);
  const handleNumber5 = useCallback(() => onNumberClick(5), [onNumberClick]);
  const handleNumber6 = useCallback(() => onNumberClick(6), [onNumberClick]);
  const handleNumber7 = useCallback(() => onNumberClick(7), [onNumberClick]);
  const handleNumber8 = useCallback(() => onNumberClick(8), [onNumberClick]);
  const handleNumber9 = useCallback(() => onNumberClick(9), [onNumberClick]);
  const handleNumber0 = useCallback(() => onNumberClick(0), [onNumberClick]);

  const handlers = [
    handleNumber1, handleNumber2, handleNumber3,
    handleNumber4, handleNumber5, handleNumber6,
    handleNumber7, handleNumber8, handleNumber9
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num, index) => (
        <Button
          key={num}
          onClick={handlers[index]}
          variant="outline"
          className="h-16 text-2xl font-bold"
          aria-label={`Number ${num}`}
        >
          {num}
        </Button>
      ))}
      <Button
        onClick={onClear}
        variant="ghost"
        className="h-16 text-lg"
        aria-label="Clear PIN"
      >
        Clear
      </Button>
      <Button
        onClick={handleNumber0}
        variant="outline"
        className="h-16 text-2xl font-bold"
        aria-label="Number 0"
      >
        0
      </Button>
      <Button
        onClick={onBackspace}
        variant="ghost"
        className="h-16 text-lg"
        aria-label="Backspace"
      >
        ⌫
      </Button>
    </div>
  );
}

function PinLockContent({
  pin,
  error,
  isPinCorrupted,
  onCancel,
  onResetPin,
  onForgotPin,
  onNumberClick,
  onClear,
  onBackspace,
}: {
  pin: string;
  error: string;
  isPinCorrupted: boolean;
  onCancel?: () => void;
  onResetPin: () => void;
  onForgotPin: () => void;
  onNumberClick: (num: number) => void;
  onClear: () => void;
  onBackspace: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Lock className="text-primary" size={24} />
          <h2 className="text-2xl font-bold">
            {isPinCorrupted ? "PIN Reset Required" : "Enter PIN"}
          </h2>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-2 hover:bg-muted rounded-full transition-colors"
            aria-label="Cancel and go back"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div className="space-y-6">
        {isPinCorrupted ? (
          // Show corruption warning and reset option
          <div className="space-y-4">
            <div className="p-4 bg-destructive/10 border-2 border-destructive rounded-lg flex gap-3">
              <AlertTriangle
                className="text-destructive flex-shrink-0"
                size={24}
              />
              <div>
                <p className="font-medium text-destructive-foreground mb-1">
                  PIN Configuration Error
                </p>
                <p className="text-sm text-destructive-foreground/80">
                  Your PIN appears to be corrupted or in an invalid format. This
                  can happen after a browser update or if the PIN was manually
                  edited.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={onResetPin}
                variant="default"
                className="w-full"
                size="lg"
              >
                Reset PIN and Continue
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                You&apos;ll be taken to Settings where you can set a new PIN
              </p>
            </div>
          </div>
        ) : (
          // Normal PIN entry UI
          <>
            <PinDisplay pin={pin} />

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive rounded-lg text-destructive text-center">
                {error}
              </div>
            )}

            <NumberPad
              onNumberClick={onNumberClick}
              onClear={onClear}
              onBackspace={onBackspace}
            />

            {/* Forgot PIN Link */}
            <div className="text-center">
              <button
                onClick={onForgotPin}
                className="text-sm text-muted-foreground hover:text-primary underline transition-colors"
              >
                Forgot PIN?
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export function PinLock({ onUnlock, onCancel }: PinLockProps) {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [lockoutSecondsRemaining, setLockoutSecondsRemaining] = useState(0);
  const [isPinCorrupted, setIsPinCorrupted] = useState(false);
  const {
    pinCode,
    recordFailedAttempt,
    isLockedOut,
    getLockoutTimeRemaining,
    failedAttempts,
    setPinCode,
    unlock: storeUnlock,
  } = useParentalSettingsStore();

  useEffect(() => {
    // If no PIN is set, auto-unlock
    if (!pinCode) {
      onUnlock();
      return;
    }

    // Check if PIN format is valid (should be "salt:hash" format)
    if (!isValidStoredPinFormat(pinCode)) {
      logger.error("PIN is corrupted or invalid format", { pinCode });
      setIsPinCorrupted(true);
      setError(
        "PIN configuration error detected. Please reset your PIN to continue."
      );
    }
  }, [pinCode, onUnlock]);

  // Update lockout countdown every second
  useEffect(() => {
    if (!isLockedOut()) return undefined;

    const interval = setInterval(() => {
      const remaining = getLockoutTimeRemaining();
      setLockoutSecondsRemaining(remaining);

      if (remaining === 0) {
        setError("");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isLockedOut, getLockoutTimeRemaining, failedAttempts]);

  const handleResetPin = () => {
    // Clear the corrupted PIN and unlock
    setPinCode(null);
    storeUnlock();
    logger.info("User reset corrupted PIN");
    navigate("/parent/settings");
  };

  const handleForgotPin = () => {
    logger.info("User requested PIN reset via Forgot PIN");
    navigate("/parent/settings", {
      state: { resetPinRequested: true },
    });
  };

  const validatePin = async (pinToValidate: string) => {
    // Don't validate if PIN is corrupted
    if (isPinCorrupted) {
      return;
    }

    // Check lockout status
    if (isLockedOut()) {
      const remaining = getLockoutTimeRemaining();
      setLockoutSecondsRemaining(remaining);
      setError(
        `Too many failed attempts. Please wait ${remaining} second${remaining !== 1 ? "s" : ""}.`
      );
      setPin("");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      // Use constant-time verification with PBKDF2
      if (!pinCode) {
        setError("PIN not configured. Please set a PIN in Settings.");
        setPin("");
        return;
      }

      // Verify PIN format before attempting verification
      if (!isValidStoredPinFormat(pinCode)) {
        logger.error("PIN format invalid during verification");
        setIsPinCorrupted(true);
        setError(
          "PIN configuration error detected. Please reset your PIN to continue."
        );
        setPin("");
        return;
      }

      const isValid = await verifyPin(pinToValidate, pinCode);

      if (isValid) {
        onUnlock();
      } else {
        recordFailedAttempt();
        const attempts = useParentalSettingsStore.getState().failedAttempts;

        // Show progressively stronger warnings
        if (attempts >= 6) {
          setError(
            "Multiple failed attempts detected. You will be locked out for 5 minutes after the next failure."
          );
        } else if (attempts >= 3) {
          const nextLockout =
            attempts === 3
              ? "30 seconds"
              : attempts === 4
                ? "1 minute"
                : "2 minutes";
          setError(
            `Incorrect PIN. ${attempts} failed attempts. Next failure will lock you out for ${nextLockout}.`
          );
        } else {
          setError(
            `Incorrect PIN. ${attempts} failed attempt${attempts !== 1 ? "s" : ""}.`
          );
        }
        setPin("");
      }
    } catch (err) {
      logger.error("PIN verification error:", err);
      setError("An error occurred verifying your PIN. Please try again.");
      setPin("");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleNumberClick = useCallback(
    (num: number) => {
      if (isVerifying || isLockedOut()) return;

      if (pin.length < 4) {
        const newPin = pin + num;
        setPin(newPin);
        setError("");

        // Auto-submit when 4 digits entered
        if (newPin.length === 4) {
          setTimeout(() => validatePin(newPin), 100);
        }
      }
    },
    [pin, isVerifying, isLockedOut]
  );

  const handleBackspace = useCallback(() => {
    if (isVerifying || isLockedOut()) return;
    setPin(pin.slice(0, -1));
    setError("");
  }, [pin, isVerifying, isLockedOut]);

  const handleClear = useCallback(() => {
    if (isVerifying || isLockedOut()) return;
    setPin("");
    setError("");
  }, [isVerifying, isLockedOut]);

  if (!pinCode) {
    return null; // Don't show lock if no PIN set
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full">
        <PinLockContent
          pin={pin}
          error={
            lockoutSecondsRemaining > 0
              ? `Too many failed attempts. Please wait ${lockoutSecondsRemaining} second${lockoutSecondsRemaining !== 1 ? "s" : ""}.`
              : error
          }
          isPinCorrupted={isPinCorrupted}
          onCancel={onCancel}
          onResetPin={handleResetPin}
          onForgotPin={handleForgotPin}
          onNumberClick={handleNumberClick}
          onClear={handleClear}
          onBackspace={handleBackspace}
        />
        {isVerifying && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg">
            <div className="text-primary font-medium">Verifying...</div>
          </div>
        )}
      </Card>
    </div>
  );
}
