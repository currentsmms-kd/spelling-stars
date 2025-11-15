import { createBrowserRouter } from "react-router-dom";
import { Login } from "./pages/auth/Login";
import { Signup } from "./pages/auth/Signup";
import { Dashboard } from "./pages/parent/Dashboard";
import { Lists } from "./pages/parent/Lists";
import { ListEditor } from "./pages/parent/ListEditor";
import { ParentalSettings } from "./pages/parent/Settings";
import { RewardsManagement } from "./pages/parent/RewardsManagement";
import { ChildManagement } from "./pages/parent/ChildManagement";
import { ChildHome } from "./pages/child/Home";
import { PlayListenType } from "./pages/child/PlayListenType";
import { PlaySaySpell } from "./pages/child/PlaySaySpell";
import { Rewards } from "./pages/child/Rewards";
import { StickerBook } from "./pages/child/StickerBook";
import { ChildThemeSettings } from "./pages/child/ThemeSettings";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RootRedirect } from "./components/RootRedirect";
import { PinProtectedRoute } from "./components/PinProtectedRoute";
import { PlayWordSearch } from "./pages/child/PlayWordSearch";

export const router = createBrowserRouter(
  [
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
              <PinProtectedRoute>
                <Dashboard />
              </PinProtectedRoute>
            </ProtectedRoute>
          ),
        },
        {
          path: "lists",
          element: (
            <ProtectedRoute requiredRole="parent">
              <PinProtectedRoute>
                <Lists />
              </PinProtectedRoute>
            </ProtectedRoute>
          ),
        },
        {
          path: "lists/new",
          element: (
            <ProtectedRoute requiredRole="parent">
              <PinProtectedRoute>
                <ListEditor />
              </PinProtectedRoute>
            </ProtectedRoute>
          ),
        },
        {
          path: "lists/:id",
          element: (
            <ProtectedRoute requiredRole="parent">
              <PinProtectedRoute>
                <ListEditor />
              </PinProtectedRoute>
            </ProtectedRoute>
          ),
        },
        {
          path: "settings",
          element: (
            <ProtectedRoute requiredRole="parent">
              <PinProtectedRoute>
                <ParentalSettings />
              </PinProtectedRoute>
            </ProtectedRoute>
          ),
        },
        {
          path: "rewards-management",
          element: (
            <ProtectedRoute requiredRole="parent">
              <PinProtectedRoute>
                <RewardsManagement />
              </PinProtectedRoute>
            </ProtectedRoute>
          ),
        },
        {
          path: "children",
          element: (
            <ProtectedRoute requiredRole="parent">
              <PinProtectedRoute>
                <ChildManagement />
              </PinProtectedRoute>
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
          path: "play/word-search",
          element: (
            <ProtectedRoute requiredRole="child">
              <PlayWordSearch />
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
        {
          path: "stickers",
          element: (
            <ProtectedRoute requiredRole="child">
              <StickerBook />
            </ProtectedRoute>
          ),
        },
        {
          path: "theme",
          element: (
            <ProtectedRoute requiredRole="child">
              <ChildThemeSettings />
            </ProtectedRoute>
          ),
        },
      ],
    },
  ],
  {
    future: {
      v7_relativeSplatPath: true,
    },
  }
);
