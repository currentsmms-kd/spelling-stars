# Moderate Issues - Agent Prompts

## Issue #11: Missing CSV Import Validation

### Prompt for Agent

````
TASK: Add comprehensive schema validation for CSV word list imports

CONTEXT:
Documentation mentions CSV import functionality for word lists, but there's no validation for file size, format, column structure, or malformed data. Users could import corrupted data causing runtime errors.

FINDINGS:
- `src/lib/csvParser.ts` exists but validation scope unknown
- No documented CSV format in docs or UI
- No max file size check before parsing
- No column validation (text, phonetic, tts_voice)
- No row count limit enforcement
- No special character sanitization

PROBLEM:
Users can import:
- Files larger than reasonable (>10MB)
- Wrong column formats
- Malformed CSV (missing quotes, wrong delimiters)
- Special characters causing injection
- Thousands of words crashing UI

IMPACT:
- DATA CORRUPTION: Invalid data enters database
- UX: Import appears successful but words don't work
- PERFORMANCE: Large imports freeze browser
- SECURITY: Potential injection attacks via CSV

RECOMMENDATION:
Add Zod schema validation and file size checks before CSV parsing.

FILES TO REVIEW:
- `src/lib/csvParser.ts` - CSV parsing logic
- `src/app/pages/parent/ListEditor.tsx` - Import UI
- `docs/CSV_PARSER_IMPLEMENTATION.md` - Implementation docs

IMPLEMENTATION STEPS:

**Step 1: Define CSV Schema with Zod**

```typescript
import { z } from 'zod';

// Maximum limits
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_WORDS_PER_IMPORT = 500;
const MAX_WORD_LENGTH = 100;
const MAX_PHONETIC_LENGTH = 200;

// Word entry schema
const WordEntrySchema = z.object({
  text: z
    .string()
    .min(1, 'Word text required')
    .max(MAX_WORD_LENGTH, `Word too long (max ${MAX_WORD_LENGTH} chars)`)
    .regex(/^[a-zA-Z\s'-]+$/, 'Word contains invalid characters'),

  phonetic: z
    .string()
    .max(MAX_PHONETIC_LENGTH)
    .optional()
    .or(z.literal('')),

  tts_voice: z
    .string()
    .regex(/^(en-US|en-GB|en-AU|en-IN|)$/, 'Invalid TTS voice')
    .optional()
    .or(z.literal('')),
});

// CSV file schema
const CSVImportSchema = z.object({
  words: z
    .array(WordEntrySchema)
    .min(1, 'CSV must contain at least one word')
    .max(MAX_WORDS_PER_IMPORT, `Maximum ${MAX_WORDS_PER_IMPORT} words per import`),
});

export type WordEntry = z.infer<typeof WordEntrySchema>;
export type CSVImport = z.infer<typeof CSVImportSchema>;
````

**Step 2: Add File Size Validation**

```typescript
export async function validateCSVFile(file: File): Promise<{
  valid: boolean;
  error?: string;
}> {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
    };
  }

  // Check file extension
  if (!file.name.endsWith(".csv")) {
    return {
      valid: false,
      error: "File must be a CSV (.csv extension)",
    };
  }

  return { valid: true };
}
```

**Step 3: Add Parsing with Validation**

```typescript
export async function parseAndValidateCSV(file: File): Promise<{
  success: boolean;
  data?: CSVImport;
  errors?: string[];
}> {
  try {
    // Validate file first
    const fileValidation = await validateCSVFile(file);
    if (!fileValidation.valid) {
      return {
        success: false,
        errors: [fileValidation.error!],
      };
    }

    // Read file content
    const content = await file.text();

    // Parse CSV (basic parsing, or use papa-parse library)
    const rows = content.split("\n").filter((row) => row.trim());

    if (rows.length === 0) {
      return {
        success: false,
        errors: ["CSV file is empty"],
      };
    }

    // Determine format: single column (word only) or multi-column
    const firstRow = rows[0].split(",");
    const hasHeaders =
      firstRow[0].toLowerCase().includes("word") ||
      firstRow[0].toLowerCase().includes("text");

    const startIndex = hasHeaders ? 1 : 0;
    const words: WordEntry[] = [];
    const errors: string[] = [];

    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i].trim();
      if (!row) continue; // Skip empty rows

      const columns = row.split(",").map((col) => col.trim());

      // Build word entry
      const entry: Partial<WordEntry> = {
        text: columns[0] || "",
        phonetic: columns[1] || "",
        tts_voice: columns[2] || "",
      };

      // Validate entry
      const result = WordEntrySchema.safeParse(entry);
      if (!result.success) {
        errors.push(
          `Row ${i + 1}: ${result.error.errors.map((e) => e.message).join(", ")}`,
        );
      } else {
        words.push(result.data);
      }
    }

    // Validate overall import
    const importResult = CSVImportSchema.safeParse({ words });
    if (!importResult.success) {
      return {
        success: false,
        errors: importResult.error.errors.map((e) => e.message),
      };
    }

    return {
      success: true,
      data: importResult.data,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    return {
      success: false,
      errors: [
        `Parse error: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
    };
  }
}
```

**Step 4: Update List Editor Import**

```typescript
// In ListEditor.tsx
const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    setIsImporting(true);

    const result = await parseAndValidateCSV(file);

    if (!result.success) {
      toast.error(
        <div>
          <strong>CSV Import Failed</strong>
          <ul>
            {result.errors?.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      );
      return;
    }

    // Show preview with errors if any
    if (result.errors && result.errors.length > 0) {
      const confirmed = confirm(
        `Import has ${result.errors.length} warnings. Continue?\n\n` +
        result.errors.slice(0, 5).join('\n')
      );
      if (!confirmed) return;
    }

    // Import validated words
    await importWords(result.data!.words);
    toast.success(`Successfully imported ${result.data!.words.length} words`);
  } catch (error) {
    toast.error('Import failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
  } finally {
    setIsImporting(false);
  }
};
```

**Step 5: Add User Documentation**

Create help text in UI:

```tsx
<div className="csv-import-help">
  <h4>CSV Format</h4>
  <p>Upload a CSV file with one of these formats:</p>

  <h5>Simple (one word per line)</h5>
  <pre>
    cat{"\n"}
    dog{"\n"}
    elephant
  </pre>

  <h5>With Phonetic and Voice</h5>
  <pre>
    word,phonetic,voice{"\n"}
    cat,/kæt/,en-US{"\n"}
    dog,/dɔɡ/,en-GB
  </pre>

  <ul>
    <li>Maximum: {MAX_WORDS_PER_IMPORT} words per file</li>
    <li>File size limit: {MAX_FILE_SIZE / 1024 / 1024}MB</li>
    <li>Words: Letters, spaces, hyphens, apostrophes only</li>
  </ul>
</div>
```

ACCEPTANCE CRITERIA:

- [ ] File size validated before parsing
- [ ] Zod schema validates each word entry
- [ ] Invalid characters rejected
- [ ] Row count enforced
- [ ] Parse errors shown to user
- [ ] Multiple formats supported (single column, multi-column)
- [ ] Headers optional
- [ ] Empty rows skipped
- [ ] User documentation provided

TESTING:

1. Valid CSV: Import successfully
2. Too large file: Rejected with size error
3. Invalid characters: Specific row errors
4. Too many words: Rejected with count
5. Malformed CSV: Parse error shown
6. Mixed valid/invalid: Warnings, option to continue
7. Empty file: Rejected
8. Single column: Works
9. Multi-column: Works
10. With headers: Skipped correctly

DELIVERABLES:

1. Updated csvParser.ts with validation
2. Zod schemas for CSV structure
3. User-friendly error messages
4. Import UI with help text
5. Test cases

```

---

## Issue #13: Missing Telemetry Export UI

### Prompt for Agent

```

TASK: Add admin interface or console command to export error telemetry for debugging

CONTEXT:
logger.metrics collects error telemetry (up to 50 errors in circular buffer) but there's no way to view or export this data. Errors are tracked but not actionable.

FINDINGS:

- `src/lib/logger.ts` line 130+: ErrorTelemetry interface defined
- Circular buffer stores last 50 errors
- No UI to view errors
- No export/download function
- No console command exposed
- Telemetry lost on page refresh

PROBLEM:
When users report bugs:

- Support cannot see error context
- Developers cannot reproduce issues
- Error patterns not visible
- Root cause analysis difficult

IMPACT:

- DEBUGGING: Cannot diagnose reported issues
- QUALITY: Bugs harder to fix without context
- UX: Users frustrated repeating issues

RECOMMENDATION:
Add global console command and optional admin page to view/export telemetry.

FILES TO REVIEW:

- `src/lib/logger.ts` (417 lines) - Logger implementation
- `src/app/pages/parent/Settings.tsx` - Potential admin UI location

IMPLEMENTATION STEPS:

**Step 1: Add Export Function to Logger**

```typescript
// In logger.ts
export const logger = {
  // ... existing methods

  /**
   * Export telemetry data for debugging
   */
  exportTelemetry(): {
    errors: ErrorTelemetry[];
    metrics: SyncMetrics;
    exportedAt: string;
    appVersion: string;
  } {
    return {
      errors: errorTelemetry,
      metrics: syncMetrics,
      exportedAt: new Date().toISOString(),
      appVersion: import.meta.env.VITE_APP_VERSION || "unknown",
    };
  },

  /**
   * Download telemetry as JSON file
   */
  downloadTelemetry(): void {
    const data = this.exportTelemetry();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spellstars-telemetry-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Copy telemetry to clipboard
   */
  async copyTelemetry(): Promise<void> {
    const data = this.exportTelemetry();
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    console.log("Telemetry copied to clipboard");
  },
};
```

**Step 2: Expose Global Console Commands**

```typescript
// In main.tsx, after app initialization
if (import.meta.env.DEV || import.meta.env.MODE === "development") {
  // Expose debugging utilities globally
  (window as any).__spellstars = {
    exportTelemetry: () => logger.exportTelemetry(),
    downloadTelemetry: () => logger.downloadTelemetry(),
    copyTelemetry: () => logger.copyTelemetry(),
    clearTelemetry: () => {
      logger.metrics.clearErrors?.();
      console.log("Telemetry cleared");
    },
    getErrors: () => logger.metrics.getErrors(),
    getMetrics: () => logger.metrics.getMetrics(),
  };

  console.log(
    "%c🔍 SpellStars Debug Tools",
    "font-size: 16px; font-weight: bold; color: #4CAF50;",
  );
  console.log("Available commands:");
  console.log("  __spellstars.exportTelemetry() - Get telemetry data");
  console.log("  __spellstars.downloadTelemetry() - Download as JSON");
  console.log("  __spellstars.copyTelemetry() - Copy to clipboard");
  console.log("  __spellstars.clearTelemetry() - Clear all telemetry");
  console.log("  __spellstars.getErrors() - View error list");
  console.log("  __spellstars.getMetrics() - View sync metrics");
}
```

**Step 3: Add Admin UI (Optional)**

In Settings.tsx, add debug section for parent users:

```tsx
// Only show in development or for specific admin users
{
  (import.meta.env.DEV || profile?.email?.includes("@admin")) && (
    <Card>
      <h3>Debug Tools</h3>
      <p className="text-sm text-muted-foreground">
        Export error telemetry for troubleshooting
      </p>

      <div className="flex gap-2 mt-4">
        <Button variant="outline" onClick={() => logger.downloadTelemetry()}>
          Download Telemetry
        </Button>

        <Button
          variant="outline"
          onClick={async () => {
            await logger.copyTelemetry();
            toast.success("Telemetry copied to clipboard");
          }}
        >
          Copy to Clipboard
        </Button>

        <Button
          variant="outline"
          onClick={() => {
            const errors = logger.metrics.getErrors();
            console.table(errors);
            toast.info(`${errors.length} errors logged to console`);
          }}
        >
          View in Console
        </Button>
      </div>

      <div className="mt-4 p-4 bg-muted rounded-md">
        <h4 className="font-medium mb-2">Current Telemetry Status</h4>
        <ul className="text-sm space-y-1">
          <li>Errors captured: {logger.metrics.getErrors().length}</li>
          <li>
            Sync operations:{" "}
            {logger.metrics.getMetrics().syncSuccesses +
              logger.metrics.getMetrics().syncFailures}
          </li>
          <li>
            Last sync:{" "}
            {logger.metrics.getMetrics().lastSyncTimestamp || "Never"}
          </li>
        </ul>
      </div>
    </Card>
  );
}
```

**Step 4: Add Error Report Feature**

Let users send error reports:

```tsx
const handleSendErrorReport = async () => {
  try {
    const telemetry = logger.exportTelemetry();

    // Could integrate with support email, Sentry, or custom endpoint
    const mailto = `mailto:support@spellstars.app?subject=Error Report&body=${encodeURIComponent(
      "Error Report\n\n" +
        "Please describe what you were doing when the error occurred:\n\n" +
        "[Your description here]\n\n" +
        "---\n" +
        "Telemetry Data:\n" +
        JSON.stringify(telemetry, null, 2),
    )}`;

    window.location.href = mailto;
  } catch (error) {
    toast.error("Failed to generate error report");
  }
};
```

**Step 5: Add TypeScript Declarations**

```typescript
// In vite-env.d.ts
interface Window {
  __spellstars?: {
    exportTelemetry: () => any;
    downloadTelemetry: () => void;
    copyTelemetry: () => Promise<void>;
    clearTelemetry: () => void;
    getErrors: () => any[];
    getMetrics: () => any;
  };
}
```

ACCEPTANCE CRITERIA:

- [ ] Console commands work in dev mode
- [ ] exportTelemetry() returns complete data
- [ ] downloadTelemetry() creates JSON file
- [ ] copyTelemetry() copies to clipboard
- [ ] Admin UI accessible to authorized users
- [ ] Error report feature works
- [ ] Type definitions added
- [ ] Documentation updated

TESTING:

1. Open console in dev mode
2. Run `__spellstars.getErrors()`
3. Trigger test error
4. Run `__spellstars.downloadTelemetry()`
5. Verify JSON file downloaded
6. Open file, verify structure
7. Test clipboard copy
8. Test admin UI if implemented

DELIVERABLES:

1. Export functions in logger.ts
2. Global console commands
3. TypeScript declarations
4. Optional admin UI
5. Documentation in README
6. Usage examples

```

Continue to next file with minor issues...
```
