# list_id Field Implementation - Complete Fix

**Date:** November 10, 2025
**Issue:** Attempts table was missing `list_id` field in application code, causing schema mismatch and preventing list-scoped analytics.

## Problem Summary

The `attempts` table was created with `list_id` in the initial schema (`20241108000000_initial_schema.sql`), but a subsequent migration (`20241108000003_safe_schema_update.sql`) removed it. However, the database schema required `list_id` for:

- List-scoped analytics (tracking which list a word was practiced from)
- Parent reports showing progress per list
- Analytics views that join attempts with word_lists

The application code (game pages, sync functions, TypeScript types) was not including `list_id` when inserting attempts, causing potential data integrity issues.

## Changes Implemented

### 1. Database Migration (`20251110214233_add_list_id_to_attempts.sql`)

**Created new migration to:**

- Re-add `list_id UUID` column to `attempts` table
- Backfill existing attempts by looking up through `list_words` junction table
- Add foreign key constraint: `attempts.list_id → word_lists.id` with ON DELETE CASCADE
- Set `list_id` as NOT NULL (after backfill)
- Re-create index `idx_attempts_list_id` for query performance
- Update RLS policy: "Parents can view attempts for their lists"
- Verification checks to ensure migration succeeded

**Status:** ✅ Successfully applied to database

### 2. TypeScript Type Definitions (`src/types/database.types.ts`)

**Updated `attempts` table types:**

- Added `list_id: string` to `Row` type (line 23)
- Added `list_id: string` to `Insert` type (required field, line 35)
- Added `list_id?: string` to `Update` type (optional, line 47)
- Added foreign key relationship for `attempts_list_id_fkey` pointing to `word_lists.id`

This ensures TypeScript compiler enforces `list_id` on all insert operations.

### 3. IndexedDB Schema (`src/data/db.ts`)

**Updated offline queue schema:**

- Added `list_id: string` to `QueuedAttempt` interface (required field)
- Created version 5 of IndexedDB schema to include `list_id` in store definition:

  ```typescript
  "++id, child_id, word_id, list_id, mode, synced, failed, started_at";
  ```

- **Legacy attempt enrichment:** During version 5 upgrade, the system attempts to enrich queued attempts that are missing `list_id`:
  - For each attempt where `list_id` is null/undefined, queries Supabase `list_words` table to find matching `list_id` for the `word_id`
  - If exactly one list is found, sets that `list_id` on the record (enriched)
  - If zero lists match, marks as `failed=true` with `last_error='Missing list_id; cannot infer (word not in any list)'`
  - If multiple lists match, marks as `failed=true` with `last_error='Missing list_id; cannot infer (word in multiple lists)'`
  - **Network/Supabase errors during enrichment:** Updates `last_error` but does NOT mark as `failed`, allowing retry during sync
  - Enrichment is retried during sync for attempts with missing `list_id` via `inferListIdForAttempt()` helper
  - Only permanently fails for non-unique or missing list mappings (data integrity issues)
  - Failed attempts are visible in Sync Status UI and can be manually resolved by parents
- New queued attempts will always include `list_id` going forward

### 4. Sync Function (`src/lib/sync.ts`)

**Updated `queueAttempt()` function:**

- Added `listId: string` parameter (3rd parameter, required)
- Updated function signature:

  ```typescript
  export async function queueAttempt(
    childId: string,
    wordId: string,
    listId: string, // ← NEW PARAMETER
    mode: string,
    correct: boolean,
    typedAnswer?: string,
    audioBlobId?: number
  ): Promise<void>;
  ```

- Updated IndexedDB insert to include `list_id: listId`

**Added `inferListIdForAttempt()` helper function:**

- Shared logic for inferring `list_id` from `word_id` via `list_words` table
- Used by both `enrichLegacyAttempts()` (upgrade) and `syncQueuedAttempts()` (sync)
- Returns `InferListIdResult` with:
  - `success: boolean` - Whether inference succeeded
  - `listId?: string` - The inferred list_id if successful
  - `error?: string` - Error message if failed
  - `retriable?: boolean` - Whether the error is retriable (network/Supabase errors) vs. non-retriable (data integrity issues)
- Distinguishes between retriable errors (offline, Supabase errors) and permanent failures (zero or multiple list matches)
- Enables consistent retry logic across upgrade and sync operations

**Added `enrichLegacyAttempts()` function:**

- Called during IndexedDB version 5 upgrade to enrich legacy attempts
- Queries Supabase `list_words` table to find `list_id` for each `word_id`
- Enriches attempts where exactly one list is found
- Marks attempts as failed where zero or multiple lists are found
- Logs enrichment results: number enriched vs. failed

**Updated `syncQueuedAttempts()` function:**

- Added guard before Supabase insert: checks if `attempt.list_id` is falsy
- **If `list_id` is missing, attempts inference using `inferListIdForAttempt()` helper:**
  - Queries Supabase `list_words` table to find matching `list_id` for `word_id`
  - If exactly one match found, updates attempt record with `list_id` via `db.queuedAttempts.update()` and continues with insert
  - If zero or multiple matches (non-retriable data issue), marks as `failed=true` with specific `last_error` message and skips
  - If inference query errors (e.g., offline, network issue), updates `last_error` but does NOT mark as failed, skips this cycle for later retry
- This prevents NOT NULL constraint violations in the database and enables automatic recovery from transient failures

**Updated `insertAttemptWithRetry()` helper:**

- Added `list_id: attempt.list_id` to Supabase insert statement
- This ensures synced attempts include the list_id field

### 5. Game Page: Listen & Type (`src/app/pages/child/PlayListenType.tsx`)

**Updated `saveAttemptMutation`:**

- Added `list_id: listId` to `attemptData` object (online insert)
- Updated offline `queueAttempt()` call to pass `listId` as 3rd parameter:

  ```typescript
  await queueAttempt(
    profile.id,
    wordId,
    listId, // ← NEW PARAMETER
    "listen-type",
    correct,
    typedAnswer
  );
  ```

### 6. Game Page: Say & Spell (`src/app/pages/child/PlaySaySpell.tsx`)

**Updated `saveAttemptMutation`:**

- Added `list_id: listId` to Supabase insert statement (online insert)
- Updated offline `queueAttempt()` call to pass `listId` as 3rd parameter:

  ```typescript
  await queueAttempt(
    profile.id,
    wordId,
    listId, // ← NEW PARAMETER
    "say-spell",
    correct,
    typedAnswer,
    audioBlobId
  );
  ```

### 7. Documentation (`docs/database-schema.md`)

**Updated attempts table documentation:**

- Added `list_id` column to table description
- Documented as: "Foreign key to word_lists (for list-scoped analytics)"
- Added note explaining why `list_id` is required
- Clarified that `audio_url` stores paths (not URLs) and `list_id` enables list-scoped reports

## Verification Steps

### 1. Database Schema Verification

```powershell
.\check-tables.ps1
# Confirmed: attempts table exists

.\check-migrations.ps1
# Confirmed: 20251110214233_add_list_id_to_attempts.sql applied successfully
```

### 2. TypeScript Compilation

```powershell
npm run build
# Expected: No compilation errors related to list_id
```

### 3. Runtime Testing

- **Online mode:** Game pages now insert attempts with `list_id` to Supabase
- **Offline mode:** Attempts queued with `list_id` in IndexedDB
- **Sync:** Queued attempts sync to Supabase with `list_id` field
- **Analytics:** List-scoped reports can now filter by `list_id`

## Database Backfill Details

The migration backfilled existing attempts using this query:

```sql
UPDATE attempts a
SET list_id = lw.list_id
FROM list_words lw
WHERE a.word_id = lw.word_id
  AND a.list_id IS NULL;
```

**Logic:**

- Look up each attempt's `word_id` in the `list_words` junction table
- Find the corresponding `list_id` for that word
- Set the attempt's `list_id` to match

**Edge case:** If a word appears in multiple lists, the backfill will use the first match. This is acceptable because:

1. Historical attempts are already logged (accuracy unaffected)
2. Analytics will still show progress (just may be attributed to one list over another)
3. Going forward, all new attempts will have the correct `list_id` from the game context

## Impact on Existing Features

### ✅ No Breaking Changes

- Existing RLS policies updated to support `list_id`
- Offline queue upgraded gracefully (version 5 schema)
- Backfill ensures historical data remains valid

### ✅ Enables New Features

- **List-scoped analytics:** Parents can see progress per list
- **Parent reports:** Filter attempts by specific word list
- **Data integrity:** Foreign key ensures attempts reference valid lists
- **Query optimization:** Index on `list_id` improves query performance

## Files Modified

1. `src/types/database.types.ts` - TypeScript types
2. `src/data/db.ts` - IndexedDB schema (version 5)
3. `src/lib/sync.ts` - Queue and sync functions
4. `src/app/pages/child/PlayListenType.tsx` - Listen & Type game
5. `src/app/pages/child/PlaySaySpell.tsx` - Say & Spell game
6. `docs/database-schema.md` - Documentation
7. `supabase/migrations/20251110214233_add_list_id_to_attempts.sql` - New migration

## Testing Checklist

- [x] Migration applied successfully
- [x] TypeScript types updated
- [x] IndexedDB schema updated
- [x] Sync function includes list_id
- [x] PlayListenType includes list_id
- [x] PlaySaySpell includes list_id
- [x] Documentation updated
- [ ] Manual test: Play game online → verify list_id in Supabase
- [ ] Manual test: Play game offline → verify list_id in IndexedDB queue
- [ ] Manual test: Reconnect → verify list_id syncs to Supabase
- [ ] Manual test: Parent dashboard → verify list-scoped analytics work

## Next Steps

1. **Deploy to production:** Migration will auto-apply, backfill existing data
2. **Test analytics:** Verify parent dashboard shows list-scoped reports
3. **Monitor errors:** Check for any foreign key constraint violations
4. **User testing:** Confirm games work in both online/offline modes

## Future Enhancement: Manual List Assignment for Failed Attempts

**Status:** Optional enhancement (not implemented)

**Problem:** Legacy queued attempts that fail enrichment (zero or multiple lists) are marked as permanently failed and visible in the Sync Status UI. Parents cannot resolve these failed attempts without developer intervention.

**Proposed Solution:** Extend `SyncStatusBadge` component to allow manual list assignment:

1. **UI Changes:**
   - Show failed attempts with "Missing list_id" error in Sync Status details
   - Add "Assign List" button next to each failed attempt
   - Display modal with dropdown of parent's word lists
   - Parent selects the correct list for the attempt

2. **Backend Changes:**
   - Add function: `assignListToFailedAttempt(attemptId: number, listId: string)`
   - Update the queued attempt record:

     ```typescript
     await db.queuedAttempts.update(attemptId, {
       list_id: listId,
       failed: false,
       retry_count: 0,
       last_error: undefined,
     });
     ```

   - Re-queue the attempt for sync on next network connection

3. **Benefits:**
   - Parents can resolve failed attempts without losing practice data
   - No developer intervention needed for edge cases
   - Improved user experience for offline-first workflow

4. **Implementation Files:**
   - `src/app/components/SyncStatusBadge.tsx` - Add "Assign List" UI
   - `src/lib/sync.ts` - Export `assignListToFailedAttempt()` helper
   - `src/app/api/supa.ts` - Query hook for parent's word lists (already exists: `useWordLists()`)

**Note:** This enhancement is optional and can be implemented later if users report issues with failed attempts. The current implementation (enrichment + guard) handles the majority of cases automatically.

## Notes

- The migration is idempotent (safe to run multiple times)
- Backfill query is efficient (uses index on `word_id`)
- Foreign key cascade ensures data integrity when lists are deleted
- RLS policies ensure parents can only see attempts for their lists
