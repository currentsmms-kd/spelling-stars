import { LogOut } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { NavItem } from "./navItems";
import { ThemeToggle } from "./ThemeToggle";
import type { ReactNode } from "react";
import { useAuth } from "@/app/hooks/useAuth";

interface TopBarProps {
  title: string;
  isChild?: boolean;
  onLogout?: () => void;
  syncBadge?: ReactNode;
}

export function TopBar({
  title,
  isChild = false,
  onLogout,
  syncBadge,
}: TopBarProps) {
  const { profile } = useAuth();

  return (
    <header
      className={cn(
        "bg-card border-b border-border px-4 flex items-center justify-between",
        isChild ? "h-20" : "h-16"
      )}
    >
      <h1
        className={cn(
          "font-bold text-primary",
          isChild ? "text-3xl" : "text-xl"
        )}
      >
        ⭐ {title}
      </h1>
      <div className="flex items-center gap-3">
        {/* Show avatar and streak for child users */}
        {isChild && profile?.role === "child" && (
          <Link
            to="/child/rewards"
            className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors"
          >
            {/* Equipped Avatar */}
            {profile.equipped_avatar && (
              <div className="text-4xl">{profile.equipped_avatar}</div>
            )}

            {/* Streak Counter */}
            {(profile.streak_days || 0) > 0 && (
              <div className="flex items-center gap-1 bg-primary/20 px-3 py-1 rounded-full">
                <span className="text-2xl">🔥</span>
                <span className="text-xl font-bold text-primary">
                  {profile.streak_days}
                </span>
              </div>
            )}

            {/* Stars Count */}
            <div className="flex items-center gap-1 bg-secondary/20 px-3 py-1 rounded-full">
              <span className="text-2xl">⭐</span>
              <span className="text-xl font-bold text-secondary">
                {profile.stars || 0}
              </span>
            </div>
          </Link>
        )}

        {syncBadge}
        {!isChild && <ThemeToggle />}
        {onLogout && (
          <button
            onClick={onLogout}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Logout"
          >
            <LogOut size={isChild ? 28 : 20} />
          </button>
        )}
      </div>
    </header>
  );
}

interface NavRailProps {
  items: NavItem[];
  isChild?: boolean;
}

export function NavRail({ items, isChild = false }: NavRailProps) {
  const location = useLocation();

  return (
    <nav
      className={cn(
        "bg-card border-r border-border flex flex-col",
        isChild ? "w-24" : "w-20"
      )}
    >
      <div className="flex-1 flex flex-col gap-2 p-2 pt-4">
        {items.map((item) => {
          const isActive = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-lg transition-colors",
                isChild ? "p-4 h-20" : "p-3 h-16",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              {item.icon}
              <span className={cn("text-xs font-medium", isChild && "text-sm")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
