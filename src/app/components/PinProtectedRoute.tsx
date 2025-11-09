import { useParentalSettingsStore } from "../store/parentalSettings";
import { PinLock } from "./PinLock";
import { useNavigate } from "react-router-dom";

interface PinProtectedRouteProps {
  children: React.ReactNode;
}

export function PinProtectedRoute({ children }: PinProtectedRouteProps) {
  const { isPinLocked, unlock, pinCode } = useParentalSettingsStore();
  const navigate = useNavigate();

  const handleUnlock = () => {
    unlock();
  };

  const handleCancel = () => {
    navigate("/child/home");
  };

  // Only show lock if there's a PIN set and it's locked
  if (isPinLocked && pinCode) {
    return <PinLock onUnlock={handleUnlock} onCancel={handleCancel} />;
  }

  return <>{children}</>;
}
