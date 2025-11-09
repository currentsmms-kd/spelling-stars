import { Palette, Sun, Moon } from "lucide-react";
import { useThemeStore } from "@/app/store/theme";
import { colorThemes } from "@/app/lib/themes";
import { Card } from "./Card";
import { useState } from "react";

interface ColorThemePickerProps {
  showLabel?: boolean;
  variant?: "parent" | "child";
}

interface ThemeGroup {
  baseId: string;
  baseName: string;
  description: string;
  lightTheme: (typeof colorThemes)[0];
  darkTheme?: (typeof colorThemes)[0];
}

export function ColorThemePicker({
  showLabel = true,
  variant = "parent",
}: ColorThemePickerProps) {
  const { currentTheme, setTheme } = useThemeStore();
  const [themeMode, setThemeMode] = useState<Record<string, "light" | "dark">>(
    {}
  );

  // Group themes by base name
  const themeGroups: ThemeGroup[] = [];
  const processedIds = new Set<string>();

  colorThemes.forEach((theme) => {
    if (processedIds.has(theme.id)) return;

    // Check if this is a dark variant
    if (theme.id.endsWith("-dark")) {
      processedIds.add(theme.id);
      return; // Will be picked up by the light variant
    }

    // Find matching dark variant
    const darkVariantId = `${theme.id}-dark`;
    const darkTheme = colorThemes.find((t) => t.id === darkVariantId);

    themeGroups.push({
      baseId: theme.id,
      baseName: theme.name,
      description: theme.description,
      lightTheme: theme,
      darkTheme,
    });

    processedIds.add(theme.id);
    if (darkTheme) processedIds.add(darkTheme.id);
  });

  const handleThemeChange = (group: ThemeGroup, mode: "light" | "dark") => {
    const themeToApply =
      mode === "dark" && group.darkTheme
        ? group.darkTheme.id
        : group.lightTheme.id;

    setTheme(themeToApply);
    setThemeMode((prev) => ({ ...prev, [group.baseId]: mode }));
  };

  const getActiveMode = (group: ThemeGroup): "light" | "dark" => {
    // Check if current theme matches this group
    const isLightActive = currentTheme === group.lightTheme.id;
    const isDarkActive = group.darkTheme && currentTheme === group.darkTheme.id;

    if (isDarkActive) return "dark";
    if (isLightActive) return "light";

    // Return stored preference or default to light
    return themeMode[group.baseId] || "light";
  };

  const isGroupActive = (group: ThemeGroup): boolean => {
    return (
      currentTheme === group.lightTheme.id ||
      (group.darkTheme !== undefined && currentTheme === group.darkTheme.id)
    );
  };

  const isChildMode = variant === "child";

  return (
    <div className="space-y-4">
      {showLabel && (
        <div className="flex items-center gap-3">
          <Palette className="text-primary" size={isChildMode ? 32 : 24} />
          <h2 className={`font-bold ${isChildMode ? "text-2xl" : "text-xl"}`}>
            Color Theme
          </h2>
        </div>
      )}

      <div
        className={`grid gap-4 ${isChildMode ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}
      >
        {themeGroups.map((group) => {
          const activeMode = getActiveMode(group);
          const activeTheme =
            activeMode === "dark" && group.darkTheme
              ? group.darkTheme
              : group.lightTheme;
          const isActive = isGroupActive(group);

          return (
            <div
              key={group.baseId}
              className={`group relative overflow-hidden rounded-xl transition-all duration-200 ${
                isActive
                  ? "ring-4 ring-primary shadow-xl scale-105"
                  : "hover:scale-102 hover:shadow-lg"
              }`}
            >
              <Card
                className={`h-full transition-all ${isChildMode ? "min-h-[200px]" : "min-h-[160px]"}`}
              >
                {/* Theme Preview Colors */}
                <div
                  className={`flex gap-2 mb-3 ${isChildMode ? "h-16" : "h-12"}`}
                >
                  <div
                    className="flex-1 rounded-lg"
                    style={{
                      backgroundColor: activeTheme.cssVariables["--primary"],
                    }}
                    aria-hidden="true"
                  />
                  <div
                    className="flex-1 rounded-lg"
                    style={{
                      backgroundColor: activeTheme.cssVariables["--secondary"],
                    }}
                    aria-hidden="true"
                  />
                  <div
                    className="flex-1 rounded-lg"
                    style={{
                      backgroundColor: activeTheme.cssVariables["--accent"],
                    }}
                    aria-hidden="true"
                  />
                </div>

                {/* Theme Info */}
                <div className="text-left mb-3">
                  <h3
                    className={`font-bold mb-1 ${isChildMode ? "text-xl" : "text-lg"}`}
                  >
                    {group.baseName}
                  </h3>
                  <p
                    className={`text-muted-foreground ${isChildMode ? "text-base" : "text-sm"}`}
                  >
                    {group.description}
                  </p>
                </div>

                {/* Light/Dark Toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleThemeChange(group, "light")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-all ${
                      activeMode === "light" && isActive
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                    aria-label={`Select ${group.baseName} light mode`}
                    aria-pressed={activeMode === "light" && isActive}
                  >
                    <Sun size={isChildMode ? 20 : 16} />
                    <span className={isChildMode ? "text-base" : "text-sm"}>
                      Light
                    </span>
                  </button>

                  {group.darkTheme && (
                    <button
                      onClick={() => handleThemeChange(group, "dark")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-all ${
                        activeMode === "dark" && isActive
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-muted hover:bg-muted/80"
                      }`}
                      aria-label={`Select ${group.baseName} dark mode`}
                      aria-pressed={activeMode === "dark" && isActive}
                    >
                      <Moon size={isChildMode ? 20 : 16} />
                      <span className={isChildMode ? "text-base" : "text-sm"}>
                        Dark
                      </span>
                    </button>
                  )}
                </div>

                {/* Selected Badge */}
                {isActive && (
                  <div
                    className={`absolute top-3 right-3 bg-primary text-primary-foreground rounded-full px-3 py-1 font-bold shadow-lg ${isChildMode ? "text-sm" : "text-xs"}`}
                  >
                    ✓ Selected
                  </div>
                )}
              </Card>
            </div>
          );
        })}
      </div>

      {isChildMode && (
        <p className="text-center text-muted-foreground text-lg">
          Pick your favorite colors!
        </p>
      )}
    </div>
  );
}
