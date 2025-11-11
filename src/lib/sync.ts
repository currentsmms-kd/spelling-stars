import { db } from "@/data/db";
import type { QueuedAttempt } from "@/data/db";
import { supabase } from "@/app/supabase";
import { logger } from "@/lib/logger";

/**
 * Maximum number of retry attempts before marking as permanently failed
 */
const MAX_RETRY_ATTEMPTS = 5;

/**
 * Base delay for exponential backoff (in milliseconds)
 */
const BASE_DELAY_MS = 1000;

/**
 * Calculate exponential backoff delay with jitter
 * @param retryCount Current retry attempt (0-based)
 * @returns Delay in milliseconds
 */
function calculateBackoffDelay(retryCount: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s
  const exponentialDelay = BASE_DELAY_MS * Math.pow(2, retryCount);

  // Add jitter (±25% randomness) to prevent thundering herd
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);

  return Math.floor(exponentialDelay + jitter);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sync queued attempts and audio to Supabase
 * Called when app comes back online
 */
export async function syncQueuedData(): Promise<void> {
  const syncStartTime = Date.now();
  logger.log("Starting sync of queued data...");
  logger.metrics.syncStarted();

  try {
    // First, sync audio files
    await syncQueuedAudio();

    // Then sync attempts (which may reference uploaded audio)
    await syncQueuedAttempts();

    // Sync SRS updates
    await syncQueuedSrsUpdates();

    // Sync star transactions
    await syncQueuedStarTransactions();

    const syncDuration = Date.now() - syncStartTime;
    logger.log(`Sync completed successfully in ${syncDuration}ms`);
    logger.metrics.syncCompleted(syncDuration);
  } catch (error) {
    const syncDuration = Date.now() - syncStartTime;
    logger.error("Error during sync:", error);
    logger.metrics.syncCompleted(syncDuration);
    throw error;
  }
}

/**
 * Upload queued audio files to Supabase Storage
 */
async function syncQueuedAudio(): Promise<void> {
  const queuedAudio = await db.queuedAudio
    .filter((audio) => audio.synced === false && audio.failed === false)
    .toArray();

  logger.log(`Syncing ${queuedAudio.length} audio files...`);

  for (const audio of queuedAudio) {
    try {
      // Check if audio already exists (idempotency)
      const { data: existingFiles } = await supabase.storage
        .from("audio-recordings")
        .list("", {
          search: audio.filename,
        });

      if (existingFiles?.some((f) => f.name === audio.filename)) {
        logger.log(`Audio ${audio.filename} already exists, skipping upload`);

        // Mark as synced with existing path
        if (audio.id !== undefined) {
          await db.queuedAudio.update(audio.id, {
            synced: true,
            storage_url: audio.filename,
          });
        }
        continue;
      }

      // Attempt upload with retry logic
      let uploadSuccess = false;
      let uploadError: Error | null = null;

      for (
        let attempt = 0;
        attempt <= audio.retry_count && attempt < MAX_RETRY_ATTEMPTS;
        attempt++
      ) {
        try {
          if (attempt > 0) {
            const delay = calculateBackoffDelay(attempt - 1);
            logger.log(
              `Audio ${audio.filename}: Retry ${attempt}/${MAX_RETRY_ATTEMPTS} after ${delay}ms`
            );
            await sleep(delay);
          }

          // Upload to Supabase Storage
          const { data, error } = await supabase.storage
            .from("audio-recordings")
            .upload(audio.filename, audio.blob, {
              contentType: audio.blob.type,
              upsert: false,
            });

          if (error) {
            uploadError = error;
            throw error;
          }

          // Store the path instead of generating a public URL
          // Signed URLs will be generated on-demand when playback is needed
          // Update record as synced with the storage path
          if (audio.id !== undefined) {
            await db.queuedAudio.update(audio.id, {
              synced: true,
              storage_url: data.path, // Store path, not URL
              retry_count: attempt,
              last_error: undefined,
            });
          }

          logger.log(`Successfully uploaded: ${audio.filename}`);
          logger.metrics.audioUploaded();
          uploadSuccess = true;
          break;
        } catch (error) {
          uploadError =
            error instanceof Error ? error : new Error(String(error));

          // Update retry count
          if (audio.id !== undefined) {
            await db.queuedAudio.update(audio.id, {
              retry_count: attempt + 1,
              last_error:
                error instanceof Error ? error.message : String(error),
            });
          }

          // If max retries reached, mark as failed
          if (attempt >= MAX_RETRY_ATTEMPTS - 1) {
            if (audio.id !== undefined) {
              await db.queuedAudio.update(audio.id, {
                failed: true,
              });
            }
            logger.error(
              `Audio ${audio.filename}: Permanently failed after ${MAX_RETRY_ATTEMPTS} attempts`,
              error
            );
            logger.metrics.audioFailed();
            break;
          }
        }
      }

      if (!uploadSuccess && uploadError) {
        logger.error(`Failed to upload audio ${audio.filename}:`, uploadError);
        logger.metrics.audioFailed();
      }
    } catch (error) {
      logger.error(`Error processing audio ${audio.filename}:`, error);
      logger.metrics.audioFailed();

      // Mark as failed if we can't even attempt the upload
      if (audio.id !== undefined) {
        await db.queuedAudio.update(audio.id, {
          failed: true,
          last_error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

/**
 * Helper: Get audio path for an attempt
 */
async function getAudioPathForAttempt(
  attempt: QueuedAttempt
): Promise<string | undefined | null> {
  if (!attempt.audio_blob_id) {
    return undefined;
  }

  const audioRecord = await db.queuedAudio.get(attempt.audio_blob_id);

  // Audio record not found - should not happen but handle gracefully
  if (!audioRecord) {
    logger.error(
      `Attempt ${attempt.id}: Audio record ${attempt.audio_blob_id} not found`
    );
    return null; // Signal to skip this attempt
  }

  // Skip if audio is not yet synced
  if (!audioRecord.synced) {
    logger.log(
      `Attempt ${attempt.id}: Deferring - audio ${attempt.audio_blob_id} not yet synced`
    );
    return null; // Signal to skip this attempt for now
  }

  // Skip if audio failed
  if (audioRecord.failed) {
    logger.error(
      `Attempt ${attempt.id}: Blocking - audio ${attempt.audio_blob_id} permanently failed`
    );

    // Mark attempt as failed too since its audio failed
    if (attempt.id !== undefined) {
      await db.queuedAttempts.update(attempt.id, {
        failed: true,
        last_error: "Associated audio upload failed",
      });
    }
    return null; // Signal to skip this attempt
  }

  // Verify storage_url exists even if synced is true
  // This handles edge cases where synced was set but storage_url is missing
  if (!audioRecord.storage_url) {
    logger.warn(
      `Attempt ${attempt.id}: Deferring - audio ${attempt.audio_blob_id} marked as synced but storage_url is missing`
    );

    // Reset synced flag to force re-upload on next sync cycle
    await db.queuedAudio.update(attempt.audio_blob_id, {
      synced: false,
      last_error: "storage_url missing after sync, requires re-upload",
    });

    return null; // Signal to skip this attempt and retry after audio re-sync
  }

  return audioRecord.storage_url;
}

/**
 * Helper: Check if attempt already exists in Supabase
 */
async function attemptExists(attempt: QueuedAttempt): Promise<boolean> {
  const { data: existingAttempts, error: checkError } = await supabase
    .from("attempts")
    .select("id")
    .eq("child_id", attempt.child_id)
    .eq("word_id", attempt.word_id)
    .eq("started_at", attempt.started_at)
    .limit(1);

  if (checkError) {
    logger.error("Error checking for duplicate attempts:", checkError);
    return false; // Continue with insert attempt if check fails
  }

  if (existingAttempts?.length > 0) {
    logger.log(`Attempt ${attempt.id}: Already exists, marking as synced`);

    if (attempt.id !== undefined) {
      await db.queuedAttempts.update(attempt.id, {
        synced: true,
      });
    }
    return true;
  }

  return false;
}

/**
 * Helper: Insert a single attempt with retry logic
 */
async function insertAttemptWithRetry(
  attempt: QueuedAttempt,
  audioPath: string | undefined
): Promise<boolean> {
  let insertSuccess = false;
  let insertError: Error | null = null;

  for (
    let retry = 0;
    retry <= attempt.retry_count && retry < MAX_RETRY_ATTEMPTS;
    retry++
  ) {
    try {
      if (retry > 0) {
        const delay = calculateBackoffDelay(retry - 1);
        logger.log(
          `Attempt ${attempt.id}: Retry ${retry}/${MAX_RETRY_ATTEMPTS} after ${delay}ms`
        );
        await sleep(delay);
      }

      // Insert into Supabase
      const { error } = await supabase.from("attempts").insert({
        child_id: attempt.child_id,
        word_id: attempt.word_id,
        mode: attempt.mode,
        correct: attempt.correct,
        typed_answer: attempt.typed_answer,
        audio_url: audioPath, // Store path, not URL
        started_at: attempt.started_at,
      });

      if (error) {
        insertError = error instanceof Error ? error : new Error(String(error));
        throw insertError;
      }

      // Mark as synced
      if (attempt.id !== undefined) {
        await db.queuedAttempts.update(attempt.id, {
          synced: true,
          retry_count: retry,
          last_error: undefined,
        });
      }

      logger.log(`Successfully synced attempt ${attempt.id}`);
      logger.metrics.attemptSynced();
      insertSuccess = true;
      break;
    } catch (error) {
      insertError = error instanceof Error ? error : new Error(String(error));

      // Update retry count
      if (attempt.id !== undefined) {
        await db.queuedAttempts.update(attempt.id, {
          retry_count: retry + 1,
          last_error: insertError.message,
        });
      }

      // If max retries reached, mark as failed
      if (retry >= MAX_RETRY_ATTEMPTS - 1) {
        if (attempt.id !== undefined) {
          await db.queuedAttempts.update(attempt.id, {
            failed: true,
          });
        }
        logger.error(
          `Attempt ${attempt.id}: Permanently failed after ${MAX_RETRY_ATTEMPTS} attempts`,
          error
        );
        logger.metrics.attemptFailed();
        break;
      }
    }
  }

  if (!insertSuccess && insertError) {
    logger.error(`Failed to insert attempt ${attempt.id}:`, insertError);
    logger.metrics.attemptFailed();
  }

  return insertSuccess;
}

/**
 * Insert queued attempts into Supabase
 */
async function syncQueuedAttempts(): Promise<void> {
  const queuedAttempts = await db.queuedAttempts
    .filter((attempt) => attempt.synced === false && attempt.failed === false)
    .toArray();

  logger.log(`Syncing ${queuedAttempts.length} attempts...`);

  for (const attempt of queuedAttempts) {
    try {
      // Get audio path if this attempt has audio
      const audioPath = await getAudioPathForAttempt(attempt);

      // null means skip this attempt (audio not ready or failed)
      if (audioPath === null) {
        continue;
      }

      // Check for duplicate attempts (idempotency)
      const exists = await attemptExists(attempt);
      if (exists) {
        continue;
      }

      // Attempt insert with retry logic
      await insertAttemptWithRetry(attempt, audioPath);
    } catch (error) {
      logger.error(`Error processing attempt ${attempt.id}:`, error);
      logger.metrics.attemptFailed();

      // Mark as failed if we can't even attempt the insert
      if (attempt.id !== undefined) {
        await db.queuedAttempts.update(attempt.id, {
          failed: true,
          last_error: error instanceof Error ? error.message : String(error),
        });
      }
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
  correct: boolean,
  typedAnswer?: string,
  audioBlobId?: number
): Promise<void> {
  await db.queuedAttempts.add({
    child_id: childId,
    word_id: wordId,
    list_id: listId,
    mode,
    correct,
    typed_answer: typedAnswer,
    audio_blob_id: audioBlobId,
    started_at: new Date().toISOString(),
    synced: false,
    retry_count: 0,
    failed: false,
  });

  logger.metrics.attemptQueued();
  logger.log(`Queued attempt for word ${wordId} (offline mode)`);
}

/**
 * Queue audio for later upload
 *
 * CRITICAL: filename must follow the format: {child_id}/{list_id}/{word_id}_{timestamp}.webm
 * This format is required by RLS policies which check (storage.foldername(name))[1] = child_id
 *
 * @param blob - Audio blob to upload
 * @param filename - Storage path in format: {child_id}/{list_id}/{word_id}_{timestamp}.webm
 * @returns The queued audio record ID for reference in attempts
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
    retry_count: 0,
    failed: false,
  });

  logger.metrics.audioQueued();
  logger.log(`Queued audio ${filename} for upload (offline mode)`);
  return id as number;
}

/**
 * Check if there are pending items to sync
 */
export async function hasPendingSync(): Promise<boolean> {
  const pendingAttempts = await db.queuedAttempts
    .filter((attempt) => attempt.synced === false && attempt.failed === false)
    .count();

  const pendingAudio = await db.queuedAudio
    .filter((audio) => audio.synced === false && audio.failed === false)
    .count();

  return pendingAttempts > 0 || pendingAudio > 0;
}

/**
 * Get all permanently failed items for UI display/telemetry
 * @returns Object containing failed attempts and audio
 */
export async function getFailedItems(): Promise<{
  failedAttempts: Array<{
    id: number;
    retryCount: number;
    lastError?: string;
    startedAt: string;
  }>;
  failedAudio: Array<{
    id: number;
    filename: string;
    retryCount: number;
    lastError?: string;
    createdAt: string;
  }>;
}> {
  const failedAttempts = await db.queuedAttempts
    .filter((attempt) => attempt.failed === true)
    .toArray();

  const failedAudio = await db.queuedAudio
    .filter((audio) => audio.failed === true)
    .toArray();

  return {
    failedAttempts: failedAttempts
      .filter((a) => a.id !== undefined)
      .map((a) => ({
        id: a.id as number,
        retryCount: a.retry_count,
        lastError: a.last_error,
        startedAt: a.started_at,
      })),
    failedAudio: failedAudio
      .filter((a) => a.id !== undefined)
      .map((a) => ({
        id: a.id as number,
        filename: a.filename,
        retryCount: a.retry_count,
        lastError: a.last_error,
        createdAt: a.created_at,
      })),
  };
}

/**
 * Clear all permanently failed items from the queue
 * Should be called after user acknowledges the failures or from admin UI
 */
export async function clearFailedItems(): Promise<void> {
  logger.log("Clearing permanently failed items from queue...");

  const deletedAttempts = await db.queuedAttempts
    .filter((attempt) => attempt.failed === true)
    .delete();

  const deletedAudio = await db.queuedAudio
    .filter((audio) => audio.failed === true)
    .delete();

  logger.log(
    `Cleared ${deletedAttempts} failed attempts and ${deletedAudio} failed audio files`
  );
}

/**
 * Reset retry count for a specific item (manual retry from UI)
 * @param type Type of item ('attempt' or 'audio')
 * @param id Item ID
 */
export async function retryFailedItem(
  type: "attempt" | "audio",
  id: number
): Promise<void> {
  if (type === "attempt") {
    await db.queuedAttempts.update(id, {
      failed: false,
      retry_count: 0,
      last_error: undefined,
    });
  } else {
    await db.queuedAudio.update(id, {
      failed: false,
      retry_count: 0,
      last_error: undefined,
    });
  }

  logger.log(`Reset retry count for ${type} ${id}`);
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

/**
 * Queue an SRS update for offline sync
 */
export async function queueSrsUpdate(
  childId: string,
  wordId: string,
  isCorrectFirstTry: boolean
): Promise<void> {
  await db.queuedSrsUpdates.add({
    child_id: childId,
    word_id: wordId,
    is_correct_first_try: isCorrectFirstTry,
    created_at: new Date().toISOString(),
    synced: false,
    retry_count: 0,
    failed: false,
  });

  logger.log(`Queued SRS update for word ${wordId}`);
  logger.metrics.attemptQueued(); // Reuse metrics
}

/**
 * Queue a star transaction for offline sync
 */
export async function queueStarTransaction(
  userId: string,
  amount: number,
  reason: string
): Promise<void> {
  await db.queuedStarTransactions.add({
    user_id: userId,
    amount,
    reason,
    created_at: new Date().toISOString(),
    synced: false,
    retry_count: 0,
    failed: false,
  });

  logger.log(`Queued star transaction: +${amount} stars for ${reason}`);
}

/**
 * Sync queued SRS updates to Supabase
 */
async function syncQueuedSrsUpdates(): Promise<void> {
  const queuedUpdates = await db.queuedSrsUpdates
    .filter((update) => update.synced === false && update.failed === false)
    .toArray();

  logger.log(`Syncing ${queuedUpdates.length} SRS updates...`);

  for (const update of queuedUpdates) {
    try {
      // Check if SRS entry already exists
      const { data: existing } = await supabase
        .from("srs")
        .select("*")
        .eq("child_id", update.child_id)
        .eq("word_id", update.word_id)
        .single();

      // Prepare SRS update values
      const { prepareSrsUpdate } = await import("@/lib/srs");
      const srsValues = prepareSrsUpdate(
        update.is_correct_first_try,
        existing || undefined
      );

      // Upsert SRS entry
      const { error } = await supabase.from("srs").upsert({
        child_id: update.child_id,
        word_id: update.word_id,
        ...srsValues,
      });

      if (error) throw error;

      // Mark as synced
      if (update.id !== undefined) {
        await db.queuedSrsUpdates.update(update.id, { synced: true });
        logger.log(`Synced SRS update ${update.id}`);
      }
    } catch (error) {
      const retryCount = update.retry_count + 1;

      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        // Mark as permanently failed
        if (update.id !== undefined) {
          await db.queuedSrsUpdates.update(update.id, {
            failed: true,
            retry_count: retryCount,
            last_error: error instanceof Error ? error.message : String(error),
          });
        }
        logger.error(
          `SRS update ${update.id} permanently failed after ${MAX_RETRY_ATTEMPTS} attempts:`,
          error
        );
      } else {
        // Update retry count for next attempt
        if (update.id !== undefined) {
          await db.queuedSrsUpdates.update(update.id, {
            retry_count: retryCount,
            last_error: error instanceof Error ? error.message : String(error),
          });
        }
        logger.warn(`SRS update ${update.id} failed, will retry:`, error);
        await sleep(calculateBackoffDelay(retryCount));
      }
    }
  }
}

/**
 * Sync queued star transactions to Supabase
 */
async function syncQueuedStarTransactions(): Promise<void> {
  const queuedTransactions = await db.queuedStarTransactions
    .filter(
      (transaction) =>
        transaction.synced === false && transaction.failed === false
    )
    .toArray();

  logger.log(`Syncing ${queuedTransactions.length} star transactions...`);

  for (const transaction of queuedTransactions) {
    try {
      // Call the award_stars RPC function
      const { error } = await supabase.rpc(
        "award_stars" as unknown as "fn_add_stars",
        {
          p_user_id: transaction.user_id,
          p_amount: transaction.amount,
          p_reason: transaction.reason,
        } as unknown as { p_child: string; p_amount: number }
      );

      if (error) throw error;

      // Mark as synced
      if (transaction.id !== undefined) {
        await db.queuedStarTransactions.update(transaction.id, {
          synced: true,
        });
        logger.log(`Synced star transaction ${transaction.id}`);
      }
    } catch (error) {
      const retryCount = transaction.retry_count + 1;

      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        // Mark as permanently failed
        if (transaction.id !== undefined) {
          await db.queuedStarTransactions.update(transaction.id, {
            failed: true,
            retry_count: retryCount,
            last_error: error instanceof Error ? error.message : String(error),
          });
        }
        logger.error(
          `Star transaction ${transaction.id} permanently failed after ${MAX_RETRY_ATTEMPTS} attempts:`,
          error
        );
      } else {
        // Update retry count for next attempt
        if (transaction.id !== undefined) {
          await db.queuedStarTransactions.update(transaction.id, {
            retry_count: retryCount,
            last_error: error instanceof Error ? error.message : String(error),
          });
        }
        logger.warn(
          `Star transaction ${transaction.id} failed, will retry:`,
          error
        );
        await sleep(calculateBackoffDelay(retryCount));
      }
    }
  }
}
