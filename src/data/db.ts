import Dexie, { Table } from "dexie";

export interface QueuedAttempt {
  id?: number;
  child_id: string;
  word_id: string;
  list_id: string;
  mode: string;
  correct: boolean;
  typed_answer?: string;
  audio_blob_id?: number;
  started_at: string;
  synced: boolean;
  retry_count: number;
  last_error?: string;
  failed: boolean;
}

export interface QueuedAudio {
  id?: number;
  blob: Blob;
  filename: string;
  created_at: string;
  synced: boolean;
  storage_url?: string;
  retry_count: number;
  last_error?: string;
  failed: boolean;
}

export class SpellStarsDB extends Dexie {
  queuedAttempts!: Table<QueuedAttempt>;
  queuedAudio!: Table<QueuedAudio>;

  constructor() {
    super("SpellStarsDB");

    // Version 2: Add retry_count, last_error, and failed fields
    this.version(2)
      .stores({
        queuedAttempts:
          "++id, child_id, word_id, list_id, mode, synced, failed, started_at",
        queuedAudio: "++id, filename, synced, failed, created_at",
      })
      .upgrade(async (trans) => {
        // Migrate existing records to add new fields
        await trans
          .table("queuedAttempts")
          .toCollection()
          .modify((attempt) => {
            if (attempt.retry_count === undefined) attempt.retry_count = 0;
            if (attempt.failed === undefined) attempt.failed = false;
          });

        await trans
          .table("queuedAudio")
          .toCollection()
          .modify((audio) => {
            if (audio.retry_count === undefined) audio.retry_count = 0;
            if (audio.failed === undefined) audio.failed = false;
          });
      });

    // Keep version 1 for backward compatibility
    this.version(1).stores({
      queuedAttempts:
        "++id, child_id, word_id, list_id, mode, synced, started_at",
      queuedAudio: "++id, filename, synced, created_at",
    });
  }
}

export const db = new SpellStarsDB();
