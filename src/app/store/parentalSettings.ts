import { create } from "zustand";
import { persist } from "zustand/middleware";
import { hashPin } from "@/lib/crypto";

export interface ParentalSettings {
  pinCode: string | null; // PBKDF2 hash in format "salt:hash"
  showHintsOnFirstMiss: boolean;
  enforceCaseSensitivity: boolean;
  ignorePunctuation: boolean; // If true, strips ALL punctuation including hyphens/apostrophes for spelling comparison
  autoReadbackSpelling: boolean;
  dailySessionLimitMinutes: number;
  defaultTtsVoice: string;
  isPinLocked: boolean; // Local state for lock status
  failedAttempts: number; // Track failed PIN attempts
  lockoutUntil: number | null; // Timestamp when lockout expires
  strictSpacedMode: boolean; // Only show due words and leeches in practice
  /**
   * Delay in seconds before automatically advancing to the next word after a correct answer
   * Range: 2-8 seconds, default: 3 seconds
   */
  autoAdvanceDelaySeconds: number;
}

interface ParentalSettingsState extends ParentalSettings {
  setSettings: (settings: Partial<ParentalSettings>) => void;
  setPinCode: (pin: string | null) => Promise<void>;
  lock: () => void;
  unlock: () => void;
  isUnlocked: () => boolean;
  recordFailedAttempt: () => void;
  resetFailedAttempts: () => void;
  isLockedOut: () => boolean;
  getLockoutTimeRemaining: () => number;
}

export const useParentalSettingsStore = create<ParentalSettingsState>()(
  persist(
    (set, get) => ({
      // Default settings
      pinCode: null,
      showHintsOnFirstMiss: true,
      enforceCaseSensitivity: false,
      ignorePunctuation: false, // Default: preserve hyphens and apostrophes in spelling checks
      autoReadbackSpelling: true,
      dailySessionLimitMinutes: 20,
      defaultTtsVoice: "en-US",
      isPinLocked: true, // Locked by default
      failedAttempts: 0,
      lockoutUntil: null,
      strictSpacedMode: false, // Default to false for more forgiving practice
      /**
       * Delay in seconds before automatically advancing to the next word after a correct answer
       * Default: 3 seconds (standardized from previous hardcoded values of 2-5 seconds)
       */
      autoAdvanceDelaySeconds: 3,

      setSettings: (settings) => set((state) => ({ ...state, ...settings })),

      setPinCode: async (pin) => {
        if (pin === null) {
          set({ pinCode: null });
          return;
        }
        const hashed = await hashPin(pin);
        set({ pinCode: hashed });
      },

      lock: () => set({ isPinLocked: true }),

      unlock: () =>
        set({ isPinLocked: false, failedAttempts: 0, lockoutUntil: null }),

      isUnlocked: () => !get().isPinLocked || !get().pinCode,

      recordFailedAttempt: () => {
        const state = get();
        const attempts = state.failedAttempts + 1;

        // Exponential backoff: 3 attempts = 30s, 4 = 60s, 5 = 120s, 6+ = 300s
        let lockoutDuration = 0;
        if (attempts >= 3) {
          if (attempts === 3)
            lockoutDuration = 30 * 1000; // 30 seconds
          else if (attempts === 4)
            lockoutDuration = 60 * 1000; // 1 minute
          else if (attempts === 5)
            lockoutDuration = 120 * 1000; // 2 minutes
          else lockoutDuration = 300 * 1000; // 5 minutes for 6+ attempts
        }

        const lockoutUntil =
          lockoutDuration > 0 ? Date.now() + lockoutDuration : null;

        set({ failedAttempts: attempts, lockoutUntil });
      },

      resetFailedAttempts: () => set({ failedAttempts: 0, lockoutUntil: null }),

      isLockedOut: () => {
        const state = get();
        if (!state.lockoutUntil) return false;
        if (Date.now() >= state.lockoutUntil) {
          // Lockout expired, clear it
          set({ lockoutUntil: null });
          return false;
        }
        return true;
      },

      getLockoutTimeRemaining: () => {
        const state = get();
        if (!state.lockoutUntil) return 0;
        const remaining = Math.max(0, state.lockoutUntil - Date.now());
        return Math.ceil(remaining / 1000); // Convert to seconds
      },
    }),
    {
      name: "parental-settings",
      // Don't persist the lock state or failed attempts - always start fresh
      partialize: (state) => ({
        pinCode: state.pinCode,
        showHintsOnFirstMiss: state.showHintsOnFirstMiss,
        enforceCaseSensitivity: state.enforceCaseSensitivity,
        ignorePunctuation: state.ignorePunctuation,
        autoReadbackSpelling: state.autoReadbackSpelling,
        dailySessionLimitMinutes: state.dailySessionLimitMinutes,
        defaultTtsVoice: state.defaultTtsVoice,
        strictSpacedMode: state.strictSpacedMode,
        autoAdvanceDelaySeconds: state.autoAdvanceDelaySeconds,
      }),
    }
  )
);
