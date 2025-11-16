import { create } from "zustand";
import { persist } from "zustand/middleware";
import { hashPin } from "@/lib/crypto";
import { logger } from "@/lib/logger";

export interface ParentalSettings {
  pinCode: string | null; // PBKDF2 hash in format "salt:hash"
  showHintsOnFirstMiss: boolean;
  enforceCaseSensitivity: boolean;
  ignorePunctuation: boolean; // If true, strips ALL punctuation including hyphens/apostrophes for spelling comparison
  autoReadbackSpelling: boolean;
  dailySessionLimitMinutes: number;
  defaultTtsVoice: string;
  isPinLocked: boolean; // Local state for lock status
  failedAttempts: number; // Track failed PIN attempts in current lockout period
  lockoutUntil: number | null; // Timestamp when lockout expires
  strictSpacedMode: boolean; // Only show due words and leeches in practice
  /**
   * Delay in seconds before automatically advancing to the next word after a correct answer
   * Range: 2-8 seconds, default: 3 seconds
   */
  autoAdvanceDelaySeconds: number;

  // NEW: Progressive brute force protection
  totalFailedAttempts: number; // Track total failed attempts across all lockout periods
  firstFailureTimestamp: number | null; // Track when protection was first triggered (for 24-hour window)
  isPermanentlyLocked: boolean; // Indicates account is in 24-hour permanent lock
  permanentLockResetTime: number | null; // Timestamp when permanent lock can be reset
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
      // Progressive brute force protection defaults
      totalFailedAttempts: 0,
      firstFailureTimestamp: null,
      isPermanentlyLocked: false,
      permanentLockResetTime: null,

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

      unlock: () => {
        const state = get();
        // On successful unlock, reduce total attempts by 50% (decay)
        // This allows recovery from occasional mistakes while preserving security
        const decayedTotal = Math.floor(state.totalFailedAttempts * 0.5);

        set({
          isPinLocked: false,
          failedAttempts: 0,
          lockoutUntil: null,
          totalFailedAttempts: decayedTotal,
          // Keep firstFailureTimestamp to maintain window context
        });

        if (state.totalFailedAttempts > 0) {
          logger.info(
            `PIN unlocked successfully. ` +
              `Total failed attempts decayed from ${state.totalFailedAttempts} to ${decayedTotal}`,
          );
        }
      },

      isUnlocked: () => !get().isPinLocked || !get().pinCode,

      recordFailedAttempt: () => {
        const state = get();
        const now = Date.now();

        // Increment both current and total counters
        const attempts = state.failedAttempts + 1;
        const totalAttempts = state.totalFailedAttempts + 1;

        // Track first failure for windowing
        const firstFailure = state.firstFailureTimestamp || now;

        // Progressive lockout durations (in milliseconds)
        let lockoutDuration = 0;

        if (totalAttempts >= 20) {
          // 20+ total failures = 24 hour permanent lock
          set({
            failedAttempts: attempts,
            totalFailedAttempts: totalAttempts,
            firstFailureTimestamp: firstFailure,
            isPermanentlyLocked: true,
            permanentLockResetTime: now + 24 * 60 * 60 * 1000, // 24 hours
            lockoutUntil: now + 24 * 60 * 60 * 1000,
          });

          logger.warn(
            `PIN permanently locked after ${totalAttempts} failed attempts. ` +
              `Unlock available after 24 hours.`,
          );
          return;
        }

        // Escalating lockouts based on total attempts
        if (totalAttempts >= 15) {
          lockoutDuration = 60 * 60 * 1000; // 1 hour
        } else if (totalAttempts >= 12) {
          lockoutDuration = 30 * 60 * 1000; // 30 minutes
        } else if (totalAttempts >= 9) {
          lockoutDuration = 15 * 60 * 1000; // 15 minutes
        } else if (totalAttempts >= 6) {
          lockoutDuration = 5 * 60 * 1000; // 5 minutes
        } else if (attempts >= 5) {
          lockoutDuration = 120 * 1000; // 2 minutes
        } else if (attempts >= 4) {
          lockoutDuration = 60 * 1000; // 1 minute
        } else if (attempts >= 3) {
          lockoutDuration = 30 * 1000; // 30 seconds
        }

        const lockoutUntil = lockoutDuration > 0 ? now + lockoutDuration : null;

        set({
          failedAttempts: attempts,
          totalFailedAttempts: totalAttempts,
          firstFailureTimestamp: firstFailure,
          lockoutUntil,
        });

        if (lockoutDuration > 0) {
          const minutes = Math.floor(lockoutDuration / 60000);
          const seconds = Math.floor((lockoutDuration % 60000) / 1000);
          logger.warn(
            `PIN locked for ${minutes}m ${seconds}s after ${totalAttempts} total failed attempts`,
          );
        }
      },

      resetFailedAttempts: () => set({ failedAttempts: 0, lockoutUntil: null }),

      isLockedOut: () => {
        const state = get();
        const now = Date.now();

        // Check for permanent lock
        if (state.isPermanentlyLocked) {
          if (
            state.permanentLockResetTime &&
            now >= state.permanentLockResetTime
          ) {
            // 24 hours passed, allow unlock but keep elevated protection
            set({
              isPermanentlyLocked: false,
              permanentLockResetTime: null,
              lockoutUntil: null,
              totalFailedAttempts: 10, // Start at elevated level
            });
            logger.info(
              "Permanent lock period expired. Unlock available with elevated protection.",
            );
            return false;
          }
          return true;
        }

        // Reset total attempts if 24 hours passed since first failure
        if (
          state.firstFailureTimestamp &&
          now - state.firstFailureTimestamp >= 24 * 60 * 60 * 1000
        ) {
          set({
            totalFailedAttempts: 0,
            firstFailureTimestamp: null,
          });
          logger.info("24-hour window expired. Failed attempt counter reset.");
        }

        // Check current lockout
        if (!state.lockoutUntil) return false;

        if (now >= state.lockoutUntil) {
          // Lockout expired, clear it but keep total attempts
          set({ lockoutUntil: null, failedAttempts: 0 });
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
      // Don't persist isPinLocked or current failedAttempts/lockoutUntil - always start fresh
      // DO persist progressive protection fields for security
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
        // Progressive brute force protection (MUST persist for security)
        totalFailedAttempts: state.totalFailedAttempts,
        firstFailureTimestamp: state.firstFailureTimestamp,
        isPermanentlyLocked: state.isPermanentlyLocked,
        permanentLockResetTime: state.permanentLockResetTime,
      }),
    },
  ),
);
