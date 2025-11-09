/**
 * Supabase API client with typed helpers
 * Provides convenient functions for common database operations
 */

import { supabase } from "../supabase";
import type { Database } from "../../types/database.types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
    console.error("Error fetching profile:", error);
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
    console.error("Error fetching lists:", error);
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
    console.error("Error fetching list:", listError);
    return null;
  }

  // Then, get the words with their sort indices
  const { data: listWords, error: wordsError } = await supabase
    .from("list_words")
    .select(
      `
      sort_index,
      words (*)
    `
    )
    .eq("list_id", listId)
    .order("sort_index", { ascending: true });

  if (wordsError) {
    console.error("Error fetching words:", wordsError);
    return { ...list, words: [] };
  }

  // Transform the data to flatten the structure
  const words =
    listWords?.map((lw) => ({
      ...(lw.words as Word),
      sort_index: lw.sort_index,
    })) || [];

  return {
    ...list,
    words,
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
      console.error("Error updating list:", error);
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
      console.error("Error creating list:", error);
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
    console.error("Error inserting attempt:", error);
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
    console.error("User not authenticated");
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
    console.error("Error uploading audio:", error);
    return null;
  }

  // Get the public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from("audio-recordings").getPublicUrl(data.path);

  return publicUrl;
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
    console.error("Error fetching rewards:", error);
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
    console.error("Error adding stars:", error);
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
    console.error("Error creating word:", error);
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
    console.error("Error adding word to list:", error);
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
    console.error("Error removing word from list:", error);
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
    console.error("Error fetching attempts:", error);
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
    console.error("Error fetching attempts for word:", error);
    return [];
  }

  return data || [];
}

// ============================================
// React Query Hooks
// ============================================

/**
 * Hook to fetch all word lists with word counts
 */
export function useWordLists(userId?: string) {
  return useQuery({
    queryKey: ["word_lists", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("word_lists")
        .select(
          `
          *,
          list_words (count)
        `
        )
        .eq("created_by", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Transform to include word count
      return (data || []).map((list) => ({
        ...list,
        word_count: Array.isArray(list.list_words)
          ? list.list_words.length
          : (list.list_words as { count?: number })?.count || 0,
        words: [], // Will be populated when fetching individual list
      })) as WordListWithWords[];
    },
    enabled: Boolean(userId),
  });
}

/**
 * Hook to fetch a single word list with all its words
 */
export function useWordList(listId?: string) {
  return useQuery({
    queryKey: ["word_list", listId],
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
        queryKey: ["word_lists", variables.created_by],
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
      queryClient.invalidateQueries({ queryKey: ["word_list", data.id] });
      queryClient.invalidateQueries({
        queryKey: ["word_lists", data.created_by],
      });
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
        queryKey: ["word_lists", variables.userId],
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
        queryKey: ["word_lists", variables.userId],
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
      queryClient.invalidateQueries({ queryKey: ["word_list"] });
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
      queryClient.invalidateQueries({ queryKey: ["word_list", data.listId] });
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
      await queryClient.cancelQueries({ queryKey: ["word_list", listId] });

      // Snapshot the previous value
      const previousList = queryClient.getQueryData<WordListWithWords>([
        "word_list",
        listId,
      ]);

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

        queryClient.setQueryData<WordListWithWords>(["word_list", listId], {
          ...previousList,
          words: newWords,
        });
      }

      return { previousList };
    },
    onError: (_err, { listId }, context) => {
      // Rollback on error
      if (context?.previousList) {
        queryClient.setQueryData(["word_list", listId], context.previousList);
      }
    },
    onSettled: (data) => {
      queryClient.invalidateQueries({ queryKey: ["word_list", data] });
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
        queryKey: ["word_list", variables.listId],
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

      // Get the public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("word-audio").getPublicUrl(data.path);

      // Update the word with the audio URL
      const { error: updateError } = await supabase
        .from("words")
        .update({ prompt_audio_url: publicUrl })
        .eq("id", wordId);

      if (updateError) throw updateError;

      return publicUrl;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["word_list", variables.listId],
      });
    },
  });
}
