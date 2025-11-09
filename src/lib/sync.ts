import { db } from "@/data/db";
import { supabase } from "@/app/supabase";

/**
 * Sync queued attempts and audio to Supabase
 * Called when app comes back online
 */
export async function syncQueuedData(): Promise<void> {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("Starting sync of queued data...");
  }

  try {
    // First, sync audio files
    await syncQueuedAudio();

    // Then sync attempts (which may reference uploaded audio)
    await syncQueuedAttempts();

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log("Sync completed successfully");
    }
  } catch (error) {
    console.error("Error during sync:", error);
    throw error;
  }
}

/**
 * Upload queued audio files to Supabase Storage
 */
async function syncQueuedAudio(): Promise<void> {
  const queuedAudio = await db.queuedAudio.where("synced").equals(0).toArray();

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(`Syncing ${queuedAudio.length} audio files...`);
  }

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
        console.error(`Failed to upload audio ${audio.filename}:`, error);
        continue;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("audio-recordings")
        .getPublicUrl(data.path);

      // Update record as synced
      if (audio.id !== undefined) {
        await db.queuedAudio.update(audio.id, {
          synced: true,
          storage_url: urlData.publicUrl,
        });
      }

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log(`Successfully uploaded: ${audio.filename}`);
      }
    } catch (error) {
      console.error(`Error uploading audio ${audio.filename}:`, error);
    }
  }
}

/**
 * Insert queued attempts into Supabase
 */
async function syncQueuedAttempts(): Promise<void> {
  const queuedAttempts = await db.queuedAttempts
    .where("synced")
    .equals(0)
    .toArray();

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(`Syncing ${queuedAttempts.length} attempts...`);
  }

  for (const attempt of queuedAttempts) {
    try {
      // Get audio URL if this attempt has audio
      let audioUrl: string | undefined;
      if (attempt.audio_blob_id) {
        const audioRecord = await db.queuedAudio.get(attempt.audio_blob_id);
        audioUrl = audioRecord?.storage_url;
      }

      // Insert into Supabase
      const { error } = await supabase.from("attempts").insert({
        child_id: attempt.child_id,
        word_id: attempt.word_id,
        mode: attempt.mode,
        correct: attempt.is_correct,
        typed_answer: attempt.typed_answer,
        audio_url: audioUrl,
        started_at: attempt.created_at,
      });

      if (error) {
        console.error("Failed to insert attempt:", error);
        continue;
      }

      // Mark as synced
      if (attempt.id !== undefined) {
        await db.queuedAttempts.update(attempt.id, {
          synced: true,
        });
      }

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log(`Successfully synced attempt ${attempt.id}`);
      }
    } catch (error) {
      console.error(`Error syncing attempt ${attempt.id}:`, error);
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
    .where("synced")
    .equals(0)
    .count();

  const pendingAudio = await db.queuedAudio.where("synced").equals(0).count();

  return pendingAttempts > 0 || pendingAudio > 0;
}
