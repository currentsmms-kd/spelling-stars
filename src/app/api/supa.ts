/**
 * Supabase API client with typed helpers
 * Provides convenient functions for common database operations
 */

import { supabase } from "../supabase";
import type { Database } from "../../types/database.types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { prepareSrsUpdate } from "../../lib/srs";
import type { SrsEntry, SrsInsert, SrsUpdate } from "../../lib/srs";
import { logger } from "@/lib/logger";
import {
  queryKeys,
  invalidateWordListQueries,
  invalidateSrsQueries,
  invalidateProfileQueries,
} from "./queryKeys";

// Type aliases for convenience
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type WordList = Database["public"]["Tables"]["word_lists"]["Row"];
type Word = Database["public"]["Tables"]["words"]["Row"];
type WordInsert = Database["public"]["Tables"]["words"]["Insert"];
type WordUpdate = Database["public"]["Tables"]["words"]["Update"];
type ListWord = Database["public"]["Tables"]["list_words"]["Row"];
type Attempt = Database["public"]["Tables"]["attempts"]["Row"];
type AttemptInsert = Database["public"]["Tables"]["attempts"]["Insert"];
type Reward = Database["public"]["Tables"]["rewards"]["Row"];

// Extended types for joined data
export interface WordListWithWords extends WordList {
  words: Array<Word & { sort_index: number }>;
  word_count?: number;
}

export interface WordListInsert {
  title: string;
  week_start_date?: string | null;
  created_by: string;
}

export interface WordListUpdate {
  title?: string;
  week_start_date?: string | null;
}

export interface WordWithIndex extends Word {
  sort_index: number;
}

/**
 * Create a signed URL for private audio recordings
 * @param path - Storage path to the audio file
 * @param expiresIn - Time in seconds until URL expires (default: 3600 = 1 hour)
 * @returns Signed URL or null on error
 */
export async function getSignedAudioUrl(
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from("audio-recordings")
      .createSignedUrl(path, expiresIn);

    if (error) {
      logger.error("Error creating signed URL:", error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    logger.error("Exception creating signed URL:", error);
    return null;
  }
}

/**
 * Create multiple signed URLs in bulk
 * @param paths - Array of storage paths
 * @param expiresIn - Time in seconds until URLs expire (default: 3600 = 1 hour)
 * @returns Object mapping paths to signed URLs
 */
export async function getSignedAudioUrls(
  paths: string[],
  expiresIn = 3600
): Promise<Record<string, string | null>> {
  const urlMap: Record<string, string | null> = {};

  await Promise.all(
    paths.map(async (path) => {
      const signedUrl = await getSignedAudioUrl(path, expiresIn);
      urlMap[path] = signedUrl;
    })
  );

  return urlMap;
}

/**
 * Create a signed URL for private prompt audio (word-audio bucket)
 * @param path - Storage path to the prompt audio file
 * @param expiresIn - Time in seconds until URL expires (default: 3600 = 1 hour)
 * @returns Signed URL or null on error
 */
export async function getSignedPromptAudioUrl(
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from("word-audio")
      .createSignedUrl(path, expiresIn);

    if (error) {
      logger.error("Error creating signed prompt audio URL:", error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    logger.error("Exception creating signed prompt audio URL:", error);
    return null;
  }
}

/**
 * Create multiple signed URLs for prompt audio in bulk
 * @param paths - Array of storage paths
 * @param expiresIn - Time in seconds until URLs expire (default: 3600 = 1 hour)
 * @returns Object mapping paths to signed URLs
 */
export async function getSignedPromptAudioUrls(
  paths: string[],
  expiresIn = 3600
): Promise<Record<string, string | null>> {
  const urlMap: Record<string, string | null> = {};

  await Promise.all(
    paths.map(async (path) => {
      const signedUrl = await getSignedPromptAudioUrl(path, expiresIn);
      urlMap[path] = signedUrl;
    })
  );

  return urlMap;
}

/**
 * Get the current user's profile
 */
export async function getProfilesMe(): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    logger.error("Error fetching profile:", error);
    return null;
  }

  return data;
}

/**
 * Get all word lists (for authenticated users)
 */
export async function getLists(): Promise<WordList[]> {
  const { data, error } = await supabase
    .from("word_lists")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Error fetching lists:", error);
    return [];
  }

  return data || [];
}

/**
 * Get a specific word list with all its words (joined and sorted)
 */
export async function getListWithWords(
  listId: string
): Promise<WordListWithWords | null> {
  // First, get the list
  const { data: list, error: listError } = await supabase
    .from("word_lists")
    .select("*")
    .eq("id", listId)
    .single();

  if (listError || !list) {
    logger.error("Error fetching list:", listError);
    return null;
  }

  // Then, get the words with their sort indices
  const { data: listWords, error: wordsError } = await supabase
    .from("list_words")
    .select("sort_index, words (*)")
    .eq("list_id", listId)
    .order("sort_index", { ascending: true });

  if (wordsError) {
    logger.error("Error fetching words:", wordsError);
    return { ...list, words: [] };
  }

  // Transform the data to flatten the structure
  const words =
    listWords?.map((lw) => ({
      ...(lw.words as Word),
      sort_index: lw.sort_index,
    })) || [];

  // Generate signed URLs for prompt audio paths
  // Use batch function for efficiency
  const pathsToSign = words
    .filter((w): w is typeof w & { prompt_audio_path: string } =>
      Boolean(w.prompt_audio_path)
    )
    .map((w) => w.prompt_audio_path);

  const signedUrlMap =
    pathsToSign.length > 0 ? await getSignedPromptAudioUrls(pathsToSign) : {};

  // Add signed URLs to words (temporarily store in prompt_audio_url field for backward compatibility)
  const wordsWithSignedUrls = words.map((word) => {
    if (word.prompt_audio_path && signedUrlMap[word.prompt_audio_path]) {
      return {
        ...word,
        prompt_audio_url: signedUrlMap[word.prompt_audio_path],
      };
    }
    return word;
  });

  return {
    ...list,
    words: wordsWithSignedUrls,
  };
}

/**
 * Create or update a word list
 */
export async function upsertList(
  list: WordListInsert | (WordListUpdate & { id: string })
): Promise<WordList | null> {
  if ("id" in list) {
    // Update existing list
    const { id, ...updates } = list;
    const { data, error } = await supabase
      .from("word_lists")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("Error updating list:", error);
      return null;
    }

    return data;
  } else {
    // Create new list
    const { data, error } = await supabase
      .from("word_lists")
      .insert(list)
      .select()
      .single();

    if (error) {
      logger.error("Error creating list:", error);
      return null;
    }

    return data;
  }
}

/**
 * Insert a new attempt for a child
 */
export async function insertAttempt(
  attempt: AttemptInsert
): Promise<Attempt | null> {
  const { data, error } = await supabase
    .from("attempts")
    .insert(attempt)
    .select()
    .single();

  if (error) {
    logger.error("Error inserting attempt:", error);
    return null;
  }

  return data;
}

/**
 * Upload an audio file to Supabase storage
 * Returns the public URL if successful
 */
export async function uploadAudio(file: File): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    logger.error("User not authenticated");
    return null;
  }

  // Generate a unique filename
  const timestamp = Date.now();
  const fileExt = file.name.split(".").pop();
  const fileName = `${user.id}/${timestamp}.${fileExt}`;

  // Upload the file
  const { data, error } = await supabase.storage
    .from("audio-recordings")
    .upload(fileName, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    logger.error("Error uploading audio:", error);
    return null;
  }

  // Store the path, not a URL - signed URLs will be generated on-demand
  // This ensures recordings remain private and URLs expire
  return data.path;
}

/**
 * Get rewards for a specific child
 */
export async function getRewards(childId: string): Promise<Reward | null> {
  const { data, error } = await supabase
    .from("rewards")
    .select("*")
    .eq("child_id", childId)
    .single();

  if (error) {
    logger.error("Error fetching rewards:", error);
    return null;
  }

  return data;
}

/**
 * Add stars to a child's rewards using the SQL function
 */
export async function addStars(
  childId: string,
  amount: number
): Promise<number | null> {
  const { data, error } = await supabase.rpc("fn_add_stars", {
    p_child: childId,
    p_amount: amount,
  });

  if (error) {
    logger.error("Error adding stars:", error);
    return null;
  }

  return data;
}

/**
 * Create a new word
 */
export async function createWord(word: {
  text: string;
  phonetic?: string | null;
  tts_voice?: string | null;
  prompt_audio_url?: string | null;
}): Promise<Word | null> {
  const { data, error } = await supabase
    .from("words")
    .insert(word)
    .select()
    .single();

  if (error) {
    logger.error("Error creating word:", error);
    return null;
  }

  return data;
}

/**
 * Add a word to a list with a specific sort index
 */
export async function addWordToList(
  listId: string,
  wordId: string,
  sortIndex: number
): Promise<ListWord | null> {
  const { data, error } = await supabase
    .from("list_words")
    .insert({
      list_id: listId,
      word_id: wordId,
      sort_index: sortIndex,
    })
    .select()
    .single();

  if (error) {
    logger.error("Error adding word to list:", error);
    return null;
  }

  return data;
}

/**
 * Remove a word from a list
 */
export async function removeWordFromList(
  listId: string,
  wordId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("list_words")
    .delete()
    .eq("list_id", listId)
    .eq("word_id", wordId);

  if (error) {
    logger.error("Error removing word from list:", error);
    return false;
  }

  return true;
}

/**
 * Get all attempts for a child
 */
export async function getAttempts(childId: string): Promise<Attempt[]> {
  const { data, error } = await supabase
    .from("attempts")
    .select("*")
    .eq("child_id", childId)
    .order("started_at", { ascending: false });

  if (error) {
    logger.error("Error fetching attempts:", error);
    return [];
  }

  return data || [];
}

/**
 * Get attempts for a specific word
 */
export async function getAttemptsForWord(
  childId: string,
  wordId: string
): Promise<Attempt[]> {
  const { data, error } = await supabase
    .from("attempts")
    .select("*")
    .eq("child_id", childId)
    .eq("word_id", wordId)
    .order("started_at", { ascending: false });

  if (error) {
    logger.error("Error fetching attempts for word:", error);
    return [];
  }

  return data || [];
}

/**
 * Enhanced attempt type with signed URL for audio playback
 * IMPORTANT: attempts.audio_url stores STORAGE PATHS, not URLs
 * This type includes the generated signed URL for immediate playback
 */
export interface AttemptWithSignedAudio extends Attempt {
  audio_signed_url?: string | null;
}

/**
 * Transform attempts array to include signed URLs for audio playback
 * @param attempts - Array of attempts (with audio_url as storage path)
 * @param expiresIn - Time in seconds until URLs expire (default: 3600 = 1 hour)
 * @returns Attempts with audio_signed_url field populated for playback
 *
 * CRITICAL: Never cache signed URLs - they expire after 1 hour
 * Always call this function fresh when displaying attempts
 *
 * @example
 * // Manual usage (not recommended - use hooks instead):
 * const attempts = await getAttempts(childId);
 * const attemptsWithAudio = await getAttemptsWithSignedUrls(attempts);
 *
 * // Play audio in component:
 * {attemptsWithAudio.map(attempt => (
 *   <div key={attempt.id}>
 *     {attempt.audio_signed_url && (
 *       <audio src={attempt.audio_signed_url} controls />
 *     )}
 *   </div>
 * ))}
 *
 * @example
 * // Recommended: Use React Query hooks (auto-generates signed URLs):
 * const { data: attempts } = useAttempts(childId);
 *
 * // attempts now includes audio_signed_url field for each attempt
 * {attempts?.map(attempt => (
 *   <div key={attempt.id}>
 *     {attempt.audio_signed_url && (
 *       <audio src={attempt.audio_signed_url} controls />
 *     )}
 *   </div>
 * ))}
 */
export async function getAttemptsWithSignedUrls(
  attempts: Attempt[],
  expiresIn = 3600
): Promise<AttemptWithSignedAudio[]> {
  // Extract unique audio paths that need signed URLs
  const audioPaths = attempts
    .map((a) => a.audio_url)
    .filter((path): path is string => Boolean(path?.length));

  if (audioPaths.length === 0) {
    // No audio to sign, return attempts as-is with null signed URLs
    return attempts.map((attempt) => ({
      ...attempt,
      audio_signed_url: null,
    }));
  }

  // Batch generate signed URLs
  const signedUrlMap = await getSignedAudioUrls(audioPaths, expiresIn);

  // Map signed URLs back to attempts
  return attempts.map((attempt) => ({
    ...attempt,
    audio_signed_url: attempt.audio_url
      ? signedUrlMap[attempt.audio_url]
      : null,
  }));
}

// ============================================
// SRS Functions
// ============================================

/**
 * Get or create an SRS entry for a word
 */
export async function getSrsEntry(
  childId: string,
  wordId: string
): Promise<SrsEntry | null> {
  const { data, error } = await supabase
    .from("srs")
    .select("*")
    .eq("child_id", childId)
    .eq("word_id", wordId)
    .maybeSingle();

  if (error) {
    logger.error("Error fetching SRS entry:", error);
    return null;
  }

  return data;
}

/**
 * Upsert an SRS entry (insert or update)
 */
export async function upsertSrsEntry(
  entry: SrsInsert | (SrsUpdate & { child_id: string; word_id: string })
): Promise<SrsEntry | null> {
  const { data, error } = await supabase
    .from("srs")
    .upsert(
      {
        ...entry,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "child_id,word_id",
      }
    )
    .select()
    .single();

  if (error) {
    logger.error("Error upserting SRS entry:", error);
    return null;
  }

  return data;
}

/**
 * Update SRS after an attempt
 * @param childId - The child's ID
 * @param wordId - The word ID
 * @param isCorrectFirstTry - Whether the attempt was correct on first try
 */
export async function updateSrsAfterAttempt(
  childId: string,
  wordId: string,
  isCorrectFirstTry: boolean
): Promise<SrsEntry | null> {
  // Get current entry
  const currentEntry = await getSrsEntry(childId, wordId);

  // Calculate new values
  const updates = prepareSrsUpdate(
    isCorrectFirstTry,
    currentEntry || undefined
  );

  // Upsert with new values
  return upsertSrsEntry({
    child_id: childId,
    word_id: wordId,
    ...updates,
  });
}

/**
 * Get all words due today for a child
 */
export async function getDueWords(childId: string): Promise<
  Array<
    SrsEntry & {
      word: Word;
      lists: Array<{ id: string; title: string }>;
    }
  >
> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("srs")
    .select("*, words (*)")
    .eq("child_id", childId)
    .lte("due_date", today)
    .order("due_date", { ascending: true });

  if (error) {
    logger.error("Error fetching due words:", error);
    return [];
  }

  if (!data) return [];

  // For each word, get the lists it belongs to
  const wordsWithLists = await Promise.all(
    data.map(async (entry) => {
      const word = entry.words as unknown as Word;

      // Get lists containing this word
      const { data: listData } = await supabase
        .from("list_words")
        .select("word_lists (id, title)")
        .eq("word_id", word.id);

      const lists =
        listData?.map((lw) => {
          const list = lw.word_lists as unknown as {
            id: string;
            title: string;
          };
          return list;
        }) || [];

      return {
        ...(entry as SrsEntry),
        word,
        lists,
      };
    })
  );

  // Generate signed URLs for prompt audio paths
  const pathsToSign = wordsWithLists
    .filter(
      (
        entry
      ): entry is typeof entry & { word: { prompt_audio_path: string } } =>
        Boolean(entry.word.prompt_audio_path)
    )
    .map((entry) => entry.word.prompt_audio_path);

  const signedUrlMap =
    pathsToSign.length > 0 ? await getSignedPromptAudioUrls(pathsToSign) : {};

  // Add signed URLs to words
  const wordsWithSignedUrls = wordsWithLists.map((entry) => {
    if (
      entry.word.prompt_audio_path &&
      signedUrlMap[entry.word.prompt_audio_path]
    ) {
      return {
        ...entry,
        word: {
          ...entry.word,
          prompt_audio_url: signedUrlMap[entry.word.prompt_audio_path],
        },
      };
    }
    return entry;
  });

  return wordsWithSignedUrls;
}

const DEFAULT_LIMIT = 10;

/**
 * Get hardest words (lowest ease) for reporting
 */
export async function getHardestWords(
  childId?: string,
  limit?: number
): Promise<
  Array<
    SrsEntry & {
      word: Word;
    }
  >
> {
  if (!childId) return [];

  const resultLimit = limit ?? DEFAULT_LIMIT;
  const { data, error } = await supabase
    .from("srs")
    .select("*, words (*)")
    .eq("child_id", childId)
    .order("ease", { ascending: true })
    .order("lapses", { ascending: false })
    .limit(resultLimit);

  if (error) {
    logger.error("Error fetching hardest words:", error);
    return [];
  }

  const entries = (data || []).map((entry) => ({
    ...(entry as SrsEntry),
    word: entry.words as unknown as Word,
  }));

  // Generate signed URLs for prompt audio paths
  const pathsToSign = entries
    .filter(
      (
        entry
      ): entry is typeof entry & { word: { prompt_audio_path: string } } =>
        Boolean(entry.word.prompt_audio_path)
    )
    .map((entry) => entry.word.prompt_audio_path);

  const signedUrlMap =
    pathsToSign.length > 0 ? await getSignedPromptAudioUrls(pathsToSign) : {};

  // Add signed URLs to words
  return entries.map((entry) => {
    if (
      entry.word.prompt_audio_path &&
      signedUrlMap[entry.word.prompt_audio_path]
    ) {
      return {
        ...entry,
        word: {
          ...entry.word,
          prompt_audio_url: signedUrlMap[entry.word.prompt_audio_path],
        },
      };
    }
    return entry;
  });
}

/**
 * Get words with most lapses for reporting
 */
export async function getMostLapsedWords(
  childId?: string,
  limit?: number
): Promise<
  Array<
    SrsEntry & {
      word: Word;
    }
  >
> {
  if (!childId) return [];

  const resultLimit = limit ?? DEFAULT_LIMIT;
  const { data, error } = await supabase
    .from("srs")
    .select("*, words (*)")
    .eq("child_id", childId)
    .order("lapses", { ascending: false })
    .order("ease", { ascending: true })
    .limit(resultLimit);

  if (error) {
    logger.error("Error fetching most lapsed words:", error);
    return [];
  }

  const entries = (data || []).map((entry) => ({
    ...(entry as SrsEntry),
    word: entry.words as unknown as Word,
  }));

  // Generate signed URLs for prompt audio paths
  const pathsToSign = entries
    .filter(
      (
        entry
      ): entry is typeof entry & { word: { prompt_audio_path: string } } =>
        Boolean(entry.word.prompt_audio_path)
    )
    .map((entry) => entry.word.prompt_audio_path);

  const signedUrlMap =
    pathsToSign.length > 0 ? await getSignedPromptAudioUrls(pathsToSign) : {};

  // Add signed URLs to words
  return entries.map((entry) => {
    if (
      entry.word.prompt_audio_path &&
      signedUrlMap[entry.word.prompt_audio_path]
    ) {
      return {
        ...entry,
        word: {
          ...entry.word,
          prompt_audio_url: signedUrlMap[entry.word.prompt_audio_path],
        },
      };
    }
    return entry;
  });
}

// ============================================
// React Query Hooks
// ============================================

/**
 * Hook to fetch all word lists with word counts
 */
export function useWordLists(userId?: string) {
  return useQuery({
    queryKey: userId
      ? queryKeys.wordLists.byUser(userId)
      : queryKeys.wordLists.all,
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("word_lists")
        .select("*, list_words!inner(count)")
        .eq("created_by", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Transform to include word count
      // Supabase returns count as [{ count: N }], extract the count value
      return (data || []).map((list) => {
        const listWords = list.list_words as unknown;
        let wordCount = 0;

        if (Array.isArray(listWords) && listWords.length > 0) {
          // Supabase count aggregation returns [{ count: N }]
          const countObj = listWords[0] as { count?: number };
          wordCount = countObj?.count || 0;
        }

        return {
          ...list,
          word_count: wordCount,
          words: [], // Will be populated when fetching individual list
        };
      }) as WordListWithWords[];
    },
    enabled: Boolean(userId),
  });
}

/**
 * Hook to fetch a single word list with all its words
 */
export function useWordList(listId?: string) {
  return useQuery({
    queryKey: listId
      ? queryKeys.wordLists.detail(listId)
      : queryKeys.wordLists.all,
    queryFn: async () => {
      if (!listId) return null;
      return getListWithWords(listId);
    },
    enabled: Boolean(listId),
  });
}

/**
 * Hook to create a new word list
 */
export function useCreateWordList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (list: WordListInsert) => {
      const { data, error } = await supabase
        .from("word_lists")
        .insert(list)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.wordLists.byUser(variables.created_by),
      });
    },
  });
}

/**
 * Hook to update a word list
 */
export function useUpdateWordList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: WordListUpdate;
    }) => {
      const { data, error } = await supabase
        .from("word_lists")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      invalidateWordListQueries(queryClient, data.id, data.created_by);
    },
  });
}

/**
 * Hook to delete a word list
 */
export function useDeleteWordList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      userId: _userId,
    }: {
      id: string;
      userId: string;
    }) => {
      // First delete all list_words entries
      const { error: listWordsError } = await supabase
        .from("list_words")
        .delete()
        .eq("list_id", id);

      if (listWordsError) throw listWordsError;

      // Then delete the list
      const { error } = await supabase.from("word_lists").delete().eq("id", id);

      if (error) throw error;
      return id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.wordLists.byUser(variables.userId),
      });
    },
  });
}

/**
 * Hook to duplicate a word list
 */
export function useDuplicateWordList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listId,
      userId,
    }: {
      listId: string;
      userId: string;
    }) => {
      // Get the original list with words
      const original = await getListWithWords(listId);
      if (!original) throw new Error("List not found");

      // Create new list
      const { data: newList, error: listError } = await supabase
        .from("word_lists")
        .insert({
          title: `${original.title} (Copy)`,
          week_start_date: original.week_start_date,
          created_by: userId,
        })
        .select()
        .single();

      if (listError) throw listError;

      // Copy words and list_words
      if (original.words.length > 0) {
        const listWordsInserts = original.words.map((word) => ({
          list_id: newList.id,
          word_id: word.id,
          sort_index: word.sort_index,
        }));

        const { error: listWordsError } = await supabase
          .from("list_words")
          .insert(listWordsInserts);

        if (listWordsError) throw listWordsError;
      }

      return newList;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.wordLists.byUser(variables.userId),
      });
    },
  });
}

/**
 * Hook to create a new word
 */
export function useCreateWord() {
  return useMutation({
    mutationFn: async (word: WordInsert) => {
      const { data, error } = await supabase
        .from("words")
        .insert(word)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  });
}

/**
 * Hook to update a word
 */
export function useUpdateWord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: WordUpdate;
    }) => {
      const { data, error } = await supabase
        .from("words")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate all word lists since we don't know which list this word belongs to
      queryClient.invalidateQueries({
        queryKey: queryKeys.wordLists.all,
        exact: false,
      });
    },
  });
}

/**
 * Hook to delete a word from a list
 */
export function useDeleteWordFromList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listId,
      wordId,
    }: {
      listId: string;
      wordId: string;
    }) => {
      const { error } = await supabase
        .from("list_words")
        .delete()
        .eq("list_id", listId)
        .eq("word_id", wordId);

      if (error) throw error;
      return { listId, wordId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.wordLists.detail(data.listId),
      });
    },
  });
}

/**
 * Hook to bulk delete multiple words from a list
 */
export function useBulkDeleteWords() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listId,
      wordIds,
    }: {
      listId: string;
      wordIds: string[];
    }) => {
      const { error } = await supabase
        .from("list_words")
        .delete()
        .eq("list_id", listId)
        .in("word_id", wordIds);

      if (error) throw error;
      return { listId, wordIds };
    },
    onMutate: async ({ listId, wordIds }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.wordLists.detail(listId),
      });

      // Snapshot previous value
      const previous = queryClient.getQueryData<WordListWithWords>(
        queryKeys.wordLists.detail(listId)
      );

      // Optimistically update cache
      queryClient.setQueryData<WordListWithWords>(
        queryKeys.wordLists.detail(listId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            words: old.words?.filter((w) => !wordIds.includes(w.id)) ?? [],
          };
        }
      );

      return { previous };
    },
    onError: (_err, { listId }, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.wordLists.detail(listId),
          context.previous
        );
      }
    },
    onSettled: (data) => {
      if (data) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.wordLists.detail(data.listId),
        });
      }
    },
  });
}

/**
 * Hook to reorder words in a list
 */
export function useReorderWords() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listId,
      updates,
    }: {
      listId: string;
      updates: Array<{ word_id: string; sort_index: number }>;
    }) => {
      // Update sort indices for all affected words
      const promises = updates.map(({ word_id, sort_index }) =>
        supabase
          .from("list_words")
          .update({ sort_index })
          .eq("list_id", listId)
          .eq("word_id", word_id)
      );

      const results = await Promise.all(promises);
      const errors = results.filter((r) => r.error);

      if (errors.length > 0) {
        throw errors[0].error;
      }

      return listId;
    },
    onMutate: async ({ listId, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.wordLists.detail(listId),
      });

      // Snapshot the previous value
      const previousList = queryClient.getQueryData<WordListWithWords>(
        queryKeys.wordLists.detail(listId)
      );

      // Optimistically update
      if (previousList) {
        const newWords = [...previousList.words];
        updates.forEach(({ word_id, sort_index }) => {
          const wordIndex = newWords.findIndex((w) => w.id === word_id);
          if (wordIndex !== -1) {
            newWords[wordIndex] = { ...newWords[wordIndex], sort_index };
          }
        });
        newWords.sort((a, b) => a.sort_index - b.sort_index);

        queryClient.setQueryData<WordListWithWords>(
          queryKeys.wordLists.detail(listId),
          {
            ...previousList,
            words: newWords,
          }
        );
      }

      return { previousList };
    },
    onError: (_err, { listId }, context) => {
      // Rollback on error
      if (context?.previousList) {
        queryClient.setQueryData(
          queryKeys.wordLists.detail(listId),
          context.previousList
        );
      }
    },
    onSettled: (data) => {
      if (data) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.wordLists.detail(data),
        });
      }
    },
  });
}

/**
 * Hook to add a word to a list
 */
export function useAddWordToList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listId,
      word,
      sortIndex,
    }: {
      listId: string;
      word: WordInsert;
      sortIndex: number;
    }) => {
      // Create the word first
      const { data: newWord, error: wordError } = await supabase
        .from("words")
        .insert(word)
        .select()
        .single();

      if (wordError) throw wordError;

      // Add to list
      const { data: listWord, error: listWordError } = await supabase
        .from("list_words")
        .insert({
          list_id: listId,
          word_id: newWord.id,
          sort_index: sortIndex,
        })
        .select()
        .single();

      if (listWordError) throw listWordError;

      return { word: newWord, listWord };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.wordLists.detail(variables.listId),
      });
    },
  });
}

/**
 * Hook to upload audio to Supabase Storage
 */
export function useUploadAudio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      listId,
      wordId,
    }: {
      file: Blob;
      listId: string;
      wordId: string;
    }) => {
      const fileName = `lists/${listId}/words/${wordId}.webm`;

      // Upload the file
      const { data, error } = await supabase.storage
        .from("word-audio")
        .upload(fileName, file, {
          contentType: "audio/webm",
          cacheControl: "3600",
          upsert: true,
        });

      if (error) throw error;

      // Store the storage path (not public URL) for signed URL generation
      // Format: lists/{listId}/words/{wordId}.webm
      const storagePath = data.path;

      // Update the word with the audio path
      const { error: updateError } = await supabase
        .from("words")
        .update({ prompt_audio_path: storagePath })
        .eq("id", wordId);

      if (updateError) throw updateError;

      return storagePath;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.wordLists.detail(variables.listId),
      });
    },
  });
}

/**
 * Hook to get due words for a child
 */
export function useDueWords(childId?: string) {
  return useQuery({
    queryKey: childId ? queryKeys.srs.dueWords(childId) : queryKeys.srs.all,
    queryFn: async () => {
      if (!childId) return [];
      return getDueWords(childId);
    },
    enabled: Boolean(childId),
  });
}

/**
 * Hook to get hardest words
 */
export function useHardestWords(childId?: string, limit?: number) {
  return useQuery({
    queryKey: childId
      ? queryKeys.srs.hardestWords(childId, limit || 10)
      : queryKeys.srs.all,
    queryFn: () => getHardestWords(childId, limit),
    enabled: Boolean(childId),
  });
}

/**
 * Hook to get most lapsed words
 */
export function useMostLapsedWords(childId?: string, limit?: number) {
  return useQuery({
    queryKey: childId
      ? queryKeys.srs.mostLapsedWords(childId, limit || 10)
      : queryKeys.srs.all,
    queryFn: () => getMostLapsedWords(childId, limit),
    enabled: Boolean(childId),
  });
}

/**
 * Hook to update SRS after an attempt
 */
export function useUpdateSrs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      childId,
      wordId,
      isCorrectFirstTry,
    }: {
      childId: string;
      wordId: string;
      isCorrectFirstTry: boolean;
    }) => {
      return updateSrsAfterAttempt(childId, wordId, isCorrectFirstTry);
    },
    onSuccess: (_, variables) => {
      // Invalidate all SRS-related queries for this child
      invalidateSrsQueries(queryClient, variables.childId);
    },
  });
}

// ============================================================================
// ATTEMPTS & AUDIO PLAYBACK
// ============================================================================

/**
 * Hook to get all attempts for a child with signed audio URLs for playback
 * IMPORTANT: This automatically generates fresh signed URLs (1hr TTL) for audio playback
 * Never cache the returned audio_signed_url - always refetch when needed
 */
export function useAttempts(childId?: string) {
  return useQuery({
    queryKey: childId
      ? queryKeys.attempts.byChild(childId)
      : queryKeys.attempts.all,
    queryFn: async () => {
      if (!childId) return [];
      const attempts = await getAttempts(childId);
      return getAttemptsWithSignedUrls(attempts);
    },
    enabled: Boolean(childId),
    staleTime: 0, // Always fetch fresh to avoid expired signed URLs
    gcTime: 1000 * 60 * 30, // Cache for 30 min (well within 1hr signed URL TTL)
  });
}

/**
 * Hook to get attempts for a specific word with signed audio URLs for playback
 * IMPORTANT: This automatically generates fresh signed URLs (1hr TTL) for audio playback
 * Never cache the returned audio_signed_url - always refetch when needed
 */
export function useAttemptsForWord(childId?: string, wordId?: string) {
  return useQuery({
    queryKey:
      childId && wordId
        ? queryKeys.attempts.byChildAndWord(childId, wordId)
        : queryKeys.attempts.all,
    queryFn: async () => {
      if (!childId || !wordId) return [];
      const attempts = await getAttemptsForWord(childId, wordId);
      return getAttemptsWithSignedUrls(attempts);
    },
    enabled: Boolean(childId && wordId),
    staleTime: 0, // Always fetch fresh to avoid expired signed URLs
    gcTime: 1000 * 60 * 30, // Cache for 30 min (well within 1hr signed URL TTL)
  });
}

// ============================================================================
// PARENT ANALYTICS & DASHBOARD
// ============================================================================

/**
 * Get comprehensive parent overview analytics
 */
export async function getParentOverview(
  parentId: string,
  dateFrom?: Date,
  dateTo?: Date
) {
  const { data, error } = await supabase.rpc("get_parent_overview", {
    p_parent_id: parentId,
    p_date_from: dateFrom?.toISOString().split("T")[0],
    p_date_to: dateTo?.toISOString().split("T")[0],
  });

  if (error) throw error;
  return data;
}

/**
 * Hook to get parent overview analytics
 */
export function useParentOverview(
  parentId?: string,
  dateFrom?: Date,
  dateTo?: Date
) {
  return useQuery({
    queryKey: parentId
      ? queryKeys.analytics.parentOverview(parentId, dateFrom, dateTo)
      : queryKeys.analytics.all,
    queryFn: () => {
      if (!parentId) throw new Error("parentId is required");
      return getParentOverview(parentId, dateFrom, dateTo);
    },
    enabled: Boolean(parentId),
    staleTime: 1000 * 60, // Cache for 1 minute
  });
}

/**
 * Get child mastery data
 */
export async function getChildMastery(childId: string) {
  const { data, error } = await supabase
    .from("view_child_mastery")
    .select("*")
    .eq("child_id", childId);

  if (error) throw error;
  return data;
}

/**
 * Hook to get child mastery data
 */
export function useChildMastery(childId?: string) {
  return useQuery({
    queryKey: childId
      ? queryKeys.analytics.childMastery(childId)
      : queryKeys.analytics.all,
    queryFn: () => {
      if (!childId) throw new Error("childId is required");
      return getChildMastery(childId);
    },
    enabled: Boolean(childId),
  });
}

/**
 * Get n-gram error patterns
 */
export async function getNgramErrors(childId: string, limit = 10) {
  const { data, error } = await supabase
    .from("view_ngram_errors")
    .select("*")
    .eq("child_id", childId)
    .order("error_count", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

/**
 * Hook to get n-gram error patterns
 */
export function useNgramErrors(childId?: string, limit = 10) {
  return useQuery({
    queryKey: childId
      ? queryKeys.analytics.ngramErrors(childId, limit)
      : queryKeys.analytics.all,
    queryFn: () => {
      if (!childId) throw new Error("childId is required");
      return getNgramErrors(childId, limit);
    },
    enabled: Boolean(childId),
  });
}

/**
 * Get all children for a parent
 */
export async function getChildrenForParent(parentId: string) {
  const { data, error } = await supabase.rpc("get_children_for_parent", {
    p_parent_id: parentId,
  });

  if (error) throw error;
  return data;
}

/**
 * Hook to get all children for a parent
 */
export function useChildrenForParent(parentId?: string) {
  return useQuery({
    queryKey: parentId
      ? queryKeys.children.byParent(parentId)
      : queryKeys.children.all,
    queryFn: () => {
      if (!parentId) throw new Error("parentId is required");
      return getChildrenForParent(parentId);
    },
    enabled: Boolean(parentId),
  });
}

// ============================================================================
// D3: SPACED REPETITION SCHEDULER
// ============================================================================

export interface NextBatchWord {
  word_id: string;
  word_text: string;
  word_phonetic: string | null;
  word_prompt_audio_path: string | null;
  word_tts_voice: string | null;
  due_date: string;
  ease: number;
  interval_days: number;
  reps: number;
  lapses: number;
  batch_type: "due" | "leech" | "review" | "new";
}

/**
 * Get next practice batch using smart scheduler
 * Includes: due words + 20% leeches + 10% near-future review
 */
export async function getNextBatch(
  childId: string,
  listId?: string,
  limit = 15,
  strictMode = false
): Promise<NextBatchWord[]> {
  const { data, error } = await supabase.rpc(
    "get_next_batch" as unknown as "fn_add_stars",
    {
      p_child_id: childId,
      p_list_id: listId || null,
      p_limit: limit,
      p_strict_mode: strictMode,
    } as unknown as { p_child: string; p_amount: number }
  );

  if (error) {
    logger.error("Error fetching next batch:", error);
    return [];
  }

  // Generate signed URLs for prompt audio paths
  const wordsWithPaths = (data as unknown as NextBatchWord[]) || [];
  const pathsToSign = wordsWithPaths
    .filter((word) => Boolean(word.word_prompt_audio_path))
    .map((word) => word.word_prompt_audio_path as string);

  const signedUrlMap =
    pathsToSign.length > 0 ? await getSignedPromptAudioUrls(pathsToSign) : {};

  // Replace paths with signed URLs
  return wordsWithPaths.map((word) => {
    if (
      word.word_prompt_audio_path &&
      signedUrlMap[word.word_prompt_audio_path]
    ) {
      const signedUrl = signedUrlMap[word.word_prompt_audio_path];
      if (signedUrl) {
        return {
          ...word,
          word_prompt_audio_path: signedUrl,
        };
      }
    }
    return word;
  });
}

/**
 * Hook to get next practice batch
 */
export function useNextBatch(
  childId?: string,
  listId?: string,
  limit = 15,
  strictMode = false
) {
  return useQuery({
    queryKey: childId
      ? queryKeys.srs.nextBatch(childId, listId, limit, strictMode)
      : queryKeys.srs.all,
    queryFn: () => {
      if (!childId) throw new Error("childId is required");
      return getNextBatch(childId, listId, limit, strictMode);
    },
    enabled: Boolean(childId),
    staleTime: 1000 * 10, // Cache for 10 seconds (practice changes frequently)
  });
}

/**
 * Compute quality score from attempt result
 * Used for tracking attempt quality in the SRS system
 */
export function computeAttemptQuality(
  correct: boolean,
  isFirstTry: boolean,
  usedHint = false
): number {
  if (!correct) return 1; // Wrong answer
  if (isFirstTry) {
    return usedHint ? 3 : 5; // Correct after hint or perfect
  }
  return 2; // Wrong then correct (second try)
}

// ============================================================================
// D4: REWARDS SHOP & AVATARS
// ============================================================================

export interface RewardsCatalogItem {
  id: string;
  name: string;
  description: string | null;
  cost_stars: number;
  icon: string;
  type: "avatar" | "theme" | "coupon" | "badge";
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserReward {
  id: string;
  user_id: string;
  reward_id: string;
  acquired_at: string;
  equipped: boolean;
  reward?: RewardsCatalogItem; // Joined data
}

/**
 * Get rewards catalog (active items only)
 */
export async function getRewardsCatalog(
  type?: "avatar" | "theme" | "coupon" | "badge"
): Promise<RewardsCatalogItem[]> {
  let query = supabase
    .from("rewards_catalog" as unknown as "profiles")
    .select("*")
    .eq("is_active", true)
    .order("cost_stars", { ascending: true });

  if (type) {
    query = query.eq("type", type);
  }

  const { data, error } = await query;

  if (error) {
    logger.error("Error fetching rewards catalog:", error);
    return [];
  }

  return (data as unknown as RewardsCatalogItem[]) || [];
}

/**
 * Hook to get rewards catalog
 */
export function useRewardsCatalog(
  type?: "avatar" | "theme" | "coupon" | "badge"
) {
  return useQuery({
    queryKey: queryKeys.rewards.catalog(type),
    queryFn: () => getRewardsCatalog(type),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

/**
 * Get user's owned rewards
 */
export async function getUserRewards(userId: string): Promise<UserReward[]> {
  const { data, error } = await supabase
    .from("user_rewards" as unknown as "profiles")
    .select("*, reward:rewards_catalog (*)")
    .eq("user_id", userId)
    .order("acquired_at", { ascending: false });

  if (error) {
    logger.error("Error fetching user rewards:", error);
    return [];
  }

  return (data as unknown as UserReward[]) || [];
}

/**
 * Hook to get user's owned rewards
 */
export function useUserRewards(userId?: string) {
  return useQuery({
    queryKey: userId
      ? queryKeys.rewards.userRewards(userId)
      : queryKeys.rewards.all,
    queryFn: () => {
      if (!userId) throw new Error("userId is required");
      return getUserRewards(userId);
    },
    enabled: Boolean(userId),
  });
}

/**
 * Purchase a reward
 */
export async function purchaseReward(userId: string, rewardId: string) {
  const { data, error } = await supabase.rpc(
    "purchase_reward" as unknown as "fn_add_stars",
    {
      p_user_id: userId,
      p_reward_id: rewardId,
    } as unknown as { p_child: string; p_amount: number }
  );

  if (error) throw error;

  const result = data as unknown as {
    success: boolean;
    error?: string;
    reward_name?: string;
    reward_type?: string;
    cost?: number;
    remaining_stars?: number;
    required?: number;
    available?: number;
  };

  if (!result.success) {
    throw new Error(result.error || "Failed to purchase reward");
  }

  return result;
}

/**
 * Hook to purchase a reward
 */
export function usePurchaseReward() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, rewardId }: { userId: string; rewardId: string }) =>
      purchaseReward(userId, rewardId),
    onSuccess: (_, { userId }) => {
      // Invalidate relevant queries
      invalidateProfileQueries(queryClient, userId);
    },
  });
}

/**
 * Equip a reward (avatar or theme)
 */
export async function equipReward(userId: string, rewardId: string) {
  const { data, error } = await supabase.rpc(
    "equip_reward" as unknown as "fn_add_stars",
    {
      p_user_id: userId,
      p_reward_id: rewardId,
    } as unknown as { p_child: string; p_amount: number }
  );

  if (error) throw error;

  const result = data as unknown as {
    success: boolean;
    error?: string;
    reward_type?: string;
    equipped?: string;
  };

  if (!result.success) {
    throw new Error(result.error || "Failed to equip reward");
  }

  return result;
}

/**
 * Hook to equip a reward
 */
export function useEquipReward() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, rewardId }: { userId: string; rewardId: string }) =>
      equipReward(userId, rewardId),
    onSuccess: (_, { userId }) => {
      // Invalidate relevant queries
      invalidateProfileQueries(queryClient, userId);
    },
  });
}

/**
 * Award stars to a user
 */
export async function awardStars(
  userId: string,
  amount: number,
  reason = "practice"
): Promise<number> {
  const { data, error } = await supabase.rpc(
    "award_stars" as unknown as "fn_add_stars",
    {
      p_user_id: userId,
      p_amount: amount,
      p_reason: reason,
    } as unknown as { p_child: string; p_amount: number }
  );

  if (error) throw error;
  return data as number; // Returns new total
}

/**
 * Hook to award stars
 */
export function useAwardStars() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      amount,
      reason,
    }: {
      userId: string;
      amount: number;
      reason?: string;
    }) => awardStars(userId, amount, reason),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.profiles.detail(userId),
      });
    },
  });
}

/**
 * Update daily streak
 */
export async function updateDailyStreak(userId: string) {
  const { data, error } = await supabase.rpc(
    "update_daily_streak" as unknown as "fn_add_stars",
    {
      p_user_id: userId,
    } as unknown as { p_child: string; p_amount: number }
  );

  if (error) throw error;

  return data as unknown as {
    streak_days: number;
    bonus_stars: number;
    continued: boolean;
  };
}

/**
 * Hook to update daily streak
 */
export function useUpdateDailyStreak() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => updateDailyStreak(userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.profiles.detail(userId),
      });
    },
  });
}

/**
 * Update child profile (for parents editing their children's profiles)
 */
export async function updateChildProfile(
  childId: string,
  updates: {
    display_name?: string;
    age?: number | null;
    birthday?: string | null;
    equipped_avatar?: string | null;
    favorite_color?: string | null;
  }
) {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", childId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Hook to update child profile
 */
export function useUpdateChildProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      childId,
      updates,
    }: {
      childId: string;
      updates: {
        display_name?: string;
        age?: number | null;
        birthday?: string | null;
        equipped_avatar?: string | null;
        favorite_color?: string | null;
      };
    }) => updateChildProfile(childId, updates),
    onSuccess: (_, { childId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.children.all,
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.profiles.detail(childId),
      });
    },
  });
}
