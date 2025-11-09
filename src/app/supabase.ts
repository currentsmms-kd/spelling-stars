import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Export type helpers for easier usage
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export type SpellingList =
  Database["public"]["Tables"]["spelling_lists"]["Row"];
export type SpellingListInsert =
  Database["public"]["Tables"]["spelling_lists"]["Insert"];
export type SpellingListUpdate =
  Database["public"]["Tables"]["spelling_lists"]["Update"];

export type Word = Database["public"]["Tables"]["words"]["Row"];
export type WordInsert = Database["public"]["Tables"]["words"]["Insert"];
export type WordUpdate = Database["public"]["Tables"]["words"]["Update"];

export type Attempt = Database["public"]["Tables"]["attempts"]["Row"];
export type AttemptInsert = Database["public"]["Tables"]["attempts"]["Insert"];
export type AttemptUpdate = Database["public"]["Tables"]["attempts"]["Update"];
