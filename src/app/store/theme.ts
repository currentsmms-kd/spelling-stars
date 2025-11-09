import { create } from "zustand";
import { persist } from "zustand/middleware";
import { applyTheme } from "@/app/lib/themes";

interface ThemeState {
  currentTheme: string;
  setTheme: (themeId: string) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      currentTheme: "kawaii-pink", // Default theme

      setTheme: (themeId: string) => {
        applyTheme(themeId);
        set({ currentTheme: themeId });
      },
    }),
    {
      name: "color-theme-storage",
      onRehydrateStorage: () => {
        // Apply the theme after rehydration
        return (state) => {
          if (state?.currentTheme) {
            applyTheme(state.currentTheme);
          }
        };
      },
    }
  )
);
