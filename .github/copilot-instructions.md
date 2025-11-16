# SpellStars - AI Coding Guidelines

## Project Overview

**SpellStars** is an offline-first PWA for kids' spelling practice with dual interfaces: **parent** (content management) and **child** (gameplay). Built for WCAG 2.1 AA accessibility.

**Stack:** React 18 + TypeScript (strict) | Vite | React Query | Zustand | Supabase | Dexie (IndexedDB) | Tailwind + CVA
**Package Manager:** `pnpm` ONLY (never npm/yarn) - `pnpm-lock.yaml` is the source of truth

## Critical Architectural Decisions

### 1. Data Layer: Single Source of Truth

**ALL** data operations go through `src/app/api/supa.ts` (2046 lines):

- React Query hooks for ALL queries/mutations - never use raw `fetch()`
- Optimistic updates pattern for mutations (see example below)
- Query keys: `['word-lists', userId]` | `['word-list', listId]` | `['due-words', childId]`

```typescript
// Mutation pattern with optimistic updates
onMutate: async (vars) => {
  await queryClient.cancelQueries(['word-list', vars.listId]);
  const previous = queryClient.getQueryData(['word-list', vars.listId]);
  queryClient.setQueryData(['word-list', vars.listId], optimisticData);
  return { previous }; // Snapshot for rollback
},
onError: (err, vars, context) => {
  queryClient.setQueryData(['word-list', vars.listId], context?.previous);
},
```

### 2. Audio Storage: Path-Based with Signed URLs

Audio URLs stored as **storage paths** (not full URLs) in database:

- Child recordings: `{child_id}/{list_id}/{word_id}_{timestamp}.webm`
- Prompt audio: `lists/{listId}/words/{wordId}.webm`
- Generate signed URLs **on-demand** via `getSignedAudioUrl()` from `supa.ts`
- **NEVER cache signed URLs** - 1-hour TTL requires regeneration

```typescript
// Service worker MUST exclude signed URLs (vite.config.ts):
urlPattern: ({ url }) => {
  const hasSignedToken = url.searchParams.has('token');
  return url.hostname.includes('.supabase.co') && hasSignedToken;
},
handler: 'NetworkOnly', // Always fetch fresh signed URL
```

### 3. Offline Queue: Exponential Backoff Sync

`src/lib/sync.ts` (1079 lines) handles IndexedDB → Supabase sync:

- Queue operations when offline: `await db.queuedAttempts.add({ child_id, word_id, synced: false, ... })`
- Auto-sync on reconnect via `useOnline` hook
- Exponential backoff (max 5 retries) with `retry_count` and `last_error` tracking
- Permanently mark as `failed` after max retries

### 4. Security: Two-Tier Route Protection

**Parent routes** (`/parent/*`): Auth + PIN lock (double protection)

```tsx
<ProtectedRoute requiredRole="parent">
  <PinProtectedRoute>
    <Dashboard />
  </PinProtectedRoute>
</ProtectedRoute>
```

- PINs: PBKDF2-HMAC-SHA256 (100k iterations) via `src/lib/crypto.ts`
- Storage format: `"salt:hash"` (both base64-encoded)
- `isPinLocked` resets to `true` on app restart (**NOT** persisted for security)
- Dev mode: Parents can access child routes for testing (see `ProtectedRoute.tsx` line 28)

**Child routes** (`/child/*`): Auth only, cached offline via `NetworkFirst`

### 5. State Management: Three-Layer Architecture

**Client state (Zustand):**

- `useAuthStore`: Set ONLY by `useAuth()` hook - never directly
- `useParentalSettingsStore`: Persists to localStorage as `'parental-settings'` (lock state excluded)

**Server state (React Query):**
All queries/mutations in `supa.ts` with cache invalidation on mutations

**Offline queue (Dexie):**
IndexedDB tables: `queuedAttempts`, `queuedAudio`, `queuedSrsUpdates`, `queuedStarTransactions`

## Essential Developer Workflows

### Running Commands (Doppler for Secrets Management)

```powershell
pnpm run dev          # doppler run -- vite (RECOMMENDED)
pnpm run dev:local    # Without Doppler (requires .env)
pnpm run build        # doppler run -- tsc && vite build
```

### Database Migrations

```powershell
.\push-migration.ps1        # Apply ALL .sql files (alphabetical order)
.\check-migrations.ps1      # List applied migrations
.\check-tables.ps1          # Quick table list
```

**Migration naming:** `YYYYMMDDHHMMSS_description.sql`
**Critical rules:**

- Use `IF NOT EXISTS` for idempotency (migrations can be re-run)
- Include RLS policies for new tables
- UNIQUE constraints auto-create indexes (don't duplicate)
- Run `.\check-db-health.ps1` after schema changes

### Debugging Offline Sync

1. DevTools > Network > "Offline"
2. Play game, verify IndexedDB has `queuedAttempts` with `synced: false`
3. Re-enable network, check console for sync logs
4. Verify Supabase has synced records

## Component & Styling Conventions

### CVA Pattern (Required for ALL Components)

See `src/app/components/Button.tsx` for reference:

```tsx
const buttonVariants = cva(
  "inline-flex items-center rounded-md...", // Base classes
  {
    variants: {
      variant: { default: "bg-primary...", outline: "border-2..." },
      size: {
        default: "parent-button", // 44px (WCAG AA)
        child: "child-button", // 88px (exceeds AAA)
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);
```

### Accessibility Standards (WCAG 2.1 AA)

- **Touch targets:** Child buttons 88px, parent buttons 44px
- **Focus indicators:** 4px rings via `--ring` CSS variable
- **ARIA labels:** Required on ALL interactive elements
- **Screen reader text:** Use `<VisuallyHidden>` component
- **Keyboard navigation:** Full tab order, Enter/Space activation

### Theme System (Runtime CSS Variables)

30+ themes in `src/app/lib/themes.ts`:

```typescript
export function applyTheme(themeId: string) {
  Object.entries(theme.cssVariables).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
}
```

## Database Schema (Key Patterns)

**Junction table pattern:** `list_words` enables same word in multiple lists

- `words` table: Vocabulary items (`text`, `phonetic`, `tts_voice`)
- `list_words` table: Many-to-many (`list_id`, `word_id`, `sort_index`)
- Query: Join through junction table for list-specific word order

**Spaced repetition:** `srs` table implements SM-2-lite algorithm

- See `src/lib/srs.ts` for pure functions: `calculateSrsOnSuccess()`, `calculateSrsOnMiss()`
- Success: `ease += 0.1`, `interval = round(interval * ease)`, `due_date = today + interval`
- Failure: `ease -= 0.2`, `interval = 0`, `due_date = today`, `lapses += 1`

**Attempts tracking:** `list_id` field required for list-scoped analytics

- `audio_url` stores **path** not full URL (generate signed URL on-demand)
- `quality` score (0-5): Based on correctness, first-try, hints used

**RLS pattern:** Parents CRUD own content; children read-only + insert own attempts

## Common Pitfalls & Solutions

❌ **DON'T:**

- Use `console.log` → Use `logger.debug/info/warn/error` from `@/lib/logger`
- Cache signed URLs → Always regenerate on-demand (1-hour TTL)
- Mutate React Query cache without `invalidateQueries()` → Stale data
- Create `package-lock.json` → Only `pnpm-lock.yaml` exists
- Set `useAuthStore` directly → Use `useAuth()` hook
- Read entire files for code exploration → Use symbol tools first (Serena/MCP)

✅ **DO:**

- Add JSDoc to complex functions (see `src/app/pages/child/PlayListenType.tsx` for examples)
- Use `cn()` utility for className merging (`@/lib/utils`)
- Queue operations when offline: `await db.queuedAttempts.add(...)`
- Normalize spelling answers: `normalizeSpellingAnswer()` from `@/lib/utils`
- Track errors: `logger.metrics.errorCaptured()` for telemetry

## Key Files Reference

| File                                | Purpose                                                           | Lines |
| ----------------------------------- | ----------------------------------------------------------------- | ----- |
| `src/app/api/supa.ts`               | ALL data operations (React Query hooks)                           | 2046  |
| `src/lib/sync.ts`                   | Offline queue sync (exponential backoff)                          | 1079  |
| `src/lib/utils.ts`                  | Spelling normalization (`normalizeSpellingAnswer`, `getHintText`) | -     |
| `src/lib/crypto.ts`                 | PIN hashing (PBKDF2-HMAC-SHA256)                                  | -     |
| `src/lib/srs.ts`                    | SM-2-lite spaced repetition (pure functions)                      | 179   |
| `src/lib/logger.ts`                 | Centralized logging + error telemetry                             | 417   |
| `vite.config.ts`                    | PWA cache strategies (NetworkOnly for signed URLs)                | -     |
| `src/app/store/parentalSettings.ts` | Zustand store (persists to localStorage)                          | -     |
| `src/app/router.tsx`                | Route protection (`ProtectedRoute`, `PinProtectedRoute`)          | 179   |
| `push-migration.ps1`                | Apply SQL migrations via Supabase Management API                  | -     |

## Bug Fix Workflow

When you discover and fix a bug, follow this process:

1. **Fix the bug immediately** in the code
2. **Document the fix** in `BUG_FIXES_HISTORY.md` following the existing format:
   - Add entry under appropriate date section (create new date section if needed)
   - Include: Date, Problem description, Root cause analysis, Solution, Files modified
   - Use clear, searchable formatting for future reference
3. **Do NOT create separate bug tracking documents** - all fixes go directly into history file

**Why this workflow:**

- Single source of truth for all bug fixes
- No outdated "bugs to fix" lists
- Clear chronological record
- Easy to search and reference past fixes

**Example entry format:**

```markdown
### Fixed: [Brief Description]

**Date:** November 15, 2025
**Problem:** [What was broken and user impact]
**Root Cause:** [Technical reason for the bug]
**Solution:** [How it was fixed]
**Files Modified:**

- `path/to/file.ts` (lines X-Y)
```

## Key Architectural Patterns

These patterns emerged from bug fixes and should be followed:

- **Always use `profile.id` for user identification** (not `session.user.id`)
  - Rationale: `profile.id` is set from `auth.uid()` and guaranteed consistent with RLS policies
  - Prevents sync failures between online/offline modes
- **Generate signed URLs for private storage on-demand** (never cache, 1-hour TTL)
  - Use `getSignedPromptAudioUrls()` for batch generation
  - Service worker excludes signed URLs (NetworkOnly strategy)
- **Use `mutate()` for non-blocking operations**, `mutateAsync()` only when you need to wait
  - Prevents UI blocking during database operations
- **RLS policies focus on authorization**, not data integrity validation
  - Let foreign key constraints handle data integrity
  - Keep policies simple for performance
- **Enhanced error logging** with context, error codes, and detailed information
  - Always log: `error.code`, `error.message`, `error.details`
- **Non-blocking star awards** with try-catch
  - Don't let reward system failures block core gameplay
- **Guard clauses** for early returns on missing data
  - Prevents mutations from hanging with incomplete data

## Quick Troubleshooting

**"React Query not refetching"** → Check query keys match in `invalidateQueries(['word-list', listId])`
**"Audio not playing"** → Verify signed URL regenerated (not cached)
**"Migration failed"** → Check idempotency (`IF NOT EXISTS`) + RLS policies
**"PIN not working after restart"** → Expected behavior (`isPinLocked` resets to `true`)
**"Sync stuck"** → Check `src/lib/sync.ts` for `retry_count` (max 5 retries, then `failed: true`)
**"Game won't advance"** → Fixed in Nov 2025 update (clear cache if still occurs)
**"RLS policy violations during sync"** → Verify using `profile.id` consistently (not `session.user.id`)
**"403 errors on audio playback"** → Check signed URL generation is being called
