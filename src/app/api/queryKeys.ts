/**
 * Query Key Factory for React Query
 *
 * Centralized query key management to ensure consistency across the app.
 * Using the factory pattern prevents cache invalidation bugs and makes
 * refactoring easier.
 *
 * @see https://tkdodo.eu/blog/effective-react-query-keys#use-query-key-factories
 */

import type { QueryClient } from "@tanstack/react-query";

/**
 * Query key factory for all data fetching operations
 * Keys are hierarchical: general -> specific
 *
 * Example: ['wordLists', 'byUser', userId] - all word lists for a user
 *          ['wordLists', 'detail', listId] - specific word list with words
 */
export const queryKeys = {
  // Word Lists
  wordLists: {
    all: ["wordLists"] as const,
    byUser: (userId: string) =>
      [...queryKeys.wordLists.all, "byUser", userId] as const,
    detail: (listId: string) =>
      [...queryKeys.wordLists.all, "detail", listId] as const,
  },

  // Words (individual vocabulary items)
  words: {
    all: ["words"] as const,
    detail: (wordId: string) =>
      [...queryKeys.words.all, "detail", wordId] as const,
  },

  // SRS (Spaced Repetition)
  srs: {
    all: ["srs"] as const,
    dueWords: (childId: string) =>
      [...queryKeys.srs.all, "due", childId] as const,
    hardestWords: (childId: string, limit: number = 10) =>
      [...queryKeys.srs.all, "hardest", childId, limit] as const,
    mostLapsedWords: (childId: string, limit: number = 10) =>
      [...queryKeys.srs.all, "lapsed", childId, limit] as const,
    nextBatch: (
      childId: string,
      listId: string | undefined,
      limit: number,
      strictMode: boolean
    ) =>
      [
        ...queryKeys.srs.all,
        "batch",
        childId,
        listId,
        limit,
        strictMode,
      ] as const,
  },

  // Attempts (practice history)
  attempts: {
    all: ["attempts"] as const,
    byChild: (childId: string) =>
      [...queryKeys.attempts.all, "byChild", childId] as const,
    byChildAndWord: (childId: string, wordId: string) =>
      [...queryKeys.attempts.all, "byChild", childId, "word", wordId] as const,
  },

  // Profiles
  profiles: {
    all: ["profiles"] as const,
    detail: (userId: string) =>
      [...queryKeys.profiles.all, "detail", userId] as const,
  },

  // Analytics
  analytics: {
    all: ["analytics"] as const,
    parentOverview: (parentId: string, dateFrom?: Date, dateTo?: Date) =>
      [
        ...queryKeys.analytics.all,
        "parentOverview",
        parentId,
        dateFrom,
        dateTo,
      ] as const,
    childMastery: (childId: string) =>
      [...queryKeys.analytics.all, "childMastery", childId] as const,
    ngramErrors: (childId: string, limit: number = 10) =>
      [...queryKeys.analytics.all, "ngramErrors", childId, limit] as const,
  },

  // Children (parent-child relationships)
  children: {
    all: ["children"] as const,
    byParent: (parentId: string) =>
      [...queryKeys.children.all, "byParent", parentId] as const,
  },

  // Rewards (D4 feature)
  rewards: {
    all: ["rewards"] as const,
    catalog: (type?: "avatar" | "theme" | "coupon" | "badge") =>
      [...queryKeys.rewards.all, "catalog", type] as const,
    userRewards: (userId: string) =>
      [...queryKeys.rewards.all, "user", userId] as const,
  },
} as const;

/**
 * Helper to invalidate all queries related to a specific word list
 * Useful when a list is updated and multiple related queries need refreshing
 */
export function invalidateWordListQueries(
  queryClient: QueryClient,
  listId: string,
  userId?: string
) {
  queryClient.invalidateQueries({
    queryKey: queryKeys.wordLists.detail(listId),
  });
  if (userId) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.wordLists.byUser(userId),
    });
  }
}

/**
 * Helper to invalidate all SRS-related queries for a child
 * Call this after SRS updates to refresh due words, hardest words, etc.
 */
export function invalidateSrsQueries(
  queryClient: QueryClient,
  childId: string
) {
  queryClient.invalidateQueries({ queryKey: queryKeys.srs.dueWords(childId) });
  // Invalidate all hardest/lapsed queries for this child (all limit variations)
  queryClient.invalidateQueries({
    queryKey: [...queryKeys.srs.all, "hardest", childId],
    exact: false,
  });
  queryClient.invalidateQueries({
    queryKey: [...queryKeys.srs.all, "lapsed", childId],
    exact: false,
  });
}

/**
 * Helper to invalidate profile and related queries
 */
export function invalidateProfileQueries(
  queryClient: QueryClient,
  userId: string
) {
  queryClient.invalidateQueries({
    queryKey: queryKeys.profiles.detail(userId),
  });
  queryClient.invalidateQueries({
    queryKey: queryKeys.rewards.userRewards(userId),
  });
}
