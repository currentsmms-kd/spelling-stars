import { ReactNode } from "react";
import { TopBar, NavRail } from "./Navigation";
import { BottomNav } from "./BottomNav";
import { parentNavItems, childNavItems } from "./navItems";
import { useAuth } from "../hooks/useAuth";
import { SyncStatusBadge } from "./SyncStatusBadge";
import { NetworkStatusIndicator } from "./NetworkStatusIndicator";
import { SkipLink } from "./SkipLink";
import { VisuallyHidden } from "./VisuallyHidden";

interface AppShellProps {
  children: ReactNode;
  title: string;
  variant?: "parent" | "child";
}

export function AppShell({
  children,
  title,
  variant = "parent",
}: AppShellProps) {
  const { signOut } = useAuth();
  const isChild = variant === "child";
  const navItems = isChild ? childNavItems : parentNavItems;

  return (
    <div className="h-screen flex flex-col">
      <SkipLink href="#main-content">Skip to main content</SkipLink>
      <header role="banner">
        <TopBar
          title={title}
          isChild={isChild}
          onLogout={signOut}
          syncBadge={<SyncStatusBadge variant={variant} />}
        />
      </header>
      <VisuallyHidden as="h1">{title}</VisuallyHidden>
      <div className="flex-1 flex overflow-hidden">
        <NavRail
          items={navItems}
          isChild={isChild}
          className="hidden md:flex"
        />
        <main
          id="main-content"
          role="main"
          tabIndex={-1}
          className="flex-1 overflow-auto p-2 sm:p-4 md:p-6 lg:p-8 bg-background focus:outline-none pb-20 md:pb-8"
        >
          {children}
        </main>
      </div>
      {isChild && <BottomNav items={navItems} />}
      <NetworkStatusIndicator variant={variant} />
    </div>
  );
}
