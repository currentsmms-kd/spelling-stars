# Spaced Repetition System (SRS) Implementation

This document summarizes the implementation of the spaced repetition system for SpellStars.

## Overview

A light spaced-repetition scheduler has been added to track word difficulty and schedule reviews using the SM-2-lite algorithm.

## Database Changes

### New Table: `srs`

Created in migration `20241109000004_add_srs_table.sql`

**Columns:**

- `id` (uuid, primary key)
- `child_id` (uuid, foreign key to profiles)
- `word_id` (uuid, foreign key to words)
- `ease` (real, default 2.5, min 1.3) - Ease factor indicating word difficulty
- `interval_days` (integer, default 0) - Days until next review (0 = due now)
- `due_date` (date, default today) - Date when word should be reviewed
- `reps` (integer, default 0) - Number of successful repetitions
- `lapses` (integer, default 0) - Number of times word was missed
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

**Constraints:**

- Unique constraint on (child_id, word_id)
- Check constraints: ease >= 1.3, interval_days >= 0, reps >= 0, lapses >= 0

**Indexes:**

- `idx_srs_child_due` on (child_id, due_date)
- `idx_srs_child_word` on (child_id, word_id)
- `idx_srs_due_date` on (due_date)

**RLS Policies:**

- Children can manage their own SRS entries
- Parents can view all SRS entries (for reporting)
- Service role has full access

## SM-2-lite Algorithm

### On First-Try Correct Answer

```
ease = max(1.3, ease + 0.1)
interval = (interval == 0) ? 1 : round(interval * ease)
due_date = now() + interval
reps += 1
```

### On Miss (Not First Try)

```
ease = max(1.3, ease - 0.2)
interval = 0
due_date = now()
lapses += 1
```

## Code Changes

### 1. Utility Functions (`src/lib/srs.ts`)

Created utility functions for SRS calculations:

- `calculateSrsOnSuccess(currentEntry)` - Calculate new values for correct first-try
- `calculateSrsOnMiss(currentEntry)` - Calculate new values for miss
- `createSrsInsertOnSuccess(childId, wordId)` - Prepare insert for success
- `createSrsInsertOnMiss(childId, wordId)` - Prepare insert for miss
- `prepareSrsUpdate(isCorrectFirstTry, currentEntry)` - Prepare update values
- `isDueToday(srsEntry)` - Check if word is due
- `isOverdue(srsEntry)` - Check if word is overdue
- `daysUntilDue(srsEntry)` - Calculate days until due

### 2. API Functions (`src/app/api/supa.ts`)

Added SRS database operations:

- `getSrsEntry(childId, wordId)` - Get SRS entry for a word
- `upsertSrsEntry(entry)` - Insert or update SRS entry
- `updateSrsAfterAttempt(childId, wordId, isCorrectFirstTry)` - Update SRS after attempt
- `getDueWords(childId)` - Get all words due today for a child
- `getHardestWords(limit)` - Get words with lowest ease (hardest)
- `getMostLapsedWords(limit)` - Get words with most lapses

React Query hooks:

- `useDueWords(childId)` - Hook to fetch due words
- `useHardestWords(limit)` - Hook to fetch hardest words
- `useMostLapsedWords(limit)` - Hook to fetch most lapsed words
- `useUpdateSrs()` - Hook to update SRS after attempt

### 3. Game Components

#### `src/app/pages/child/PlayListenType.tsx`

- Added `useUpdateSrs()` hook
- On correct answer: calls `updateSrs.mutate()` with `isCorrectFirstTry = !hasTriedOnce`
- On first miss: calls `updateSrs.mutate()` with `isCorrectFirstTry = false`

#### `src/app/pages/child/PlaySaySpell.tsx`

- Added `useUpdateSrs()` hook
- Same logic as PlayListenType for tracking first-try correct/miss

### 4. Child Home Page (`src/app/pages/child/Home.tsx`)

Added "Due Today" section:

- Displays words that are due for review (due_date <= today)
- Shows word text, associated lists, ease factor, and rep count
- Displays up to 5 words with indicator for additional words
- Aggregates words across all lists

### 5. Parent Dashboard (`src/app/pages/parent/Dashboard.tsx`)

Added SRS insights with two report cards:

**Hardest Words:**

- Shows words with lowest ease factor
- Displays ease, reps, and lapses for each word
- Limited to top 5

**Most Lapsed Words:**

- Shows words with most lapses (mistakes)
- Displays lapses, reps, and ease for each word
- Limited to top 5

### 6. Type Definitions (`src/types/database.types.ts`)

Added `srs` table types:

- `Row` type for querying
- `Insert` type for inserting
- `Update` type for updating
- Relationships to profiles and words

## Usage Flow

1. **Child practices a word** in Listen & Type or Say & Spell mode
2. **On first attempt:**
   - If correct: SRS entry created/updated with increased ease and scheduled interval
   - If incorrect: SRS entry created/updated with decreased ease and set to due immediately
3. **Child home page** shows words due for review today
4. **Parent dashboard** shows insights on hardest words and most lapsed words

## Migration

To apply the migration:

```powershell
# Using Supabase CLI
supabase db push

# Or using the push-migration script
.\push-migration.ps1
```

## Testing Recommendations

1. Practice words in both game modes to create SRS entries
2. Mix correct first-try and incorrect answers to see ease changes
3. Verify "Due Today" section shows appropriate words on child home
4. Check parent dashboard shows hardest words and most lapsed words
5. Test that ease increases on correct answers and decreases on misses
6. Verify intervals increase appropriately (1 day first time, then multiplied by ease)

## Future Enhancements

Possible improvements:

- Visual calendar showing when words are due
- Ability to manually reset or adjust SRS for specific words
- SRS statistics over time (improvement graphs)
- Smart list generation based on due words
- Configurable SRS parameters (ease adjustment values, min/max ease)
- Batch practice mode for all due words
