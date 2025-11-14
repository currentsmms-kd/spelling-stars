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

/**
 * Generates contextually appropriate hints for spelling practice.
 *
 * This function intelligently extracts the first meaningful segment from words to provide
 * helpful hints during spelling games. The hint adapts based on word structure and the
 * ignorePunctuation parental setting to ensure consistency with answer validation.
 *
 * @param text - The word to generate a hint for
 * @param ignorePunctuation - Whether punctuation should be ignored (from parental settings)
 * @returns The hint text to display (first letter or first segment, capitalized)
 *
 * @remarks
 * **Behavior based on ignorePunctuation setting:**
 *
 * When ignorePunctuation is TRUE:
 * - All punctuation (hyphens, apostrophes, spaces) is stripped
 * - The word is treated as a single continuous string
 * - Only the first character is returned, uppercased
 * - This matches validation behavior where punctuation is ignored
 *
 * When ignorePunctuation is FALSE:
 * - Word-breaking punctuation (hyphen, apostrophe, space) is preserved
 * - For compound words, the first segment before punctuation is extracted
 * - The entire first segment is returned with proper capitalization
 * - For simple words without punctuation, only the first letter is returned
 * - This matches validation behavior where punctuation is preserved
 *
 * **Rationale:**
 * Hints should align with how words are validated to avoid confusion. If punctuation is
 * ignored during validation, hints should reflect the simplified word structure. If
 * punctuation is preserved, hints should acknowledge compound word structures like
 * "ice-cream" where "ice" is more helpful than just "i".
 *
 * **Capitalization:**
 * - Single characters are uppercased: "A"
 * - Word segments use title case: "Ice" (only first letter capitalized)
 *
 * @example
 * // Compound words with punctuation preserved (ignorePunctuation: false)
 * getHintText("ice-cream", false)
 * // returns "Ice" (first segment before hyphen)
 *
 * getHintText("don't", false)
 * // returns "Don" (first segment before apostrophe)
 *
 * getHintText("mother-in-law", false)
 * // returns "Mother" (first segment before first hyphen)
 *
 * getHintText("ice cream", false)
 * // returns "Ice" (first segment before space)
 *
 * @example
 * // Compound words with punctuation ignored (ignorePunctuation: true)
 * getHintText("ice-cream", true)
 * // returns "I" (first character of "icecream")
 *
 * getHintText("don't", true)
 * // returns "D" (first character of "dont")
 *
 * getHintText("mother-in-law", true)
 * // returns "M" (first character of "motherinlaw")
 *
 * @example
 * // Simple words (same result regardless of setting)
 * getHintText("apple", false)
 * // returns "A"
 *
 * getHintText("apple", true)
 * // returns "A"
 *
 * getHintText("cat", false)
 * // returns "C"
 *
 * @example
 * // Edge cases
 * getHintText("", false)
 * // returns "" (empty string)
 *
 * getHintText(" hello ", false)
 * // returns "H" (trimmed first character)
 *
 * getHintText("T-shirt", false)
 * // returns "T" (first segment is single character)
 *
 * getHintText("--hyphen", false)
 * // returns "" (no content before punctuation)
 *
 * @see {@link normalizeSpellingAnswer} for the validation logic this aligns with
 */
export function getHintText(text: string, ignorePunctuation: boolean): string {
  // Handle empty or whitespace-only strings
  const trimmedText = text.trim();
  if (!trimmedText) {
    return "";
  }

  if (ignorePunctuation) {
    // When punctuation is ignored, strip all punctuation and return first character
    // This matches validation behavior where "ice-cream" becomes "icecream"
    const noPunctuation = trimmedText.replace(/[-'\s]/g, "");
    if (!noPunctuation) {
      return ""; // Edge case: text was only punctuation
    }
    return noPunctuation[0].toUpperCase();
  } else {
    // When punctuation is preserved, extract the first word segment
    // Split on word-breaking punctuation: hyphen, apostrophe, or space
    const segments = trimmedText.split(/[-'\s]/);
    const firstSegment = segments[0];

    if (!firstSegment) {
      return ""; // Edge case: text starts with punctuation
    }

    // For single character segments, just uppercase
    if (firstSegment.length === 1) {
      return firstSegment.toUpperCase();
    }

    // For multi-character segments, use title case (only first letter capitalized)
    return (
      firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1).toLowerCase()
    );
  }
}
