import { create } from "zustand";
import { persist } from "zustand/middleware";
import { logger } from "@/lib/logger";

/**
 * Maximum number of unique words tracked in session
 * Prevents unbounded memory growth in long sessions
 *
 * Rationale: 100 words is ~2 hours of practice at reasonable pace
 * Balances accuracy with memory constraints
 */
const MAX_WORDS_TRACKED = 100;

/**
 * When reaching max, remove this many oldest entries
 * Makes room for new words without frequent cleanup
 */
const WORDS_TO_REMOVE = 20;

export interface SessionData {
  startTime: number; // timestamp
  // CHANGED: Track word IDs with timestamps for LRU eviction
  wordsAttempted: Array<{
    wordId: string;
    timestamp: number;
  }>;
  correctOnFirstTry: number;
  totalAttempts: number;
  currentStreak: number;
  hasUpdatedStreak: boolean; // Prevents duplicate streak updates across game modes
}

interface SessionStore extends SessionData {
  startSession: () => void;
  endSession: () => SessionSummary;
  recordAttempt: (wordId: string, correctOnFirstTry: boolean) => void;
  getDurationSeconds: () => number;
  isSessionActive: () => boolean;
  setHasUpdatedStreak: (value: boolean) => void;
}

export interface SessionSummary {
  durationSeconds: number;
  wordsPracticed: number;
  correctOnFirstTry: number;
  totalAttempts: number;
  accuracy: number;
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      startTime: 0,
      wordsAttempted: [],
      correctOnFirstTry: 0,
      totalAttempts: 0,
      currentStreak: 0,
      hasUpdatedStreak: false,

      startSession: () => {
        set({
          startTime: Date.now(),
          wordsAttempted: [],
          correctOnFirstTry: 0,
          totalAttempts: 0,
          currentStreak: 0,
          hasUpdatedStreak: false,
        });
      },

      endSession: () => {
        const state = get();

        // Get unique word count from array
        const uniqueWords = new Set(state.wordsAttempted.map((w) => w.wordId))
          .size;

        const summary: SessionSummary = {
          durationSeconds: Math.floor((Date.now() - state.startTime) / 1000),
          wordsPracticed: uniqueWords,
          correctOnFirstTry: state.correctOnFirstTry,
          totalAttempts: state.totalAttempts,
          accuracy:
            state.totalAttempts > 0
              ? (state.correctOnFirstTry / state.totalAttempts) * 100
              : 0,
        };

        // Reset session
        set({
          startTime: 0,
          wordsAttempted: [],
          correctOnFirstTry: 0,
          totalAttempts: 0,
          currentStreak: 0,
          hasUpdatedStreak: false,
        });

        return summary;
      },

      recordAttempt: (wordId: string, correctOnFirstTry: boolean) => {
        set((state) => {
          // Check if word already tracked
          const existingIndex = state.wordsAttempted.findIndex(
            (w) => w.wordId === wordId
          );

          let newWordsAttempted = [...state.wordsAttempted];

          if (existingIndex === -1) {
            // New word - add with timestamp
            newWordsAttempted.push({
              wordId,
              timestamp: Date.now(),
            });

            // Enforce size limit using sliding window
            if (newWordsAttempted.length > MAX_WORDS_TRACKED) {
              // Sort by timestamp (oldest first)
              newWordsAttempted.sort((a, b) => a.timestamp - b.timestamp);

              // Remove oldest entries
              newWordsAttempted = newWordsAttempted.slice(WORDS_TO_REMOVE);

              logger.debug(
                `Session word limit reached (${MAX_WORDS_TRACKED}). ` +
                  `Removed ${WORDS_TO_REMOVE} oldest entries.`
              );
            }
          } else {
            // Word already tracked - update timestamp to mark as recent
            newWordsAttempted[existingIndex].timestamp = Date.now();
          }

          return {
            wordsAttempted: newWordsAttempted,
            correctOnFirstTry:
              state.correctOnFirstTry + (correctOnFirstTry ? 1 : 0),
            totalAttempts: state.totalAttempts + 1,
            currentStreak: correctOnFirstTry ? state.currentStreak + 1 : 0,
          };
        });
      },

      getDurationSeconds: () => {
        const state = get();
        if (state.startTime === 0) return 0;
        return Math.floor((Date.now() - state.startTime) / 1000);
      },

      isSessionActive: () => get().startTime > 0,

      setHasUpdatedStreak: (value: boolean) => set({ hasUpdatedStreak: value }),
    }),
    {
      name: "spelling-stars-session",
      storage: {
        getItem: (name) => {
          const str = sessionStorage.getItem(name);
          if (!str) return null;
          const { state } = JSON.parse(str);

          // Handle both old Set format and new Array format for backward compatibility
          if (state.wordsAttempted) {
            if (Array.isArray(state.wordsAttempted)) {
              // Check if it's the new format with timestamp objects
              if (
                state.wordsAttempted.length > 0 &&
                typeof state.wordsAttempted[0] === "object" &&
                "wordId" in state.wordsAttempted[0]
              ) {
                // New format - already correct
                return { state };
              } else {
                // Old array format (plain word IDs) - convert to new format
                state.wordsAttempted = state.wordsAttempted.map(
                  (wordId: string) => ({
                    wordId,
                    timestamp: Date.now(),
                  })
                );
              }
            } else {
              // Very old Set format - shouldn't happen but handle it
              logger.warn("Encountered legacy Set format in session storage");
              state.wordsAttempted = [];
            }
          }
          return { state };
        },
        setItem: (name, value) => {
          const { state } = value;
          // Array is already serializable
          sessionStorage.setItem(name, JSON.stringify({ state }));
        },
        removeItem: (name) => sessionStorage.removeItem(name),
      },
    }
  )
);
