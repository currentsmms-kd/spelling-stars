import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types (extend as needed)
export interface Profile {
  id: string;
  email: string;
  role: "parent" | "child";
  created_at: string;
  updated_at: string;
}

export interface SpellingList {
  id: string;
  parent_id: string;
  title: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Word {
  id: string;
  list_id: string;
  word: string;
  audio_url?: string;
  order: number;
  created_at: string;
}

export interface Attempt {
  id: string;
  child_id: string;
  word_id: string;
  list_id: string;
  is_correct: boolean;
  typed_answer?: string;
  audio_url?: string;
  created_at: string;
}
