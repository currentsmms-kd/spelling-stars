import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: "parent" | "child";
}

export function ProtectedRoute({
  children,
  requiredRole,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, profile } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && profile?.role !== requiredRole) {
    // Allow parents to access child views in development (for testing/preview)
    // NOTE: This is disabled in production for security - parents cannot access child routes
    if (
      import.meta.env.MODE !== "production" &&
      profile?.role === "parent" &&
      requiredRole === "child"
    ) {
      return <>{children}</>;
    }

    // Redirect to appropriate area based on role
    if (profile?.role === "parent") {
      return <Navigate to="/parent/dashboard" replace />;
    } else {
      return <Navigate to="/child/home" replace />;
    }
  }

  return <>{children}</>;
}
