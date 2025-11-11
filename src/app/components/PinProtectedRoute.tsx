import { useState, useEffect } from "react";
import { useParentalSettingsStore } from "../store/parentalSettings";
import { PinLock } from "./PinLock";
import { PinSetupPrompt } from "./PinSetupPrompt.tsx";
import { useNavigate, useLocation } from "react-router-dom";
import { logger } from "@/lib/logger";

interface PinProtectedRouteProps {
  children: React.ReactNode;
}

export function PinProtectedRoute({ children }: PinProtectedRouteProps) {
  const { isPinLocked, unlock, pinCode } = useParentalSettingsStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [showSetupPrompt, setShowSetupPrompt] = useState(false);

  // Check if we should prompt for PIN setup on first visit
  useEffect(() => {
    // Don't show setup prompt on settings page (user might be there to set PIN)
    if (location.pathname === "/parent/settings") {
      return;
    }

    // Show setup prompt if no PIN is configured
    if (!pinCode) {
      setShowSetupPrompt(true);
    }
  }, [pinCode, location.pathname]);

  function handleUnlock() {
    unlock();
  }

  function handleCancel() {
    navigate("/child/home");
  }

  function handleSetupPinLater() {
    setShowSetupPrompt(false);
    logger.info("User chose to skip PIN setup for now");
  }

  function handleSetupPinNow() {
    navigate("/parent/settings");
  }

  // Show first-time PIN setup prompt if no PIN configured
  if (showSetupPrompt && !pinCode) {
    return (
      <PinSetupPrompt
        onSetupNow={handleSetupPinNow}
        onSetupLater={handleSetupPinLater}
        onCancel={handleCancel}
      />
    );
  }

  // Show PIN lock if there's a PIN set and it's locked
  if (isPinLocked && pinCode) {
    return <PinLock onUnlock={handleUnlock} onCancel={handleCancel} />;
  }

  return children as React.ReactElement;
}
