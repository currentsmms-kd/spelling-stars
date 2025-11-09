import { Home, List, Trophy, LogOut } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "src/lib/utils";

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
}

interface TopBarProps {
  title: string;
  isChild?: boolean;
  onLogout?: () => void;
}

export function TopBar({ title, isChild = false, onLogout }: TopBarProps) {
  return (
    <header
      className={cn(
        "bg-white border-b px-4 flex items-center justify-between",
        isChild ? "h-20" : "h-16"
      )}
    >
      <h1
        className={cn(
          "font-bold text-primary-700",
          isChild ? "text-3xl" : "text-xl"
        )}
      >
        ⭐ {title}
      </h1>
      {onLogout && (
        <button
          onClick={onLogout}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Logout"
        >
          <LogOut size={isChild ? 28 : 20} />
        </button>
      )}
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
        "bg-white border-r flex flex-col",
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
                  ? "bg-primary-100 text-primary-700"
                  : "hover:bg-gray-100 text-gray-600"
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

export const parentNavItems: NavItem[] = [
  {
    to: "/parent/dashboard",
    icon: <Home size={24} />,
    label: "Home",
  },
  {
    to: "/parent/lists",
    icon: <List size={24} />,
    label: "Lists",
  },
];

export const childNavItems: NavItem[] = [
  {
    to: "/child/home",
    icon: <Home size={32} />,
    label: "Home",
  },
  {
    to: "/child/rewards",
    icon: <Trophy size={32} />,
    label: "Rewards",
  },
];
