import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SessionData {
  startTime: number; // timestamp
  wordsAttempted: Set<string>; // word IDs
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
      wordsAttempted: new Set(),
      correctOnFirstTry: 0,
      totalAttempts: 0,
      currentStreak: 0,
      hasUpdatedStreak: false,

      startSession: () => {
        set({
          startTime: Date.now(),
          wordsAttempted: new Set(),
          correctOnFirstTry: 0,
          totalAttempts: 0,
          currentStreak: 0,
          hasUpdatedStreak: false,
        });
      },

      endSession: () => {
        const state = get();
        const summary: SessionSummary = {
          durationSeconds: Math.floor((Date.now() - state.startTime) / 1000),
          wordsPracticed: state.wordsAttempted.size,
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
          wordsAttempted: new Set(),
          correctOnFirstTry: 0,
          totalAttempts: 0,
          currentStreak: 0,
          hasUpdatedStreak: false,
        });

        return summary;
      },

      recordAttempt: (wordId: string, correctOnFirstTry: boolean) => {
        set((state) => {
          const newWordsAttempted = new Set(state.wordsAttempted);
          newWordsAttempted.add(wordId);

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
          // Convert wordsAttempted array back to Set
          if (state.wordsAttempted) {
            state.wordsAttempted = new Set(state.wordsAttempted);
          }
          return { state };
        },
        setItem: (name, value) => {
          const { state } = value;
          // Convert Set to array for JSON serialization
          const serializedState = {
            ...state,
            wordsAttempted: Array.from(state.wordsAttempted),
          };
          sessionStorage.setItem(
            name,
            JSON.stringify({ state: serializedState })
          );
        },
        removeItem: (name) => sessionStorage.removeItem(name),
      },
    }
  )
);
