import { useState, useEffect } from "react";
import { Button } from "./Button";
import { Card } from "./Card";
import { Lock, X } from "lucide-react";
import { useParentalSettingsStore } from "../store/parentalSettings";

interface PinLockProps {
  onUnlock: () => void;
  onCancel?: () => void;
}

export function PinLock({ onUnlock, onCancel }: PinLockProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const { pinCode } = useParentalSettingsStore();

  useEffect(() => {
    // If no PIN is set, auto-unlock
    if (!pinCode) {
      onUnlock();
    }
  }, [pinCode, onUnlock]);

  const handleNumberClick = (num: number) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      setError("");

      // Auto-submit when 4 digits entered
      if (newPin.length === 4) {
        setTimeout(() => validatePin(newPin), 100);
      }
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError("");
  };

  const handleClear = () => {
    setPin("");
    setError("");
  };

  const validatePin = (pinToValidate: string) => {
    // Simple hash comparison (in production, use proper hashing like bcrypt)
    const hashedInput = btoa(pinToValidate); // Base64 encoding as simple "hash"

    if (hashedInput === pinCode) {
      onUnlock();
    } else {
      setError("Incorrect PIN. Try again.");
      setPin("");
    }
  };

  if (!pinCode) {
    return null; // Don't show lock if no PIN set
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Lock className="text-primary-600" size={24} />
            <h2 className="text-2xl font-bold">Enter PIN</h2>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Cancel and go back"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="space-y-6">
          {/* PIN Display */}
          <div className="flex justify-center gap-3 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-16 h-16 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-colors ${
                  pin.length > i
                    ? "bg-primary-600 border-primary-600 text-white"
                    : "bg-gray-100 border-gray-300"
                }`}
                aria-label={`PIN digit ${i + 1}${pin.length > i ? " entered" : " empty"}`}
              >
                {pin.length > i ? "●" : ""}
              </div>
            ))}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-center">
              {error}
            </div>
          )}

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <Button
                key={num}
                onClick={() => handleNumberClick(num)}
                variant="outline"
                className="h-16 text-2xl font-bold"
                aria-label={`Number ${num}`}
              >
                {num}
              </Button>
            ))}
            <Button
              onClick={handleClear}
              variant="ghost"
              className="h-16 text-lg"
              aria-label="Clear PIN"
            >
              Clear
            </Button>
            <Button
              onClick={() => handleNumberClick(0)}
              variant="outline"
              className="h-16 text-2xl font-bold"
              aria-label="Number 0"
            >
              0
            </Button>
            <Button
              onClick={handleBackspace}
              variant="ghost"
              className="h-16 text-lg"
              aria-label="Backspace"
            >
              ⌫
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
