import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { NavItem } from "./navItems";

interface BottomNavProps {
  items: NavItem[];
}

export function BottomNav({ items }: BottomNavProps) {
  const location = useLocation();

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-inset-bottom"
    >
      <div className="flex items-center justify-around h-16">
        {items.map((item) => {
          const isActive = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
            >
              <span
                className={cn(isActive && "scale-110 transition-transform")}
              >
                {item.icon}
              </span>
              <span className="text-xs font-medium truncate max-w-[60px]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
