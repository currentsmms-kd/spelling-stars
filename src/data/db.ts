import Dexie, { Table } from "dexie";

export interface QueuedAttempt {
  id?: number;
  child_id: string;
  word_id: string;
  list_id: string;
  mode: string;
  is_correct: boolean;
  typed_answer?: string;
  audio_blob_id?: number;
  created_at: string;
  synced: boolean;
}

export interface QueuedAudio {
  id?: number;
  blob: Blob;
  filename: string;
  created_at: string;
  synced: boolean;
  storage_url?: string;
}

export class SpellStarsDB extends Dexie {
  queuedAttempts!: Table<QueuedAttempt>;
  queuedAudio!: Table<QueuedAudio>;

  constructor() {
    super("SpellStarsDB");
    this.version(1).stores({
      queuedAttempts:
        "++id, child_id, word_id, list_id, mode, synced, created_at",
      queuedAudio: "++id, filename, synced, created_at",
    });
  }
}

export const db = new SpellStarsDB();
