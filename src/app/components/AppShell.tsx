import { ReactNode } from "react";
import { TopBar, NavRail } from "./Navigation";
import { parentNavItems, childNavItems } from "./navItems";
import { useAuth } from "../hooks/useAuth";

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
      <TopBar title={title} isChild={isChild} onLogout={signOut} />
      <div className="flex-1 flex overflow-hidden">
        <NavRail items={navItems} isChild={isChild} />
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
