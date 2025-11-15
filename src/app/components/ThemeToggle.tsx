import { Moon, Sun } from "lucide-react";
import { Button } from "./Button";
import { useThemeStore } from "@/app/store/theme";

export function ThemeToggle() {
  const { currentTheme, setTheme } = useThemeStore();

  // Simple toggle between kawaii-pink and midnight-dark
  const isDark = currentTheme === "midnight-dark";

  const toggleTheme = () => {
    const newTheme = isDark ? "kawaii-pink" : "midnight-dark";
    setTheme(newTheme);
  };

  return (
    <Button
      onClick={toggleTheme}
      size="sm"
      className="gap-2"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark
        ? [<Sun key="icon" size={16} />, <span key="text">Light Mode</span>]
        : [<Moon key="icon" size={16} />, <span key="text">Dark Mode</span>]}
    </Button>
  );
}
