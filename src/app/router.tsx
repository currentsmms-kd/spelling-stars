import { createBrowserRouter, Navigate } from "react-router-dom";
import { Login } from "./pages/auth/Login";
import { Dashboard } from "./pages/parent/Dashboard";
import { Lists } from "./pages/parent/Lists";
import { ListEditor } from "./pages/parent/ListEditor";
import { ChildHome } from "./pages/child/Home";
import { PlayListenType } from "./pages/child/PlayListenType";
import { PlaySaySpell } from "./pages/child/PlaySaySpell";
import { Rewards } from "./pages/child/Rewards";
import { useAuth } from "./hooks/useAuth";
import { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: "parent" | "child";
}

function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
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

  if (requiredRole && profile?.role !== requiredRole) {
    // Redirect to appropriate area based on role
    if (profile?.role === "parent") {
      return <Navigate to="/parent/dashboard" replace />;
    } else {
      return <Navigate to="/child/home" replace />;
    }
  }

  return <>{children}</>;
}

function RootRedirect() {
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

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootRedirect />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/parent",
    children: [
      {
        path: "dashboard",
        element: (
          <ProtectedRoute requiredRole="parent">
            <Dashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "lists",
        element: (
          <ProtectedRoute requiredRole="parent">
            <Lists />
          </ProtectedRoute>
        ),
      },
      {
        path: "lists/new",
        element: (
          <ProtectedRoute requiredRole="parent">
            <ListEditor />
          </ProtectedRoute>
        ),
      },
      {
        path: "lists/:id",
        element: (
          <ProtectedRoute requiredRole="parent">
            <ListEditor />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: "/child",
    children: [
      {
        path: "home",
        element: (
          <ProtectedRoute requiredRole="child">
            <ChildHome />
          </ProtectedRoute>
        ),
      },
      {
        path: "play/listen-type",
        element: (
          <ProtectedRoute requiredRole="child">
            <PlayListenType />
          </ProtectedRoute>
        ),
      },
      {
        path: "play/say-spell",
        element: (
          <ProtectedRoute requiredRole="child">
            <PlaySaySpell />
          </ProtectedRoute>
        ),
      },
      {
        path: "rewards",
        element: (
          <ProtectedRoute requiredRole="child">
            <Rewards />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);
