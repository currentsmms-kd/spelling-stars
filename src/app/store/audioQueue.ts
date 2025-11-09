import { create } from "zustand";

export interface AudioQueueItem {
  id: string;
  word: string;
  audioUrl?: string;
}

interface AudioQueueState {
  queue: AudioQueueItem[];
  currentIndex: number;
  isPlaying: boolean;
  addToQueue: (items: AudioQueueItem[]) => void;
  setCurrentIndex: (index: number) => void;
  next: () => void;
  previous: () => void;
  setIsPlaying: (isPlaying: boolean) => void;
  clearQueue: () => void;
}

export const useAudioQueueStore = create<AudioQueueState>((set, get) => ({
  queue: [],
  currentIndex: 0,
  isPlaying: false,
  addToQueue: (items) => set({ queue: items, currentIndex: 0 }),
  setCurrentIndex: (index) => set({ currentIndex: index }),
  next: () => {
    const { queue, currentIndex } = get();
    if (currentIndex < queue.length - 1) {
      set({ currentIndex: currentIndex + 1 });
    }
  },
  previous: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 });
    }
  },
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  clearQueue: () => set({ queue: [], currentIndex: 0, isPlaying: false }),
}));
