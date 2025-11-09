import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function RootRedirect() {
  const { isAuthenticated, isLoading, profile } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect based on role
  if (profile?.role === "parent") {
    return <Navigate to="/parent/dashboard" replace />;
  } else {
    return <Navigate to="/child/home" replace />;
  }
}
