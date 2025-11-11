import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";
import { logger } from "@/lib/logger";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Check if Supabase environment variables are configured
 */
export function hasSupabaseConfig(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/**
 * Get details about missing Supabase configuration
 */
export function getSupabaseConfigErrors(): string[] {
  const errors: string[] = [];

  if (!supabaseUrl) {
    errors.push("VITE_SUPABASE_URL is not set");
  }

  if (!supabaseAnonKey) {
    errors.push("VITE_SUPABASE_ANON_KEY is not set");
  }

  return errors;
}

// Only create client if environment variables are present
let supabaseClient: ReturnType<typeof createClient<Database>> | null = null;

if (!supabaseUrl || !supabaseAnonKey) {
  const isDev = import.meta.env.DEV;
  const missingVars = getSupabaseConfigErrors();

  logger.error(
    "Missing Supabase environment variables. App will not function without proper configuration.",
    { missingVars, isDev }
  );

  // In development, throw immediately to catch issues early
  // In production, we'll handle this in the app component
  if (isDev) {
    throw new Error(
      `Missing required Supabase environment variables:\n${missingVars.join("\n")}\n\n` +
        `Please create a .env file with:\n` +
        `VITE_SUPABASE_URL=your_supabase_url\n` +
        `VITE_SUPABASE_ANON_KEY=your_supabase_anon_key\n\n` +
        `Or use Doppler: doppler run -- npm run dev\n` +
        `See docs/DEPLOYMENT.md for setup instructions.`
    );
  }
} else {
  supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
}

/**
 * Supabase client instance.
 * Will be null if environment variables are not configured.
 *
 * @throws {Error} In development if env vars are missing (fails fast)
 * @returns {null} In production if env vars are missing (graceful degradation)
 */
export const supabase = supabaseClient!;

// Export type helpers for easier usage
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export type WordList = Database["public"]["Tables"]["word_lists"]["Row"];
export type WordListInsert =
  Database["public"]["Tables"]["word_lists"]["Insert"];
export type WordListUpdate =
  Database["public"]["Tables"]["word_lists"]["Update"];

export type Word = Database["public"]["Tables"]["words"]["Row"];
export type WordInsert = Database["public"]["Tables"]["words"]["Insert"];
export type WordUpdate = Database["public"]["Tables"]["words"]["Update"];

export type ListWord = Database["public"]["Tables"]["list_words"]["Row"];
export type ListWordInsert =
  Database["public"]["Tables"]["list_words"]["Insert"];
export type ListWordUpdate =
  Database["public"]["Tables"]["list_words"]["Update"];

export type Attempt = Database["public"]["Tables"]["attempts"]["Row"];
export type AttemptInsert = Database["public"]["Tables"]["attempts"]["Insert"];
export type AttemptUpdate = Database["public"]["Tables"]["attempts"]["Update"];

export type Reward = Database["public"]["Tables"]["rewards"]["Row"];
export type RewardInsert = Database["public"]["Tables"]["rewards"]["Insert"];
export type RewardUpdate = Database["public"]["Tables"]["rewards"]["Update"];
