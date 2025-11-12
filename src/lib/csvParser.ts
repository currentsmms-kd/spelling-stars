/**
 * Minimal CSV parser that handles quoted fields and edge cases.
 * Handles:
 * - Quoted commas within fields: "hello, world" is one field
 * - Empty/whitespace-only rows
 * - Trailing/leading spaces around fields
 * - Different line endings (\n, \r\n)
 */

export interface ParsedCsvRow {
  text: string;
  phonetic?: string;
  tts_voice?: string;
}

/**
 * Parse a single CSV line respecting quoted fields.
 * Example: `"hello, world",phonetic,"voice name"` → ["hello, world", "phonetic", "voice name"]
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      // Handle escaped quotes: ""
      if (inQuotes && line[i + 1] === '"') {
        currentField += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(currentField.trim());
      currentField = "";
    } else {
      currentField += char;
    }
  }

  // Add the last field
  fields.push(currentField.trim());

  return fields;
}

/**
 * Remove leading/trailing quotes from a field if present.
 */
function unquoteField(field: string): string {
  if (field.startsWith('"') && field.endsWith('"')) {
    return field.slice(1, -1);
  }
  return field;
}

/**
 * Parse CSV text into word objects.
 * Handles:
 * - Different line endings (\n, \r\n)
 * - Optional header row (detected by looking for common header patterns)
 * - Empty/whitespace rows (skipped)
 * - Empty first columns (skipped as invalid entries)
 * - Multiple formats:
 *   - Single column: just word text
 *   - Three columns: word, phonetic, voice
 *
 * @param csvText Raw CSV text
 * @returns Array of parsed word objects
 */
export function parseCSV(csvText: string): ParsedCsvRow[] {
  // Split by line endings (\n or \r\n)
  const lines = csvText.split(/\r?\n/);
  const parsed: ParsedCsvRow[] = [];

  // Detect and skip header row
  let startIndex = 0;
  if (lines.length > 0) {
    const firstLine = lines[0].toLowerCase().trim();
    // Common header patterns
    if (
      firstLine === "word" ||
      firstLine === "words" ||
      firstLine === "text" ||
      firstLine.includes("word") ||
      firstLine.includes("phonetic") ||
      firstLine.includes("voice")
    ) {
      startIndex = 1;
    }
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty/whitespace-only rows
    if (!line) continue;

    // Parse the line respecting quoted fields
    const fields = parseCsvLine(line);

    // Skip if first column is empty after trimming
    const wordText = unquoteField(fields[0]).trim();
    if (!wordText) continue;

    // Parse based on column count
    if (fields.length === 1) {
      // Single column: just word text
      parsed.push({ text: wordText });
    } else if (fields.length >= 2) {
      // Multiple columns: word, phonetic, voice
      const phonetic = unquoteField(fields[1]).trim();
      const ttsVoice =
        fields.length > 2 ? unquoteField(fields[2]).trim() : undefined;

      parsed.push({
        text: wordText,
        phonetic: phonetic || undefined,
        tts_voice: ttsVoice || undefined,
      });
    }
  }

  return parsed;
}

/**
 * Normalize text for deduplication comparisons.
 * Lowercases and trims whitespace.
 */
export function normalizeForDedupe(text: string): string {
  return text.toLowerCase().trim();
}
