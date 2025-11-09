import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ParentalSettings {
  pinCode: string | null; // Hashed PIN
  showHintsOnFirstMiss: boolean;
  enforceCaseSensitivity: boolean;
  autoReadbackSpelling: boolean;
  dailySessionLimitMinutes: number;
  defaultTtsVoice: string;
  isPinLocked: boolean; // Local state for lock status
}

interface ParentalSettingsState extends ParentalSettings {
  setSettings: (settings: Partial<ParentalSettings>) => void;
  setPinCode: (pin: string | null) => void;
  lock: () => void;
  unlock: () => void;
  isUnlocked: () => boolean;
}

export const useParentalSettingsStore = create<ParentalSettingsState>()(
  persist(
    (set, get) => ({
      // Default settings
      pinCode: null,
      showHintsOnFirstMiss: true,
      enforceCaseSensitivity: false,
      autoReadbackSpelling: true,
      dailySessionLimitMinutes: 20,
      defaultTtsVoice: "en-US",
      isPinLocked: true, // Locked by default

      setSettings: (settings) => set((state) => ({ ...state, ...settings })),

      setPinCode: (pin) => set({ pinCode: pin }),

      lock: () => set({ isPinLocked: true }),

      unlock: () => set({ isPinLocked: false }),

      isUnlocked: () => !get().isPinLocked || !get().pinCode,
    }),
    {
      name: "parental-settings",
      // Don't persist the lock state - always start locked
      partialize: (state) => ({
        pinCode: state.pinCode,
        showHintsOnFirstMiss: state.showHintsOnFirstMiss,
        enforceCaseSensitivity: state.enforceCaseSensitivity,
        autoReadbackSpelling: state.autoReadbackSpelling,
        dailySessionLimitMinutes: state.dailySessionLimitMinutes,
        defaultTtsVoice: state.defaultTtsVoice,
      }),
    }
  )
);
