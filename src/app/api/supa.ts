/**
 * Supabase API client with typed helpers
 * Provides convenient functions for common database operations
 */

import { supabase } from "../supabase";
import type { Database } from "../../types/database.types";

// Type aliases for convenience
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type WordList = Database["public"]["Tables"]["word_lists"]["Row"];
type Word = Database["public"]["Tables"]["words"]["Row"];
type ListWord = Database["public"]["Tables"]["list_words"]["Row"];
type Attempt = Database["public"]["Tables"]["attempts"]["Row"];
type AttemptInsert = Database["public"]["Tables"]["attempts"]["Insert"];
type Reward = Database["public"]["Tables"]["rewards"]["Row"];

// Extended types for joined data
export interface WordListWithWords extends WordList {
  words: Array<Word & { sort_index: number }>;
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
