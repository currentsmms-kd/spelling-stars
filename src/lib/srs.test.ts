/**
 * Tests for Spaced Repetition System (SRS) utilities
 * Validates SM-2-lite algorithm implementation
 */

import { describe, it, expect } from "vitest";
import {
  calculateSrsOnSuccess,
  calculateSrsOnMiss,
  createSrsInsertOnSuccess,
  createSrsInsertOnMiss,
  prepareSrsUpdate,
  isDueToday,
  isOverdue,
  daysUntilDue,
  type SrsEntry,
} from "./srs";

describe("calculateSrsOnSuccess", () => {
  it("should increase ease factor by 0.1", () => {
    const entry = { ease: 2.5, interval_days: 1, reps: 0, lapses: 0 };
    const result = calculateSrsOnSuccess(entry);
    expect(result.ease).toBe(2.6);
  });

  it("should set interval to 1 on first success when interval is 0", () => {
    const entry = { ease: 2.5, interval_days: 0, reps: 0, lapses: 0 };
    const result = calculateSrsOnSuccess(entry);
    expect(result.interval_days).toBe(1);
  });

  it("should multiply interval by ease factor on subsequent successes", () => {
    const entry = { ease: 2.5, interval_days: 2, reps: 1, lapses: 0 };
    const result = calculateSrsOnSuccess(entry);
    // 2 * 2.6 = 5.2, rounded to 5
    expect(result.interval_days).toBe(5);
  });

  it("should round interval to nearest integer", () => {
    const entry = { ease: 2.3, interval_days: 3, reps: 2, lapses: 0 };
    const result = calculateSrsOnSuccess(entry);
    // 3 * 2.4 = 7.2, rounded to 7
    expect(result.interval_days).toBe(7);
  });

  it("should increment reps counter", () => {
    const entry = { ease: 2.5, interval_days: 1, reps: 5, lapses: 0 };
    const result = calculateSrsOnSuccess(entry);
    expect(result.reps).toBe(6);
  });

  it("should not change lapses counter", () => {
    const entry = { ease: 2.5, interval_days: 1, reps: 0, lapses: 3 };
    const result = calculateSrsOnSuccess(entry);
    expect(result.lapses).toBe(3);
  });

  it("should set due date to today + interval", () => {
    const entry = { ease: 2.5, interval_days: 0, reps: 0, lapses: 0 };
    const result = calculateSrsOnSuccess(entry);

    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + 1);
    const expectedDateString = expectedDate.toISOString().split("T")[0];

    expect(result.due_date).toBe(expectedDateString);
  });

  it("should use default values when no entry provided", () => {
    const result = calculateSrsOnSuccess();
    expect(result.ease).toBe(2.6); // 2.5 + 0.1
    expect(result.interval_days).toBe(1); // First success
    expect(result.reps).toBe(1);
    expect(result.lapses).toBe(0);
  });

  it("should maintain minimum ease factor of 1.3", () => {
    const entry = { ease: 1.3, interval_days: 1, reps: 0, lapses: 0 };
    const result = calculateSrsOnSuccess(entry);
    expect(result.ease).toBe(1.4);
  });

  it("should handle large interval values", () => {
    const entry = { ease: 2.5, interval_days: 100, reps: 10, lapses: 0 };
    const result = calculateSrsOnSuccess(entry);
    // 100 * 2.6 = 260
    expect(result.interval_days).toBe(260);
  });
});

describe("calculateSrsOnMiss", () => {
  it("should decrease ease factor by 0.2", () => {
    const entry = { ease: 2.5, interval_days: 5, reps: 3, lapses: 0 };
    const result = calculateSrsOnMiss(entry);
    expect(result.ease).toBe(2.3);
  });

  it("should reset interval to 0", () => {
    const entry = { ease: 2.5, interval_days: 10, reps: 5, lapses: 0 };
    const result = calculateSrsOnMiss(entry);
    expect(result.interval_days).toBe(0);
  });

  it("should not change reps counter", () => {
    const entry = { ease: 2.5, interval_days: 5, reps: 7, lapses: 2 };
    const result = calculateSrsOnMiss(entry);
    expect(result.reps).toBe(7);
  });

  it("should increment lapses counter", () => {
    const entry = { ease: 2.5, interval_days: 5, reps: 3, lapses: 2 };
    const result = calculateSrsOnMiss(entry);
    expect(result.lapses).toBe(3);
  });

  it("should set due date to today", () => {
    const entry = { ease: 2.5, interval_days: 10, reps: 3, lapses: 0 };
    const result = calculateSrsOnMiss(entry);

    const today = new Date().toISOString().split("T")[0];
    expect(result.due_date).toBe(today);
  });

  it("should maintain minimum ease factor of 1.3", () => {
    const entry = { ease: 1.4, interval_days: 1, reps: 0, lapses: 0 };
    const result = calculateSrsOnMiss(entry);
    expect(result.ease).toBe(1.3);
  });

  it("should not go below minimum ease factor of 1.3", () => {
    const entry = { ease: 1.3, interval_days: 1, reps: 0, lapses: 5 };
    const result = calculateSrsOnMiss(entry);
    expect(result.ease).toBe(1.3);
  });

  it("should use default values when no entry provided", () => {
    const result = calculateSrsOnMiss();
    expect(result.ease).toBe(2.3); // 2.5 - 0.2
    expect(result.interval_days).toBe(0);
    expect(result.reps).toBe(0);
    expect(result.lapses).toBe(1);
  });

  it("should handle multiple consecutive failures", () => {
    let entry = { ease: 2.5, interval_days: 10, reps: 5, lapses: 0 };

    // First miss
    let result = calculateSrsOnMiss(entry);
    expect(result.ease).toBe(2.3);
    expect(result.lapses).toBe(1);

    // Second miss
    result = calculateSrsOnMiss(result);
    expect(result.ease).toBe(2.1);
    expect(result.lapses).toBe(2);

    // Third miss
    result = calculateSrsOnMiss(result);
    expect(result.ease).toBe(1.9);
    expect(result.lapses).toBe(3);
  });
});

describe("createSrsInsertOnSuccess", () => {
  it("should create insert record with correct structure", () => {
    const childId = "child-123";
    const wordId = "word-456";
    const result = createSrsInsertOnSuccess(childId, wordId);

    expect(result).toHaveProperty("child_id", childId);
    expect(result).toHaveProperty("word_id", wordId);
    expect(result).toHaveProperty("ease");
    expect(result).toHaveProperty("interval_days");
    expect(result).toHaveProperty("due_date");
    expect(result).toHaveProperty("reps");
    expect(result).toHaveProperty("lapses");
  });

  it("should use first-success SRS values", () => {
    const result = createSrsInsertOnSuccess("child-123", "word-456");

    expect(result.ease).toBe(2.6);
    expect(result.interval_days).toBe(1);
    expect(result.reps).toBe(1);
    expect(result.lapses).toBe(0);
  });
});

describe("createSrsInsertOnMiss", () => {
  it("should create insert record with correct structure", () => {
    const childId = "child-123";
    const wordId = "word-456";
    const result = createSrsInsertOnMiss(childId, wordId);

    expect(result).toHaveProperty("child_id", childId);
    expect(result).toHaveProperty("word_id", wordId);
    expect(result).toHaveProperty("ease");
    expect(result).toHaveProperty("interval_days");
    expect(result).toHaveProperty("due_date");
    expect(result).toHaveProperty("reps");
    expect(result).toHaveProperty("lapses");
  });

  it("should use first-miss SRS values", () => {
    const result = createSrsInsertOnMiss("child-123", "word-456");

    expect(result.ease).toBe(2.3);
    expect(result.interval_days).toBe(0);
    expect(result.reps).toBe(0);
    expect(result.lapses).toBe(1);
  });
});

describe("prepareSrsUpdate", () => {
  const mockEntry: SrsEntry = {
    id: "1",
    child_id: "child-123",
    word_id: "word-456",
    ease: 2.5,
    interval_days: 5,
    due_date: "2025-11-10",
    reps: 3,
    lapses: 1,
    created_at: "2025-11-01T00:00:00Z",
    updated_at: "2025-11-01T00:00:00Z",
  };

  it("should call calculateSrsOnSuccess when isCorrectFirstTry is true", () => {
    const result = prepareSrsUpdate(true, mockEntry);

    expect(result.ease).toBe(2.6); // 2.5 + 0.1
    expect(result.interval_days).toBe(13); // round(5 * 2.6)
    expect(result.reps).toBe(4);
    expect(result.lapses).toBe(1);
  });

  it("should call calculateSrsOnMiss when isCorrectFirstTry is false", () => {
    const result = prepareSrsUpdate(false, mockEntry);

    expect(result.ease).toBe(2.3); // 2.5 - 0.2
    expect(result.interval_days).toBe(0);
    expect(result.reps).toBe(3);
    expect(result.lapses).toBe(2);
  });

  it("should handle missing currentEntry", () => {
    const resultSuccess = prepareSrsUpdate(true);
    expect(resultSuccess.ease).toBe(2.6);

    const resultMiss = prepareSrsUpdate(false);
    expect(resultMiss.ease).toBe(2.3);
  });
});

describe("isDueToday", () => {
  const createMockEntry = (dueDate: string): SrsEntry => ({
    id: "1",
    child_id: "child-123",
    word_id: "word-456",
    ease: 2.5,
    interval_days: 1,
    due_date: dueDate,
    reps: 0,
    lapses: 0,
    created_at: "2025-11-01T00:00:00Z",
    updated_at: "2025-11-01T00:00:00Z",
  });

  it("should return true when due date is today", () => {
    const today = new Date().toISOString().split("T")[0];
    const entry = createMockEntry(today);
    expect(isDueToday(entry)).toBe(true);
  });

  it("should return true when due date is in the past", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = yesterday.toISOString().split("T")[0];

    const entry = createMockEntry(yesterdayString);
    expect(isDueToday(entry)).toBe(true);
  });

  it("should return false when due date is in the future", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = tomorrow.toISOString().split("T")[0];

    const entry = createMockEntry(tomorrowString);
    expect(isDueToday(entry)).toBe(false);
  });
});

describe("isOverdue", () => {
  const createMockEntry = (dueDate: string): SrsEntry => ({
    id: "1",
    child_id: "child-123",
    word_id: "word-456",
    ease: 2.5,
    interval_days: 1,
    due_date: dueDate,
    reps: 0,
    lapses: 0,
    created_at: "2025-11-01T00:00:00Z",
    updated_at: "2025-11-01T00:00:00Z",
  });

  it("should return true when due date is in the past", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = yesterday.toISOString().split("T")[0];

    const entry = createMockEntry(yesterdayString);
    expect(isOverdue(entry)).toBe(true);
  });

  it("should return false when due date is today", () => {
    const today = new Date().toISOString().split("T")[0];
    const entry = createMockEntry(today);
    expect(isOverdue(entry)).toBe(false);
  });

  it("should return false when due date is in the future", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = tomorrow.toISOString().split("T")[0];

    const entry = createMockEntry(tomorrowString);
    expect(isOverdue(entry)).toBe(false);
  });
});

describe("daysUntilDue", () => {
  const createMockEntry = (daysOffset: number): SrsEntry => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysOffset);
    const dueDateString = dueDate.toISOString().split("T")[0];

    return {
      id: "1",
      child_id: "child-123",
      word_id: "word-456",
      ease: 2.5,
      interval_days: 1,
      due_date: dueDateString,
      reps: 0,
      lapses: 0,
      created_at: "2025-11-01T00:00:00Z",
      updated_at: "2025-11-01T00:00:00Z",
    };
  };

  it("should return 0 when due today", () => {
    const entry = createMockEntry(0);
    const days = daysUntilDue(entry);
    expect(days).toBe(0);
  });

  it("should return positive number for future dates", () => {
    const entry = createMockEntry(5);
    const days = daysUntilDue(entry);
    expect(days).toBe(5);
  });

  it("should return negative number for past dates", () => {
    const entry = createMockEntry(-3);
    const days = daysUntilDue(entry);
    expect(days).toBe(-3);
  });

  it("should round up partial days", () => {
    // This test verifies the Math.ceil behavior
    const entry = createMockEntry(1);
    const days = daysUntilDue(entry);
    expect(days).toBeGreaterThanOrEqual(1);
  });
});

describe("SM-2-lite algorithm integration", () => {
  it("should demonstrate typical learning progression", () => {
    // Start with no history
    let state = { ease: 2.5, interval_days: 0, reps: 0, lapses: 0 };

    // First success: interval becomes 1 day
    state = calculateSrsOnSuccess(state);
    expect(state.interval_days).toBe(1);
    expect(state.ease).toBe(2.6);
    expect(state.reps).toBe(1);

    // Second success: interval = 1 * 2.7 = 2.7 ≈ 3 days
    state = calculateSrsOnSuccess(state);
    expect(state.interval_days).toBe(3);
    expect(state.ease).toBe(2.7);
    expect(state.reps).toBe(2);

    // Third success: interval = 3 * 2.8 = 8.4 ≈ 8 days
    state = calculateSrsOnSuccess(state);
    expect(state.interval_days).toBe(8);
    expect(state.ease).toBe(2.8);
    expect(state.reps).toBe(3);
  });

  it("should demonstrate recovery from failure", () => {
    // Start with established knowledge
    let state = { ease: 2.5, interval_days: 10, reps: 5, lapses: 0 };

    // Miss: reset to immediate review
    state = calculateSrsOnMiss(state);
    expect(state.interval_days).toBe(0);
    expect(state.ease).toBe(2.3);
    expect(state.lapses).toBe(1);

    // Re-learn: back to 1 day
    state = calculateSrsOnSuccess(state);
    expect(state.interval_days).toBe(1);
    expect(state.ease).toBe(2.4);

    // Continue rebuilding
    state = calculateSrsOnSuccess(state);
    expect(state.interval_days).toBe(2); // 1 * 2.5 = 2.5 ≈ 2
  });

  it("should handle difficult words with multiple failures", () => {
    let state = { ease: 2.5, interval_days: 0, reps: 0, lapses: 0 };

    // Multiple failures
    state = calculateSrsOnMiss(state);
    state = calculateSrsOnMiss(state);
    state = calculateSrsOnMiss(state);

    expect(state.ease).toBe(1.9); // 2.5 - 0.6
    expect(state.lapses).toBe(3);
    expect(state.interval_days).toBe(0);

    // Eventually succeed
    state = calculateSrsOnSuccess(state);
    expect(state.ease).toBe(2.0);
    expect(state.interval_days).toBe(1);
  });
});
