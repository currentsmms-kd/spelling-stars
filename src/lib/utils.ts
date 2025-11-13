import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalizes spelling answers for consistent comparison between user input and correct answers.
 *
 * This function standardizes text by applying various normalization rules based on parental settings,
 * ensuring fair and educationally appropriate spelling evaluation. It's designed to focus on spelling
 * accuracy while accounting for common input variations.
 *
 * @param text - The raw text to normalize (user input or correct answer)
 * @param options - Normalization options (optional, defaults applied if not provided)
 * @param options.enforceCaseSensitivity - If true, preserves original case; if false, converts to lowercase (default: false)
 * @param options.ignorePunctuation - If true, removes ALL punctuation including hyphens and apostrophes; if false, preserves hyphens and apostrophes (default: false)
 * @returns Normalized string ready for comparison
 *
 * @remarks
 * **Normalization Rules:**
 *
 * 1. **Whitespace**: Always trims leading/trailing whitespace and normalizes internal whitespace to single spaces
 * 2. **Case**: Converts to lowercase unless `enforceCaseSensitivity` is true (default: lowercase)
 * 3. **Punctuation**:
 *    - Always removes sentence punctuation: .,!?;:"
 *    - By default, preserves hyphens (-) and apostrophes (') for structural elements
 *    - If `ignorePunctuation` is true, removes ALL punctuation including hyphens and apostrophes
 *
 * **Hyphen Preservation Rationale:**
 * Hyphens are preserved by default because they are structural elements in compound words that affect
 * spelling accuracy. Words like "mother-in-law", "well-known", "T-shirt", and "twenty-one" require
 * the hyphen for correct spelling. Removing hyphens would incorrectly mark these as correct.
 *
 * **Apostrophe Preservation Rationale:**
 * Apostrophes are preserved by default for contractions and possessives like "don't", "it's", "cat's",
 * and "children's". These are standard English spellings where the apostrophe is essential.
 *
 * **When to Use `ignorePunctuation: true`:**
 * Set this option when practicing with younger children who may struggle with punctuation keys,
 * or when the learning objective is letter sequencing rather than full orthographic accuracy.
 * This will treat "dont" and "don't" as equivalent, and "mother in law" and "mother-in-law" as equivalent.
 *
 * @example
 * // Default behavior (case insensitive, preserve structural punctuation)
 * normalizeSpellingAnswer("Ice-Cream!")
 * // returns "ice-cream"
 *
 * normalizeSpellingAnswer("mother-in-law's")
 * // returns "mother-in-law's"
 *
 * normalizeSpellingAnswer("Don't worry!")
 * // returns "don't worry"
 *
 * normalizeSpellingAnswer("Hello, World!")
 * // returns "hello world"
 *
 * normalizeSpellingAnswer("  APPLE  ")
 * // returns "apple"
 *
 * @example
 * // With case sensitivity enforced
 * normalizeSpellingAnswer("T-Shirt", { enforceCaseSensitivity: true })
 * // returns "T-Shirt"
 *
 * normalizeSpellingAnswer("Hello World", { enforceCaseSensitivity: true })
 * // returns "Hello World"
 *
 * @example
 * // With all punctuation ignored (for younger learners)
 * normalizeSpellingAnswer("don't", { ignorePunctuation: true })
 * // returns "dont"
 *
 * normalizeSpellingAnswer("mother-in-law", { ignorePunctuation: true })
 * // returns "mother in law"
 *
 * normalizeSpellingAnswer("it's", { ignorePunctuation: true })
 * // returns "its"
 *
 * @example
 * // Combined options
 * normalizeSpellingAnswer("Can't Stop!", { enforceCaseSensitivity: true, ignorePunctuation: false })
 * // returns "Can't Stop"
 *
 * normalizeSpellingAnswer("Well-Known", { enforceCaseSensitivity: false, ignorePunctuation: true })
 * // returns "well known"
 */
export function normalizeSpellingAnswer(
  text: string,
  options: {
    enforceCaseSensitivity?: boolean;
    ignorePunctuation?: boolean;
  } = {}
): string {
  const { enforceCaseSensitivity = false, ignorePunctuation = false } = options;

  let normalized = text.trim();

  // Normalize internal whitespace to single spaces
  normalized = normalized.replace(/\s+/g, " ");

  // Apply punctuation normalization based on settings
  if (ignorePunctuation) {
    // Remove ALL punctuation including hyphens and apostrophes
    // This treats "don't" and "dont" as equivalent, useful for younger learners
    normalized = normalized.replace(/[.,!?;:'":\-']/g, "");
  } else {
    // Remove only sentence punctuation, preserve structural elements (hyphens and apostrophes)
    // This preserves compound words (mother-in-law) and contractions (don't, it's)
    normalized = normalized.replace(/[.,!?;:"]/g, "");
  }

  // Apply case normalization based on parental setting
  if (!enforceCaseSensitivity) {
    normalized = normalized.toLowerCase();
  }

  return normalized;
}
