import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/supabase", () => {
  const queryBuilder = {
    select: () => queryBuilder,
    eq: () => Promise.resolve({ data: [], error: null }),
    insert: () => Promise.resolve({ data: null, error: null }),
    upsert: () => Promise.resolve({ data: null, error: null }),
    delete: () => Promise.resolve({ data: null, error: null }),
  };

  const storageBuilder = {
    list: () => Promise.resolve({ data: [], error: null }),
    upload: () => Promise.resolve({ data: { path: "mock-path" }, error: null }),
    move: () => Promise.resolve({ data: null, error: null }),
  };

  return {
    supabase: {
      from: () => queryBuilder,
      storage: {
        from: () => storageBuilder,
      },
    },
  };
});

import { getPendingCounts } from "./sync";
import type { SpellStarsDB } from "@/data/db";

type QueueCountConfig = {
  attempts: number;
  audio: number;
  srsUpdates: number;
  starTransactions: number;
  failedAttempts: number;
  failedAudio: number;
  failedSrsUpdates: number;
  failedStarTransactions: number;
};

type MockTable = {
  filter: (
    predicate: (item: { synced: boolean; failed: boolean }) => boolean,
  ) => {
    count: () => Promise<number>;
  };
};

function evaluatePredicate(
  predicate: (item: { synced: boolean; failed: boolean }) => boolean,
  sample: { synced: boolean; failed: boolean },
): boolean {
  try {
    return Boolean(predicate(sample));
  } catch {
    return false;
  }
}

function createMockTable(pending: number, failed: number): MockTable {
  return {
    filter: (predicate) => {
      const matchesPending = evaluatePredicate(predicate, {
        synced: false,
        failed: false,
      });
      const matchesFailed = evaluatePredicate(predicate, {
        synced: true,
        failed: true,
      });

      const value = matchesFailed && !matchesPending ? failed : pending;
      return {
        count: () => Promise.resolve(value),
      };
    },
  };
}

function createMockDb(config: QueueCountConfig): SpellStarsDB {
  return {
    queuedAttempts: createMockTable(config.attempts, config.failedAttempts),
    queuedAudio: createMockTable(config.audio, config.failedAudio),
    queuedSrsUpdates: createMockTable(
      config.srsUpdates,
      config.failedSrsUpdates,
    ),
    queuedStarTransactions: createMockTable(
      config.starTransactions,
      config.failedStarTransactions,
    ),
  } as unknown as SpellStarsDB;
}

describe("getPendingCounts", () => {
  it("returns detailed counts for each queue", async () => {
    const mockDb = createMockDb({
      attempts: 5,
      audio: 3,
      srsUpdates: 2,
      starTransactions: 4,
      failedAttempts: 1,
      failedAudio: 2,
      failedSrsUpdates: 0,
      failedStarTransactions: 3,
    });

    const result = await getPendingCounts(mockDb);

    expect(result).toEqual({
      attempts: 5,
      audio: 3,
      srsUpdates: 2,
      starTransactions: 4,
      total: 14,
      failed: {
        attempts: 1,
        audio: 2,
        srsUpdates: 0,
        starTransactions: 3,
        total: 6,
      },
    });
  });

  it("falls back to zero counts when IndexedDB operations fail", async () => {
    const erroringTable: MockTable = {
      filter: () => {
        throw new Error("IndexedDB unavailable");
      },
    };

    const faultyDb = {
      queuedAttempts: erroringTable,
      queuedAudio: erroringTable,
      queuedSrsUpdates: erroringTable,
      queuedStarTransactions: erroringTable,
    } as unknown as SpellStarsDB;

    const result = await getPendingCounts(faultyDb);

    expect(result).toEqual({
      attempts: 0,
      audio: 0,
      srsUpdates: 0,
      starTransactions: 0,
      total: 0,
      failed: {
        attempts: 0,
        audio: 0,
        srsUpdates: 0,
        starTransactions: 0,
        total: 0,
      },
    });
  });
});
