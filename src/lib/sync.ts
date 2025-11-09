import { db } from "@/data/db";
import { supabase } from "@/app/supabase";
import { logger } from "@/lib/logger";

/**
 * Sync queued attempts and audio to Supabase
 * Called when app comes back online
 */
export async function syncQueuedData(): Promise<void> {
  logger.log("Starting sync of queued data...");

  try {
    // First, sync audio files
    await syncQueuedAudio();

    // Then sync attempts (which may reference uploaded audio)
    await syncQueuedAttempts();

    logger.log("Sync completed successfully");
  } catch (error) {
    logger.error("Error during sync:", error);
    throw error;
  }
}

/**
 * Upload queued audio files to Supabase Storage
 */
async function syncQueuedAudio(): Promise<void> {
  const queuedAudio = await db.queuedAudio
    .filter((audio) => audio.synced === false)
    .toArray();

  logger.log(`Syncing ${queuedAudio.length} audio files...`);

  for (const audio of queuedAudio) {
    try {
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from("audio-recordings")
        .upload(audio.filename, audio.blob, {
          contentType: audio.blob.type,
          upsert: false,
        });

      if (error) {
        logger.error(`Failed to upload audio ${audio.filename}:`, error);
        continue;
      }

      // Store the path instead of generating a public URL
      // Signed URLs will be generated on-demand when playback is needed
      // Update record as synced with the storage path
      if (audio.id !== undefined) {
        await db.queuedAudio.update(audio.id, {
          synced: true,
          storage_url: data.path, // Store path, not URL
        });
      }

      logger.log(`Successfully uploaded: ${audio.filename}`);
    } catch (error) {
      logger.error(`Error uploading audio ${audio.filename}:`, error);
    }
  }
}

/**
 * Insert queued attempts into Supabase
 */
async function syncQueuedAttempts(): Promise<void> {
  const queuedAttempts = await db.queuedAttempts
    .filter((attempt) => attempt.synced === false)
    .toArray();

  logger.log(`Syncing ${queuedAttempts.length} attempts...`);

  for (const attempt of queuedAttempts) {
    try {
      // Get audio path if this attempt has audio
      // storage_url now contains the storage path, not a URL
      let audioPath: string | undefined;
      if (attempt.audio_blob_id) {
        const audioRecord = await db.queuedAudio.get(attempt.audio_blob_id);
        audioPath = audioRecord?.storage_url;
      }

      // Insert into Supabase
      const { error } = await supabase.from("attempts").insert({
        child_id: attempt.child_id,
        word_id: attempt.word_id,
        mode: attempt.mode,
        correct: attempt.is_correct,
        typed_answer: attempt.typed_answer,
        audio_url: audioPath, // Store path, not URL
        started_at: attempt.created_at,
      });

      if (error) {
        logger.error("Failed to insert attempt:", error);
        continue;
      }

      // Mark as synced
      if (attempt.id !== undefined) {
        await db.queuedAttempts.update(attempt.id, {
          synced: true,
        });
      }

      logger.log(`Successfully synced attempt ${attempt.id}`);
    } catch (error) {
      logger.error(`Error syncing attempt ${attempt.id}:`, error);
    }
  }
}

/**
 * Queue an attempt for later sync
 */
export async function queueAttempt(
  childId: string,
  wordId: string,
  listId: string,
  mode: string,
  isCorrect: boolean,
  typedAnswer?: string,
  audioBlobId?: number
): Promise<void> {
  await db.queuedAttempts.add({
    child_id: childId,
    word_id: wordId,
    list_id: listId,
    mode,
    is_correct: isCorrect,
    typed_answer: typedAnswer,
    audio_blob_id: audioBlobId,
    created_at: new Date().toISOString(),
    synced: false,
  });
}

/**
 * Queue audio for later upload
 */
export async function queueAudio(
  blob: Blob,
  filename: string
): Promise<number> {
  const id = await db.queuedAudio.add({
    blob,
    filename,
    created_at: new Date().toISOString(),
    synced: false,
  });

  return id as number;
}

/**
 * Check if there are pending items to sync
 */
export async function hasPendingSync(): Promise<boolean> {
  const pendingAttempts = await db.queuedAttempts
    .filter((attempt) => attempt.synced === false)
    .count();

  const pendingAudio = await db.queuedAudio
    .filter((audio) => audio.synced === false)
    .count();

  return pendingAttempts > 0 || pendingAudio > 0;
}

/**
 * One-time migration to normalize synced field from numeric to boolean
 * This should be called once on app initialization to fix any legacy data
 */
export async function migrateSyncedFieldToBoolean(): Promise<void> {
  logger.log("Starting migration of synced field to boolean...");

  try {
    // Migrate queuedAttempts
    const allAttempts = await db.queuedAttempts.toArray();
    let attemptsUpdated = 0;

    for (const attempt of allAttempts) {
      // Check if synced is stored as number (0 or 1) by casting to unknown
      const syncedValue = attempt.synced as unknown;
      if (typeof syncedValue === "number") {
        const boolValue = syncedValue !== 0;
        if (attempt.id !== undefined) {
          await db.queuedAttempts.update(attempt.id, { synced: boolValue });
          attemptsUpdated++;
        }
      }
    }

    // Migrate queuedAudio
    const allAudio = await db.queuedAudio.toArray();
    let audioUpdated = 0;

    for (const audio of allAudio) {
      // Check if synced is stored as number (0 or 1) by casting to unknown
      const syncedValue = audio.synced as unknown;
      if (typeof syncedValue === "number") {
        const boolValue = syncedValue !== 0;
        if (audio.id !== undefined) {
          await db.queuedAudio.update(audio.id, { synced: boolValue });
          audioUpdated++;
        }
      }
    }

    logger.log(
      `Migration complete: Updated ${attemptsUpdated} attempts and ${audioUpdated} audio records`
    );
  } catch (error) {
    logger.error("Error during synced field migration:", error);
    throw error;
  }
}
