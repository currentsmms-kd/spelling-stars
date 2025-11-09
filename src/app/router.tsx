import { createBrowserRouter } from "react-router-dom";
import { Login } from "./pages/auth/Login";
import { Signup } from "./pages/auth/Signup";
import { Dashboard } from "./pages/parent/Dashboard";
import { Lists } from "./pages/parent/Lists";
import { ListEditor } from "./pages/parent/ListEditor";
import { ChildHome } from "./pages/child/Home";
import { PlayListenType } from "./pages/child/PlayListenType";
import { PlaySaySpell } from "./pages/child/PlaySaySpell";
import { Rewards } from "./pages/child/Rewards";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RootRedirect } from "./components/RootRedirect";

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
    path: "/signup",
    element: <Signup />,
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
