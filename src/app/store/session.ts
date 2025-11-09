import { create } from "zustand";

export interface SessionData {
  startTime: number; // timestamp
  wordsAttempted: Set<string>; // word IDs
  correctOnFirstTry: number;
  totalAttempts: number;
  currentStreak: number;
}

interface SessionStore extends SessionData {
  startSession: () => void;
  endSession: () => SessionSummary;
  recordAttempt: (wordId: string, correctOnFirstTry: boolean) => void;
  getDurationSeconds: () => number;
  isSessionActive: () => boolean;
}

export interface SessionSummary {
  durationSeconds: number;
  wordsPracticed: number;
  correctOnFirstTry: number;
  totalAttempts: number;
  accuracy: number;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  startTime: 0,
  wordsAttempted: new Set(),
  correctOnFirstTry: 0,
  totalAttempts: 0,
  currentStreak: 0,

  startSession: () => {
    set({
      startTime: Date.now(),
      wordsAttempted: new Set(),
      correctOnFirstTry: 0,
      totalAttempts: 0,
      currentStreak: 0,
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
}));
