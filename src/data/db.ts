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

export interface QueuedSrsUpdate {
  id?: number;
  child_id: string;
  word_id: string;
  is_correct_first_try: boolean;
  created_at: string;
  synced: boolean;
  retry_count: number;
  last_error?: string;
  failed: boolean;
}

export interface QueuedStarTransaction {
  id?: number;
  user_id: string;
  amount: number;
  reason: string;
  created_at: string;
  synced: boolean;
  retry_count: number;
  last_error?: string;
  failed: boolean;
}

export class SpellStarsDB extends Dexie {
  queuedAttempts!: Table<QueuedAttempt>;
  queuedAudio!: Table<QueuedAudio>;
  queuedSrsUpdates!: Table<QueuedSrsUpdate>;
  queuedStarTransactions!: Table<QueuedStarTransaction>;

  constructor() {
    super("SpellStarsDB");

    // Version 5: Re-add list_id to queuedAttempts (matches schema)
    this.version(5)
      .stores({
        queuedAttempts:
          "++id, child_id, word_id, list_id, mode, synced, failed, started_at",
        queuedAudio: "++id, filename, synced, failed, created_at",
        queuedSrsUpdates: "++id, child_id, word_id, synced, failed, created_at",
        queuedStarTransactions: "++id, user_id, synced, failed, created_at",
      })
      .upgrade(async (_trans) => {
        // list_id will be added when new attempts are queued
        // Existing queued attempts without list_id will be synced as-is
        // (they're already in the queue from before list_id was required)
      });

    // Version 4: Remove list_id from queuedAttempts (not in schema)
    this.version(4)
      .stores({
        queuedAttempts:
          "++id, child_id, word_id, mode, synced, failed, started_at",
        queuedAudio: "++id, filename, synced, failed, created_at",
        queuedSrsUpdates: "++id, child_id, word_id, synced, failed, created_at",
        queuedStarTransactions: "++id, user_id, synced, failed, created_at",
      })
      .upgrade(async (trans) => {
        // Remove list_id from existing queued attempts
        await trans
          .table("queuedAttempts")
          .toCollection()
          .modify((attempt) => {
            delete (attempt as { list_id?: string }).list_id;
          });
      });

    // Version 3: Add SRS updates and star transactions tables
    this.version(3)
      .stores({
        queuedAttempts:
          "++id, child_id, word_id, list_id, mode, synced, failed, started_at",
        queuedAudio: "++id, filename, synced, failed, created_at",
        queuedSrsUpdates: "++id, child_id, word_id, synced, failed, created_at",
        queuedStarTransactions: "++id, user_id, synced, failed, created_at",
      })
      .upgrade(async (_trans) => {
        // Initialize new tables (they'll be empty for existing users)
      });

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
