# SpellStars - AI Coding Guidelines

## Project Architecture

**SpellStars** is a PWA for kids' spelling practice with **parent** (content management) and **child** (gameplay) interfaces. Built offline-first with WCAG 2.1 AA accessibility.

**Stack:** React 18 + TypeScript (strict) | Vite | React Query | Zustand | Supabase | Dexie (IndexedDB) | Tailwind + CVA

**Package Manager:** `pnpm` ONLY (never npm/yarn) - `pnpm-lock.yaml` is source of truth

**Critical Patterns:**

- ALL data in `src/app/api/supa.ts` (2046 lines) - React Query hooks, never raw fetch
- CVA for ALL components - see `src/app/components/Button.tsx` for pattern
- Audio URLs stored as PATHS, not URLs - generate signed URLs on-demand via `getSignedAudioUrl()`
- Offline queue: `src/lib/sync.ts` handles IndexedDB → Supabase sync with exponential backoff

## Two-Tier Security (Parent vs Child Routes)

**Parent routes** (`/parent/*`): Double protection with auth + PIN

```tsx
<ProtectedRoute requiredRole="parent">
  <PinProtectedRoute>
    <Dashboard />
  </PinProtectedRoute>
</ProtectedRoute>
```

- PINs: PBKDF2-HMAC-SHA256 (100k iterations) via `src/lib/crypto.ts`
- Format: `"salt:hash"` (both base64)
- `isPinLocked` resets to `true` on app restart (NOT persisted for security)
- Parents can access child routes (see `ProtectedRoute.tsx` line 28)

**Child routes** (`/child/*`): Auth only, cached offline via `NetworkFirst` in `vite.config.ts`

## State Management: Three-Tool Pattern

**1. Zustand** (client state):

- `useAuthStore`: Set by `useAuth()` hook ONLY - never directly
- `useParentalSettingsStore`: Persists to localStorage as `'parental-settings'` (lock state NOT persisted)

**2. React Query** (server state in `supa.ts`):

```tsx
// ALL mutations use optimistic updates
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

Query keys: `['word-lists', userId]` | `['word-list', listId]` | `['due-words', childId]`

**3. Dexie** (offline queue):

```tsx
// Queue when offline
if (!isOnline) {
  await db.queuedAttempts.add({ child_id, word_id, synced: false, ... });
}
// Auto-sync on reconnect (useOnline hook triggers syncQueuedData)
```

## Critical Workflows

### Running Commands

```powershell
pnpm run dev          # doppler run -- vite (RECOMMENDED)
pnpm run dev:local    # Without Doppler (requires .env)
pnpm run build        # doppler run -- tsc && vite build
```

### Database Migrations

```powershell
.\push-migration.ps1        # Apply ALL .sql files (alphabetical)
.\check-migrations.ps1      # List applied migrations
.\check-tables.ps1          # Quick table list
```

**Migration naming:** `YYYYMMDDHHMMSS_description.sql`
**Critical:** Use `IF NOT EXISTS` for idempotency. Include RLS policies for new tables.

### Signed URL Security (NEVER cache!)

```typescript
// Service worker excludes signed URLs (vite.config.ts):
urlPattern: ({ url }) => {
  const isStorage = url.hostname.includes('.supabase.co') &&
                    url.pathname.includes('/storage/');
  const hasSignedToken = url.searchParams.has('token');
  return isStorage && hasSignedToken;
},
handler: 'NetworkOnly', // 1-hour TTL, must regenerate
```

## Component & Styling Standards

### CVA Pattern (ALL components)

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md...", // Base
  {
    variants: {
      variant: { default: "bg-primary...", outline: "border-2..." },
      size: {
        default: "parent-button", // 44px (WCAG AA)
        child: "child-button", // 88px (exceeds AAA)
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
```

### Accessibility Requirements

- Child buttons: 88px min-height
- Parent buttons: 44px min-height
- 4px focus rings via `--ring` CSS variable
- ARIA labels on ALL interactive elements
- `VisuallyHidden` component for screen reader text

### CSS Variables (runtime theme switching)

30+ themes in `src/app/lib/themes.ts`:

```typescript
export function applyTheme(themeId: string) {
  Object.entries(theme.cssVariables).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
}
```

## Database Schema Essentials

**Core tables with RLS:**

- `profiles` - User accounts (`id`, `email`, `role: 'parent'|'child'`)
- `word_lists` - Spelling lists (`title`, `week_start_date`, `created_by`)
- `words` - Vocabulary (`text`, `phonetic`, `prompt_audio_url`, `tts_voice`)
- `list_words` - Junction table (`list_id`, `word_id`, `sort_index`) - same word in multiple lists
- `attempts` - Practice history (`child_id`, `word_id`, `mode`, `correct`, `typed_answer`, `audio_url`)
- `srs` - Spaced repetition (`ease`, `interval_days`, `due_date`, `reps`, `lapses`)

**Storage buckets (PRIVATE with signed URLs):**

- `audio-recordings` - Child recordings: `{child_id}/{list_id}/{word_id}_{timestamp}.webm`
- `word-audio` - Prompt audio: `lists/{listId}/words/{wordId}.webm`

**RLS Pattern:** Parents CRUD own content; children read-only + insert own attempts

## Common Pitfalls

❌ **DON'T:**

- Use `console.log` (use `logger.debug/info/warn/error` from `@/lib/logger`)
- Cache signed URLs (1-hour TTL, regenerate on access)
- Mutate React Query cache without `invalidateQueries`
- Create `package-lock.json` (use `pnpm-lock.yaml`)
- Set `useAuthStore` directly (use `useAuth()` hook)

✅ **DO:**

- Add JSDoc to complex functions (see `PlayListenType.tsx` for examples)
- Use `cn()` utility for className merging (`@/lib/utils`)
- Queue operations when offline via `queueAttempt()` from `@/lib/sync`
- Generate signed URLs on-demand via `getSignedAudioUrl()`
- Track errors with `logger.metrics.errorCaptured()`

## Key Files

| File                                     | Purpose                                                     |
| ---------------------------------------- | ----------------------------------------------------------- |
| `src/app/api/supa.ts`                    | ALL data ops (2046 lines) - React Query hooks               |
| `src/lib/sync.ts`                        | Offline queue sync (1079 lines) - exponential backoff       |
| `vite.config.ts`                         | PWA config - cache strategies (NetworkOnly for signed URLs) |
| `src/app/store/parentalSettings.ts`      | Settings + PIN hashing (PBKDF2)                             |
| `src/lib/srs.ts`                         | SM-2-lite spaced repetition (pure functions)                |
| `src/lib/logger.ts`                      | Centralized logging + telemetry                             |
| `src/app/pages/child/PlayListenType.tsx` | Game implementation example (1391 lines)                    |

## Debugging

**Offline testing:**

1. DevTools > Network > "Offline"
2. Play game, check IndexedDB for `queuedAttempts` (synced: false)
3. Re-enable network, verify sync

**Common issues:**

- "React Query not refetching": Check query keys match in `invalidateQueries()`
- "Audio not playing": Verify signed URL regenerated (not cached)
- "Migration failed": Check idempotency (`IF NOT EXISTS`) + RLS policies
- "PIN not working": Check `isPinLocked` resets on restart (security feature)
- "Sync stuck": Check `src/lib/sync.ts` for exponential backoff logic (max 5 retries)
