import { useState } from "react";
import { useParentalSettingsStore } from "../store/parentalSettings";
import { PinLock } from "./PinLock";
import { useNavigate } from "react-router-dom";

interface PinProtectedRouteProps {
  children: React.ReactNode;
}

export function PinProtectedRoute({ children }: PinProtectedRouteProps) {
  const { isPinLocked, unlock } = useParentalSettingsStore();
  const [showLock, setShowLock] = useState(isPinLocked);
  const navigate = useNavigate();

  const handleUnlock = () => {
    unlock();
    setShowLock(false);
  };

  const handleCancel = () => {
    navigate("/child/home");
  };

  if (showLock) {
    return <PinLock onUnlock={handleUnlock} onCancel={handleCancel} />;
  }

  return <>{children}</>;
}
