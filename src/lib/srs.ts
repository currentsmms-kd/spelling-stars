/**
 * Spaced Repetition System (SRS) utilities
 * Implements SM-2-lite algorithm for word scheduling
 */

import type { Database } from "@/types/database.types";

type SrsEntry = Database["public"]["Tables"]["srs"]["Row"];
type SrsInsert = Database["public"]["Tables"]["srs"]["Insert"];
type SrsUpdate = Database["public"]["Tables"]["srs"]["Update"];

export interface SrsUpdateResult {
  ease: number;
  interval_days: number;
  due_date: string;
  reps: number;
  lapses: number;
}

/**
 * Calculate new SRS values when a word is answered correctly on first try
 * SM-2-lite algorithm:
 * - ease increases by 0.1 (min 1.3)
 * - interval = 1 day if first time, else previous_interval * ease (rounded)
 * - due_date = today + interval
 * - reps increments
 */
export function calculateSrsOnSuccess(
  currentEntry?: Partial<SrsEntry>
): SrsUpdateResult {
  const currentEase = currentEntry?.ease ?? 2.5;
  const currentInterval = currentEntry?.interval_days ?? 0;
  const currentReps = currentEntry?.reps ?? 0;
  const currentLapses = currentEntry?.lapses ?? 0;

  // Increase ease factor
  const newEase = Math.max(1.3, currentEase + 0.1);

  // Calculate new interval
  const newInterval =
    currentInterval === 0 ? 1 : Math.round(currentInterval * newEase);

  // Calculate due date (today + interval)
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + newInterval);
  const dueDateString = dueDate.toISOString().split("T")[0]; // Format as YYYY-MM-DD

  return {
    ease: newEase,
    interval_days: newInterval,
    due_date: dueDateString,
    reps: currentReps + 1,
    lapses: currentLapses,
  };
}

/**
 * Calculate new SRS values when a word is answered incorrectly (not first try)
 * SM-2-lite algorithm:
 * - ease decreases by 0.2 (min 1.3)
 * - interval resets to 0 (due immediately)
 * - due_date = today
 * - lapses increments
 */
export function calculateSrsOnMiss(
  currentEntry?: Partial<SrsEntry>
): SrsUpdateResult {
  const currentEase = currentEntry?.ease ?? 2.5;
  const currentReps = currentEntry?.reps ?? 0;
  const currentLapses = currentEntry?.lapses ?? 0;

  // Decrease ease factor
  const newEase = Math.max(1.3, currentEase - 0.2);

  // Reset interval to 0 (due immediately)
  const newInterval = 0;

  // Due today
  const dueDate = new Date();
  const dueDateString = dueDate.toISOString().split("T")[0];

  return {
    ease: newEase,
    interval_days: newInterval,
    due_date: dueDateString,
    reps: currentReps,
    lapses: currentLapses + 1,
  };
}

/**
 * Prepare an SRS insert record for a correct answer
 */
export function createSrsInsertOnSuccess(
  childId: string,
  wordId: string
): SrsInsert {
  const srsValues = calculateSrsOnSuccess();

  return {
    child_id: childId,
    word_id: wordId,
    ease: srsValues.ease,
    interval_days: srsValues.interval_days,
    due_date: srsValues.due_date,
    reps: srsValues.reps,
    lapses: srsValues.lapses,
  };
}

/**
 * Prepare an SRS insert record for an incorrect answer
 */
export function createSrsInsertOnMiss(
  childId: string,
  wordId: string
): SrsInsert {
  const srsValues = calculateSrsOnMiss();

  return {
    child_id: childId,
    word_id: wordId,
    ease: srsValues.ease,
    interval_days: srsValues.interval_days,
    due_date: srsValues.due_date,
    reps: srsValues.reps,
    lapses: srsValues.lapses,
  };
}

/**
 * Prepare an SRS update record based on attempt result
 */
export function prepareSrsUpdate(
  isCorrectFirstTry: boolean,
  currentEntry?: SrsEntry
): SrsUpdate {
  const srsValues = isCorrectFirstTry
    ? calculateSrsOnSuccess(currentEntry)
    : calculateSrsOnMiss(currentEntry);

  return {
    ease: srsValues.ease,
    interval_days: srsValues.interval_days,
    due_date: srsValues.due_date,
    reps: srsValues.reps,
    lapses: srsValues.lapses,
  };
}

/**
 * Check if a word is due for review today
 */
export function isDueToday(srsEntry: SrsEntry): boolean {
  const today = new Date().toISOString().split("T")[0];
  return srsEntry.due_date <= today;
}

/**
 * Check if a word is overdue
 */
export function isOverdue(srsEntry: SrsEntry): boolean {
  const today = new Date().toISOString().split("T")[0];
  return srsEntry.due_date < today;
}

/**
 * Get the number of days until a word is due
 */
export function daysUntilDue(srsEntry: SrsEntry): number {
  const today = new Date();
  const dueDate = new Date(srsEntry.due_date);
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export type { SrsEntry, SrsInsert, SrsUpdate };
