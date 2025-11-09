# SpellStars - AI Coding Agent Instructions

## Project Overview

SpellStars is a Progressive Web App (PWA) for children's spelling practice with a **dual-interface architecture**: parents manage content, children play games. Built for offline-first functionality with strict accessibility standards.

### Core Principles

- **Offline-first**: IndexedDB queue ensures no data loss during network outages
- **Accessibility**: WCAG 2.1 AA - child buttons 88px, parent buttons 44px, 4px focus rings
- **Security**: Row Level Security (RLS) on all tables, PIN-protected parent routes, role-based auth
- **Performance**: Code splitting, optimistic updates, CacheFirst strategy for child routes

### Tech Stack

**Frontend:** React 18 + TypeScript 5.2+ (strict mode) | Vite 7.2+ | TanStack React Query 5.24+ | Zustand 4.5+ | React Router DOM 6.22+

**UI:** Tailwind CSS 3.4+ | class-variance-authority (CVA pattern for ALL components) | Lucide React | WaveSurfer.js 7.7+

**Backend:** Supabase (PostgreSQL + Auth + Storage) | Dexie 3.2+ (IndexedDB) | vite-plugin-pwa 1.1+ (Workbox)

**Environment:** Doppler (secrets) | PowerShell scripts (migrations)

## Critical Architecture Patterns

### Two-Tier Security Model

**Parent routes** (`/parent/*`) have double protection:

```tsx
<ProtectedRoute requiredRole="parent">
  {" "}
  {/* Auth + role check */}
  <PinProtectedRoute>
    {" "}
    {/* PIN verification */}
    <Dashboard />
  </PinProtectedRoute>
</ProtectedRoute>
```

- PIN stored hashed in `useParentalSettingsStore` (localStorage)
- `isPinLocked` resets to `true` on app restart (security feature - NOT persisted)
- Parents can access child routes (line 28 in `ProtectedRoute.tsx`)

**Child routes** (`/child/*`) only need auth:

```tsx
<ProtectedRoute requiredRole="child">
  <Home />
</ProtectedRoute>
```

- Cached offline via `CacheFirst` in `vite.config.ts`

**Auth Flow:** Sign in → `handle_new_user()` trigger creates profile → `role` from metadata → `supabase.auth.onAuthStateChange` updates Zustand → `RootRedirect` routes based on role

**PIN Security:** PINs use PBKDF2-HMAC-SHA256 (100k iterations, 16-byte salt) via `src/lib/crypto.ts`:

- Format: `"salt:hash"` (both base64-encoded)
- Verification uses constant-time comparison to prevent timing attacks
- Failed attempts tracked with exponential lockout (after 3 failures)
- All existing PINs cleared on migration to PBKDF2 (see `20241109000007_secure_pin_hashing.sql`)

### State Management: Three Tools, Three Purposes

**1. Zustand** - Client state (ephemeral + persisted):

- `useAuthStore`: `{user, profile, isLoading}` - Set by `useAuth()`, NEVER directly
- `useParentalSettingsStore`: Settings with `persist` middleware → localStorage as `'parental-settings'`. Lock state NOT persisted
- `useThemeStore`: Theme ID → modifies CSS custom properties via `applyTheme()`
- `useSessionStore`: Active gameplay session → writes to `session_analytics` on complete

**2. React Query** - Server state (ALL in `src/app/api/supa.ts`, 1133 lines):

```tsx
// Query pattern
export function useWordLists(userId: string) {
  return useQuery({
    queryKey: ["word-lists", userId], // CRITICAL: Keys must match for invalidation
    queryFn: async () => {
      /* Supabase query */
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

// Mutation with optimistic updates
export function useReorderWords() {
  return useMutation({
    mutationFn: async ({ listId, words }) => {
      /* Update DB */
    },
    onMutate: async ({ listId, words }) => {
      await queryClient.cancelQueries(["word-list", listId]);
      const previous = queryClient.getQueryData(["word-list", listId]);
      queryClient.setQueryData(["word-list", listId], optimisticData);
      return { previous }; // Snapshot for rollback
    },
    onError: (err, vars, context) => {
      queryClient.setQueryData(["word-list", vars.listId], context?.previous);
    },
    onSettled: (data, error, { listId }) => {
      queryClient.invalidateQueries(["word-list", listId]);
    },
  });
}
```

Query key convention: `['word-lists', userId]` | `['word-list', listId]` | `['due-words', childId]`

**3. Dexie (IndexedDB)** - Offline queue (`src/data/db.ts` + `src/lib/sync.ts`):

```tsx
// Queue attempt when offline
if (!isOnline) {
  await db.queuedAttempts.add({ child_id, word_id, synced: false, ... });
}

// Auto-sync on reconnect (triggered by useOnline() hook)
syncQueuedData() → uploads audio to Storage → inserts attempts → marks synced: true
```

**Critical sync features** (`src/lib/sync.ts`):

- Exponential backoff with jitter (1s, 2s, 4s, 8s, 16s delays)
- Max 5 retry attempts before marking as failed
- Atomic operations: audio uploaded first, then attempts with references
- Batch processing to avoid overwhelming network/database
- Error isolation: one failed item doesn't block entire queue

### Database Schema (Key Tables)

**Core tables with RLS:**

1. `profiles` - User accounts (`id`, `email`, `role: 'parent'|'child'`)
2. `word_lists` - Spelling lists (`title`, `week_start_date`, `created_by`)
3. `words` - Vocabulary (`text`, `phonetic`, `prompt_audio_url`, `tts_voice`)
4. `list_words` - Junction table (`list_id`, `word_id`, `sort_index`) - **Why separate?** Same word in multiple lists with different order
5. `attempts` - Practice history (`child_id`, `word_id`, `mode: 'listen-type'|'say-spell'`, `correct`, `typed_answer`, `audio_url`)
6. `srs` - Spaced repetition state (`ease`, `interval_days`, `due_date`, `reps`, `lapses`) - Unique per (child_id, word_id)
7. `parental_settings` - Parent prefs (`pin_code`, `show_hints_on_first_miss`, `daily_session_limit_minutes`, etc.)
8. `session_analytics` - Session tracking (`session_date`, `words_practiced`, `correct_on_first_try`)

**Storage bucket:** `word-audio` - Path: `lists/{listId}/words/{wordId}.webm` - Public read, parent write

**Storage bucket (audio-recordings):** Path: `{child_id}/{list_id}/{word_id}_{timestamp}.webm` - **PRIVATE bucket** - Access requires signed URLs (1 hour TTL) via `getSignedAudioUrl()` in `supa.ts`

**Storage bucket (word-audio):** Path: `lists/{listId}/words/{wordId}.webm` - Public read, parent write (prompt audio only)

**RLS Pattern:** Parents CRUD own content; children read-only + insert own attempts

### SRS (Spaced Repetition) Implementation

**Algorithm:** SM-2-lite (`src/lib/srs.ts` - pure functions)

**On correct first try:**

```typescript
ease = max(1.3, currentEase + 0.1)
interval = currentInterval === 0 ? 1 : round(currentInterval * ease)
due_date = today + interval days
```

**On miss:** `ease -= 0.2`, `interval = 0`, `due_date = today`, `lapses++`

**Integration:** `PlayListenType.tsx`/`PlaySaySpell.tsx` call `useUpdateSrs()` → upserts SRS entry → Child home shows "Due Today" where `due_date <= today`

## Development Workflows

### Running the App

```powershell
npm run dev         # With Doppler (RECOMMENDED): doppler run -- vite
npm run dev:local   # Without Doppler (requires .env file)
npm run build       # Production: doppler run -- tsc && vite build
npm run preview     # Preview: doppler run -- vite preview
```

**Important:** This project uses **npm**, NOT pnpm or yarn. All dependency management uses npm.

**Required env vars:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_ACCESS_TOKEN` (migrations only)

**Doppler setup:**

```powershell
scoop install doppler
doppler login
doppler setup
doppler secrets  # Verify
```

### Database Migrations

**PowerShell scripts** (fetch `SUPABASE_ACCESS_TOKEN` from Doppler):

```powershell
.\push-migration.ps1        # Apply ALL .sql files in supabase/migrations/ (alphabetical order)
.\check-migrations.ps1      # List applied migrations
.\check-schema.ps1          # Show current schema
.\check-tables.ps1          # List all tables
```

**Migration naming:** `YYYYMMDDHHMMSS_description.sql` (e.g., `20241109000001_add_word_audio_bucket.sql`)

**Creating new migration:**

1. Create file: `supabase/migrations/$(Get-Date -Format 'yyyyMMddHHmmss')_your_description.sql`
2. Write idempotent SQL (use `IF NOT EXISTS`, `IF EXISTS`)
3. Include RLS policies for new tables
4. Run `.\push-migration.ps1`
5. Verify with `.\check-tables.ps1`

**Existing migrations (chronological):**

1. `20241108000000_initial_schema.sql` - Core tables
2. `20241108000003_safe_schema_update.sql` - Schema adjustments
3. `20241108000004_safe_seed_data.sql` - Initial data
4. `20241109000001_add_word_audio_bucket.sql` - Storage bucket
5. `20241109000002_fix_profile_rls.sql` - RLS fixes
6. `20241109000003_simplify_profile_rls.sql` - RLS simplification
7. `20241109000004_add_srs_table.sql` - Spaced repetition
8. `20241109000005_add_parental_controls_analytics_badges.sql` - Settings/analytics
9. `20241109000006_add_color_theme.sql` - Theme preferences
10. `20241109000007_secure_pin_hashing.sql` - PBKDF2 PIN security (100k iterations)
11. `20251109164108_secure_audio_recordings_private.sql` - Private audio storage with signed URLs
12. `20251109164346_document_audio_url_security.sql` - Audio security documentation

### PWA & Offline Support

**Service Worker** (`vite.config.ts`):

```typescript
VitePWA({
  workbox: {
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: "NetworkFirst", // Supabase API: network first, cache fallback
      },
      {
        urlPattern: /\/child\/.*/,
        handler: "CacheFirst", // Child routes: cache first for offline play
      },
    ],
  },
});
```

**Offline flow:**

1. `useOnline()` hook detects offline
2. Queue to IndexedDB: `db.queuedAttempts.add({ synced: false, ... })`
3. Queue audio: `db.queuedAudio.add({ blob, synced: false })`
4. On reconnect: `syncQueuedData()` → upload audio → insert attempts → mark `synced: true`

**Testing offline:**

1. DevTools > Network > "Offline"
2. Play game, check IndexedDB for unsync records
3. Re-enable network, verify Supabase sync

## Component & Styling Patterns

### CVA (class-variance-authority) Pattern

**ALL components use CVA** for variants. Example from `Button.tsx`:

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md...", // Base
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary...",
        outline: "border-2 border-border...",
      },
      size: {
        default: "parent-button", // 44px min height (WCAG AA)
        child: "child-button", // 88px min height (exceeds AAA)
        sm: "h-9 px-3 text-sm",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
);
```

**Key shared components:**

- `Button` - 5 variants, 4 sizes, forwardRef
- `AudioRecorder` - WaveSurfer.js + MediaRecorder, returns Blob via callback
- `ProtectedRoute` / `PinProtectedRoute` - Nested auth layers
- `Card`, `Navigation`, `PinLock`, `SessionComplete`, `AnalyticsDashboard`

### Tailwind Design System

**CSS custom properties** (`src/styles/index.css`) allow runtime theme switching:

```css
:root {
  --background: hsl(325.78 58.18% 93.73%);
  --primary: hsl(325.78 58.18% 56.86%);
  --ring: hsl(318.95 62.35% 66.47%); /* 4px focus rings */
  /* ... 15+ more color vars */
}

.parent-button {
  @apply min-h-[44px] px-6 text-base;
} /* WCAG AA */
.child-button {
  @apply min-h-[88px] px-8 text-2xl;
} /* Exceeds AAA */
```

**Flat shadow system** (neo-brutalism):

```css
--shadow-x: 3px;
--shadow-y: 3px;
--shadow-blur: 0px; /* No blur */
--shadow:
  3px 3px 0px 0px var(--shadow-color), 3px 1px 2px -1px var(--shadow-color);
```

**30+ themes** in `src/app/lib/themes.ts`:

```typescript
export const colorThemes: ColorTheme[] = [
  { id: "kawaii-pink", name: "Kawaii Pink", cssVariables: {...} },
  { id: "midnight-dark", name: "Midnight Dark", cssVariables: {...} },
  // ... 28 more themes
];

export function applyTheme(themeId: string): void {
  const theme = getThemeById(themeId);
  Object.entries(theme.cssVariables).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
}
```

**The `cn()` utility** (`src/lib/utils.ts`):

```typescript
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));  // Merges classes, resolves conflicts
}

// Usage:
<div className={cn("base-class", isActive && "active", className)} />
```

## Code Conventions

### React Query Pattern

**Location:** ALL data fetching in `src/app/api/supa.ts` (1133 lines)

**Key hooks by category:**

- _Lists:_ `useWordLists(userId)`, `useWordList(listId)`, `useCreateWordList()`, `useUpdateWordList()`, `useDeleteWordList()`
- _Words:_ `useCreateWord()`, `useUpdateWord()`, `useDeleteWordFromList()`, `useReorderWords()`, `useUploadAudio()`
- _SRS:_ `useCreateAttempt()`, `useDueWords(childId)`, `useUpdateSrs()`, `useHardestWords(limit)`
- _Analytics:_ `useSessionAnalytics(childId, timeRange)`, `useUserBadges(childId)`, `useAwardBadge()`

**Query pattern:** See state management section above for full examples
**Mutation pattern:** Always use optimistic updates with `onMutate`, `onError`, `onSettled`

### Audio Recording Pattern

See `src/app/hooks/useAudioRecorder.ts` for hook implementation and `src/app/components/AudioRecorder.tsx` for WaveSurfer.js integration. Returns Blob via `onRecordingComplete` callback.

## Testing & Debugging

### Offline Testing

1. DevTools > Network > "Offline"
2. Play game, record attempt
3. Check Application > IndexedDB > SpellStarsDB for `queuedAttempts` (synced: false)
4. Re-enable network, verify sync in console + Supabase dashboard

### Common Issues

**React Query not refetching:** Ensure query keys match in `invalidateQueries()`
**SRS not updating:** Check date format: `new Date().toISOString().split("T")[0]`
**Audio not uploading:** Test microphone permissions + MediaRecorder support
**Theme not applying:** Verify CSS variables set on `document.documentElement`

### Migration Debugging

```powershell
.\check-migrations.ps1  # List applied
.\check-schema.ps1      # Show schema
.\check-tables.ps1      # List tables
```

**Common errors:**

- "relation already exists" → Use `IF NOT EXISTS`
- "column does not exist" → Check migration order
- "permission denied" → Add RLS policy or use `SECURITY DEFINER`

## Common Tasks

### Adding a New Word List Feature

**Step 1: Add Database Column (if needed)**

```sql
-- Create migration: supabase/migrations/$(Get-Date -Format 'yyyyMMddHHmmss')_add_feature.sql
ALTER TABLE word_lists ADD COLUMN IF NOT EXISTS new_feature TEXT;

-- Add RLS policy if needed
CREATE POLICY "Parents can update own list features"
  ON word_lists
  FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
```

Apply migration:

```powershell
.\push-migration.ps1
```

**Step 2: Update TypeScript Types**

Regenerate from schema:

```powershell
# If using local Supabase
npx supabase gen types typescript --local > src/types/database.types.ts

# Or manually add to src/types/database.types.ts
export interface WordList {
  id: string;
  title: string;
  new_feature?: string;  // Add new field
  // ... other fields
}
```

**Step 3: Add React Query Hook**

In `src/app/api/supa.ts`:

```tsx
// Add mutation hook
export function useUpdateListFeature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listId,
      featureValue,
    }: {
      listId: string;
      featureValue: string;
    }) => {
      const { data, error } = await supabase
        .from("word_lists")
        .update({ new_feature: featureValue })
        .eq("id", listId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    onSuccess: (data, { listId }) => {
      // Invalidate related queries
      queryClient.invalidateQueries(["word-list", listId]);
      queryClient.invalidateQueries(["word-lists"]);
    },
  });
}
```

**Step 4: Add UI Component**

In `src/app/pages/parent/ListEditor.tsx` or new component:

```tsx
export function FeatureEditor({ listId }: { listId: string }) {
  const [value, setValue] = useState("");
  const updateFeature = useUpdateListFeature();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateFeature.mutateAsync({ listId, featureValue: value });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="parent-input"
      />
      <Button type="submit" disabled={updateFeature.isLoading}>
        Save Feature
      </Button>
    </form>
  );
}
```

**Step 5: Test**

```tsx
// In parent dashboard or list editor
<FeatureEditor listId="some-list-id" />

// Verify in Supabase dashboard:
// 1. Check word_lists table for updated new_feature column
// 2. Check RLS policies allow update
// 3. Test with child user to ensure read-only access
```

### Creating a New Game Mode

**Step 1: Create Page Component**

Create `src/app/pages/child/PlayNewMode.tsx`:

```tsx
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useWordList } from "@/app/api/supa";
import { useSessionStore } from "@/app/store/session";
import { useOnline } from "@/app/hooks/useOnline";
import { queueAttempt } from "@/lib/sync";

export function PlayNewMode() {
  const { listId } = useParams();
  const navigate = useNavigate();
  const isOnline = useOnline();

  const { data: list, isLoading } = useWordList(listId!);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionData, setSessionData] = useState({
    correct: 0,
    total: 0,
    startTime: Date.now(),
  });

  const currentWord = list?.words?.[currentIndex];

  const handleAttempt = async (correct: boolean) => {
    // Update session stats
    setSessionData((prev) => ({
      ...prev,
      correct: correct ? prev.correct + 1 : prev.correct,
      total: prev.total + 1,
    }));

    // Queue or insert attempt
    if (isOnline) {
      await createAttempt.mutateAsync({
        child_id: profile.id,
        word_id: currentWord.id,
        mode: "new-mode",
        correct,
        started_at: new Date().toISOString(),
      });
    } else {
      await queueAttempt(
        profile.id,
        currentWord.id,
        listId!,
        "new-mode",
        correct
      );
    }

    // Move to next word
    if (currentIndex < list!.words.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Session complete
      navigate("/child/home", {
        state: {
          sessionComplete: true,
          stats: sessionData,
        },
      });
    }
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="child-game-container">
      <h1 className="child-heading">{currentWord.text}</h1>

      {/* Game UI here */}
      <Button size="child" onClick={() => handleAttempt(true)}>
        Correct!
      </Button>
    </div>
  );
}
```

**Step 2: Add Route**

In `src/app/router.tsx`:

```tsx
import { PlayNewMode } from '@/app/pages/child/PlayNewMode';

// Add to child routes
{
  path: '/child/play-new-mode/:listId',
  element: (
    <ProtectedRoute requiredRole="child">
      <PlayNewMode />
    </ProtectedRoute>
  )
}
```

**Step 3: Add to Navigation**

In `src/app/pages/child/Home.tsx`:

```tsx
<Card>
  <h2>New Game Mode</h2>
  <Button
    size="child"
    onClick={() => navigate(`/child/play-new-mode/${listId}`)}
  >
    Play New Mode
  </Button>
</Card>
```

**Step 4: Cache Route for Offline Play**

In `vite.config.ts`:

```typescript
VitePWA({
  workbox: {
    runtimeCaching: [
      {
        urlPattern: /\/child\/play-new-mode\/.*/,
        handler: "CacheFirst",
        options: {
          cacheName: "child-routes-cache",
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 60 * 60 * 24 * 7,
          },
        },
      },
    ],
  },
});
```

**Step 5: Track in Session Analytics**

Update `useUpdateSrs()` call to handle new mode:

```tsx
// In PlayNewMode.tsx
const updateSrs = useUpdateSrs();

const handleAttempt = async (correct: boolean) => {
  // ... existing code ...

  // Update SRS if correct on first try
  if (correct && !hasTriedOnce) {
    await updateSrs.mutateAsync({
      childId: profile.id,
      wordId: currentWord.id,
      success: true,
    });
  }

  setHasTriedOnce(true);
};
```

### Modifying Parental Settings

**Step 1: Add Setting to Store**

In `src/app/store/parentalSettings.ts`:

```tsx
interface ParentalSettings {
  // ... existing settings ...
  newSetting: boolean; // Add new setting
}

const initialState: ParentalSettingsState = {
  // ... existing defaults ...
  newSetting: true, // Default value
};
```

**Step 2: Add to Database Schema (Optional)**

If you want to persist to database instead of localStorage:

```sql
-- Migration: supabase/migrations/$(Get-Date -Format 'yyyyMMddHHmmss')_add_setting.sql
ALTER TABLE parental_settings
  ADD COLUMN IF NOT EXISTS new_setting BOOLEAN DEFAULT TRUE;
```

**Step 3: Add UI Control**

In `src/app/pages/parent/Settings.tsx`:

```tsx
export function Settings() {
  const { settings, setSettings } = useParentalSettingsStore();

  return (
    <Card>
      <h2>Settings</h2>

      {/* Existing settings ... */}

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={settings.newSetting}
          onChange={(e) => setSettings({ newSetting: e.target.checked })}
          className="parent-checkbox"
        />
        <span>Enable New Setting</span>
      </label>
    </Card>
  );
}
```

**Step 4: Use Setting in Game Components**

In `src/app/pages/child/PlayListenType.tsx`:

```tsx
import { useParentalSettingsStore } from "@/app/store/parentalSettings";

export function PlayListenType() {
  const { settings } = useParentalSettingsStore();

  // Use setting to modify behavior
  if (settings.newSetting) {
    // Do something different
  }
}
```

### Adding a New Theme

**Step 1: Define Theme**

In `src/app/lib/themes.ts`:

```tsx
export const colorThemes: ColorTheme[] = [
  // ... existing themes ...
  {
    id: "my-new-theme",
    name: "My New Theme",
    description: "A custom theme with specific colors",
    cssVariables: {
      "--background": "hsl(0 0% 100%)",
      "--foreground": "hsl(222.2 47.4% 11.2%)",
      "--card": "hsl(0 0% 100%)",
      "--card-foreground": "hsl(222.2 47.4% 11.2%)",
      "--primary": "hsl(221.2 83.2% 53.3%)",
      "--primary-foreground": "hsl(210 40% 98%)",
      "--secondary": "hsl(210 40% 96.1%)",
      "--secondary-foreground": "hsl(222.2 47.4% 11.2%)",
      "--muted": "hsl(210 40% 96.1%)",
      "--muted-foreground": "hsl(215.4 16.3% 46.9%)",
      "--accent": "hsl(210 40% 96.1%)",
      "--accent-foreground": "hsl(222.2 47.4% 11.2%)",
      "--destructive": "hsl(0 100% 50%)",
      "--destructive-foreground": "hsl(210 40% 98%)",
      "--border": "hsl(214.3 31.8% 91.4%)",
      "--ring": "hsl(221.2 83.2% 53.3%)",
      "--shadow-color": "hsl(221.2 83.2% 53.3% / 0.3)",
      // ... other CSS variables
    },
  },
];
```

**Step 2: Add Preview**

Theme automatically appears in `ColorThemePicker` component. To customize preview:

In `src/app/components/ColorThemePicker.tsx`:

```tsx
// Component already renders all themes from themes.ts
// Preview shows primary, secondary, accent colors automatically
```

**Step 3: Test Theme**

```tsx
// Navigate to /child/theme or /parent/settings
// Click on new theme card
// Verify colors apply throughout app
// Check localStorage for persistence:
localStorage.getItem("theme-store"); // Should contain your theme ID
```

### Debugging TypeScript Errors

**Issue: "Property does not exist on type"**

Solution: Regenerate database types

```powershell
npx supabase gen types typescript --local > src/types/database.types.ts
```

**Issue: "Cannot find module"**

Solution: Check import paths match `tsconfig.json` alias:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Use: `import { X } from '@/app/...'` not `import { X } from '../../../app/...'`

**Issue: "Type 'X' is not assignable to type 'Y'"**

Solution: Check React Query return types:

```tsx
// Add explicit type to useQuery
const { data } = useQuery<WordList[]>(['word-lists', userId], ...);

// Or: Type the queryFn return
queryFn: async (): Promise<WordList[]> => { ... }
```

## Key Files Reference

### Core Application Files

**`src/app/main.tsx`** (~80 lines)

- React app entry point with React Query provider
- Imports and registers service worker via `registerSW()`
- Wraps app in `QueryClientProvider` and `RouterProvider`
- Calls `useAuth()` hook to initialize authentication state
- Shows loading screen while auth initializes

**`src/app/router.tsx`** (~150 lines)

- All route definitions using React Router 6
- Route protection layers:
  - Parent routes: `<ProtectedRoute requiredRole="parent">` + `<PinProtectedRoute>`
  - Child routes: `<ProtectedRoute requiredRole="child">` only
- Uses `<RootRedirect>` component for initial routing based on auth state
- Key routes:
  - `/` - Root redirect
  - `/login`, `/signup` - Authentication pages
  - `/parent/*` - Parent dashboard, lists, list editor, settings
  - `/child/*` - Child home, games (listen-type, say-spell), rewards, stickers, theme picker

**`src/app/supabase.ts`** (~20 lines)

- Supabase client initialization
- Reads env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Exported as singleton `supabase` instance
- Used by all API functions in `supa.ts`

**`vite.config.ts`** (~150 lines)

- Vite build configuration
- PWA plugin setup with Workbox strategies:
  - `NetworkFirst` for Supabase API (try network, fallback to cache)
  - `CacheFirst` for child routes (offline-first gameplay)
- Path aliases: `@/` maps to `src/`
- React plugin configuration
- Build optimizations (code splitting, tree shaking)

### State Management

**`src/app/store/auth.ts`** (~80 lines)

- Zustand store for authentication state
- State: `user` (Supabase User), `profile` (database profile with role), `isLoading`
- Actions: `setUser()`, `setProfile()`, `setIsLoading()`, `reset()`
- NOT persisted (ephemeral, reset on refresh)
- Populated by `useAuth()` hook via `supabase.auth.onAuthStateChange()`

**`src/app/store/parentalSettings.ts`** (~120 lines)

- Zustand store with `persist` middleware
- Persists to localStorage as `'parental-settings'`
- State: `pinCode` (hashed), `showHintsOnFirstMiss`, `enforceCaseSensitivity`, `autoReadbackSpelling`, `dailySessionLimitMinutes`, `defaultTtsVoice`, `isPinLocked`
- Lock state (`isPinLocked`) resets to `true` on app restart (security feature - NOT persisted)
- Actions: `setSettings()` (bulk update), `setPinCode()` (hashes PIN), `lock()`, `unlock()`

**`src/app/store/session.ts`** (~70 lines)

- Tracks active practice session (start time, words practiced, accuracy)
- State: `startTime`, `wordsAttempted`, `correctOnFirstTry`, `isActive`
- Actions: `startSession()`, `recordAttempt()`, `endSession()`, `reset()`
- Updates `session_analytics` table when session completes
- Enforces `dailySessionLimitMinutes` from parental settings

**`src/app/store/theme.ts`** (~60 lines)

- Persisted theme ID (one of 30+ themes from `themes.ts`)
- State: `themeId` (string, default 'kawaii-pink')
- Actions: `setTheme()` - updates state and calls `applyTheme()` from `themes.ts`
- Persists to localStorage as `'theme-store'`
- Auto-applies theme on store initialization

**`src/app/store/audioQueue.ts`** (~50 lines)

- Manages background audio queue for speech synthesis
- State: `queue` (array of audio URLs), `isPlaying`, `currentIndex`
- Actions: `addToQueue()`, `playNext()`, `clearQueue()`, `pause()`
- Used by TTS features and audio playback in games

### API Layer

**`src/app/api/supa.ts`** (1133 lines) - **CENTRAL DATA LAYER**

- ALL Supabase database operations
- Structure:
  - Lines 1-25: Type imports and aliases
  - Lines 27-400: Raw async functions (can be called directly)
  - Lines 400-1133: React Query hooks (primary interface)

Key Query Hooks:

- `useWordLists(userId)` - Get all lists for user with word counts
- `useWordList(listId)` - Get single list with full word array
- `useDueWords(childId)` - SRS words due today (where `due_date <= today`)
- `useSessionAnalytics(childId, timeRange)` - Practice statistics
- `useUserBadges(childId)` - Earned badges/stickers
- `useHardestWords(limit)` - Lowest ease factor words
- `useMostLapsedWords(limit)` - Most frequently missed words

Key Mutation Hooks:

- `useCreateWordList()` - Create new list (inserts to `word_lists`)
- `useUpdateWordList()` - Update list metadata (title, week_start_date)
- `useDeleteWordList()` - Delete list (cascades to `list_words` via FK)
- `useReorderWords()` - Update sort_index for drag-and-drop (with optimistic updates)
- `useCreateWord()` - Create word and add to list (inserts to `words` + `list_words`)
- `useUpdateWord()` - Update word text, phonetic, audio URL, TTS voice
- `useDeleteWordFromList()` - Remove word from list (deletes from `list_words`)
- `useUploadAudio()` - Upload to Storage and update `prompt_audio_url`
- `useCreateAttempt()` - Log spelling attempt (inserts to `attempts`)
- `useUpdateSrs()` - Upsert SRS entry after attempt (calculates next due date)
- `useAwardBadge()` - Award badge to child (inserts to `user_badges`)

### Database Operations

**`src/data/db.ts`** (~60 lines)

- Dexie IndexedDB schema definition
- Tables:
  - `queuedAttempts`: Offline attempt queue (child_id, word_id, list_id, mode, synced, created_at)
  - `queuedAudio`: Offline audio queue (blob, filename, synced, created_at)
- Exports singleton `db` instance
- Used by `sync.ts` for offline queue management

**`src/lib/sync.ts`** (~200 lines)

- Background sync orchestration for offline queue
- Key functions:
  - `syncQueuedData()` - Main sync function (audio first, then attempts)
  - `queueAttempt()` - Add attempt to offline queue
  - `queueAudio()` - Add audio Blob to offline queue
  - `hasPendingSync()` - Check if unsync records exist
- Critical flow:
  1. Query `queuedAudio` where `synced = false`
  2. Upload Blobs to Supabase Storage `word-audio` bucket
  3. Get storage URLs from upload response
  4. Query `queuedAttempts` where `synced = false`
  5. Map audio Blob IDs to storage URLs
  6. Insert attempts with audio URLs
  7. Mark records as `synced = true`
- Called automatically when `useOnline()` detects connection restored

**`supabase/migrations/`** (9 files)

- Database schema migrations in chronological order
- Naming: `YYYYMMDDHHMMSS_description.sql`
- Key migrations:
  1. `20241108000000_initial_schema.sql` - Core tables (profiles, word_lists, words, list_words, attempts)
  2. `20241109000001_add_word_audio_bucket.sql` - Storage bucket with RLS policies
  3. `20241109000004_add_srs_table.sql` - Spaced repetition system
  4. `20241109000005_add_parental_controls_analytics_badges.sql` - Settings, analytics, badges
  5. `20241109000006_add_color_theme.sql` - Theme preferences
- Applied via `.\push-migration.ps1` PowerShell script
- Uses Supabase Management API (not local CLI)

### Business Logic

**`src/lib/srs.ts`** (~150 lines)

- SM-2-lite spaced repetition algorithm (pure functions, no side effects)
- Key functions:
  - `calculateSrsOnSuccess(current)` - Increase ease (+0.1), calculate next interval
  - `calculateSrsOnMiss(current)` - Decrease ease (-0.2), reset interval to 0
  - `isDueToday(dueDate)` - Check if word should be practiced today
  - `isOverdue(dueDate, days)` - Check if word is overdue by X days
- Formulas:
  - Success: `ease = max(1.3, ease + 0.1)`, `interval = interval === 0 ? 1 : round(interval * ease)`
  - Miss: `ease = max(1.3, ease - 0.2)`, `interval = 0`
  - Due date: `today + interval days`
- Returns objects with new `ease`, `interval_days`, `due_date`, `reps`, `lapses`

**`src/lib/utils.ts`** (~20 lines)

- Utility functions
- `cn(...inputs)` - Combines clsx + tailwind-merge for smart class name merging
  - Handles conditional classes
  - Resolves Tailwind class conflicts (e.g., `px-4` + `px-6` → `px-6`)
  - Used in EVERY component

### Hooks

**`src/app/hooks/useAuth.ts`** (~120 lines)

- Authentication wrapper around `useAuthStore`
- Sets up `supabase.auth.onAuthStateChange` listener
- Fetches profile from database on session change
- Exports:
  - `user`, `profile`, `isLoading`, `isAuthenticated` (computed)
  - `signIn(email, password)`, `signUp(email, password, role)`, `signOut()`
- Automatically called in root component (`main.tsx`)

**`src/app/hooks/useOnline.ts`** (~15 lines)

- Detects network online/offline status
- Listens to `window.online` and `window.offline` events
- Returns boolean `isOnline`
- Triggers `syncQueuedData()` when connection restored
- Used in game components to decide: direct insert vs. queue attempt

**`src/app/hooks/useAudioRecorder.ts`** (~100 lines)

- MediaRecorder API abstraction
- State: `isRecording`, `audioBlob`, `audioUrl`, `duration`
- Functions:
  - `startRecording()` - Request microphone, start MediaRecorder
  - `stopRecording()` - Stop MediaRecorder, create Blob
  - `clearRecording()` - Reset state
  - `playRecording()` - Play audio preview
- Properly stops microphone stream via `stream.getTracks().forEach(track => track.stop())`
- Returns Blob for upload or queue

### Component Architecture

**`src/app/components/Button.tsx`** (~80 lines)

- Base button component using CVA pattern
- Variants: `default`, `secondary`, `outline`, `ghost`, `danger`
- Sizes: `default` (parent-button), `child` (child-button), `sm`, `lg`
- Uses `forwardRef` for ref forwarding
- Extends `ButtonHTMLAttributes` for native props
- Pattern used by ALL components in codebase

**`src/app/components/ProtectedRoute.tsx`** (~60 lines)

- Auth + role-based route protection
- Checks `isAuthenticated` from `useAuth()`
- Checks `profile.role` matches `requiredRole` prop
- Special case: Parents can access child routes (line 28)
- Redirects to `/login` if not authenticated
- Redirects to appropriate dashboard if wrong role

**`src/app/components/PinProtectedRoute.tsx`** (~50 lines)

- Additional PIN verification layer for parent routes
- Checks `isPinLocked` from `useParentalSettingsStore`
- Shows `<PinLock>` modal if locked and PIN is set
- Unlocks via `unlock()` action on correct PIN entry
- Cancel button navigates back to `/child/home`
- Only applies when `pinCode` is set (optional security)

**`src/app/components/AudioRecorder.tsx`** (~200 lines)

- Complex component integrating WaveSurfer.js with MediaRecorder
- Features:
  - Visual waveform display during recording/playback
  - Record/stop/play/delete controls
  - Duration timer
  - Audio preview before upload
- Props: `onRecordingComplete(blob, url)` callback
- Uses `useAudioRecorder()` hook internally
- Properly cleans up WaveSurfer instance on unmount

**`src/app/components/Navigation.tsx`** (~150 lines)

- Responsive navigation bar with role-based menu items
- Reads items from `src/app/components/navItems.tsx`
- Shows parent items (`/parent/*`) when `profile.role === 'parent'`
- Shows child items (`/child/*`) when `profile.role === 'child'`
- Mobile: Hamburger menu with slide-out drawer
- Desktop: Horizontal nav bar
- Includes sign out button

**`src/app/components/AnalyticsDashboard.tsx`** (~300 lines)

- Charts and graphs for parent dashboard
- Data from `useSessionAnalytics()` hook
- Charts:
  - Daily practice time (bar chart)
  - Accuracy over time (line chart)
  - Words practiced per session (bar chart)
  - Hardest words (table)
  - Most lapsed words (table)
- Time range filter: 7 days, 30 days, 90 days, all time
- Uses Chart.js or Recharts (check imports)

**`src/app/components/ColorThemePicker.tsx`** (~100 lines)

- Grid of theme cards showing color previews
- Reads all themes from `src/app/lib/themes.ts`
- Each card shows:
  - Theme name
  - Description
  - Color swatches (primary, secondary, accent)
- Click to apply theme via `useThemeStore.setTheme()`
- Highlights currently active theme
- Accessible via `/child/theme` and `/parent/settings`

### Theme System

**`src/app/lib/themes.ts`** (1000+ lines)

- 30+ predefined color themes
- Each theme: `{ id, name, description, cssVariables }`
- Theme categories:
  - Playful: kawaii-pink, bubblegum, cotton-candy
  - Professional: blue-scholar, midnight-dark, slate-gray
  - High-contrast: neon-future, cyberpunk, matrix
  - Nature: forest-green, ocean-breeze, sunset-glow
  - Accessibility: solarized-light, solarized-dark
- Functions:
  - `getThemeById(id)` - Lookup theme by ID
  - `applyTheme(id)` - Apply CSS custom properties to `:root`
  - `getAllThemes()` - Return full theme array
- CSS variables include: colors, shadows, typography, spacing

**`src/styles/index.css`** (~400 lines)

- Global styles and CSS custom properties
- Defines all CSS variables used by Tailwind config
- Custom utility classes:
  - `.parent-button` - 44px min height (WCAG 2.1 AA)
  - `.child-button` - 88px min height (exceeds WCAG AAA)
  - `.focus-visible` - 4px focus ring
- Flat shadow system (neo-brutalism style):
  - No blur (`--shadow-blur: 0px`)
  - Solid offset shadows
- Typography scale and font families
- Animation keyframes

### PowerShell Scripts

**`push-migration.ps1`** (~80 lines)

- Applies ALL migrations in `supabase/migrations/` directory
- Reads `SUPABASE_ACCESS_TOKEN` from Doppler
- Sorts migrations alphabetically (hence timestamp naming importance)
- POSTs each SQL file to Supabase Management API
- Shows ✓ or ✗ for each migration with error details
- Idempotent (safe to run multiple times with `IF NOT EXISTS` clauses)

**`check-migrations.ps1`** (~40 lines)

- Queries `supabase_migrations.schema_migrations` table
- Lists all applied migrations with timestamps
- Uses Supabase Management API

**`check-schema.ps1`** (~50 lines)

- Introspects database schema via Management API
- Shows tables, columns, types, constraints
- Useful for verifying migration effects

**`check-tables.ps1`** (~30 lines)

- Quick list of all tables in public schema
- Uses Management API query endpoint

**`record-migration.ps1`** (~60 lines)

- Documentation helper for tracking migration purposes
- Usage: `.\record-migration.ps1 -MigrationName "description"`
- Appends to migration log file

### Documentation

**`docs/database-schema.md`** (~500 lines)

- Complete database schema reference
- All tables with columns, types, constraints, indexes
- RLS policies for each table
- Foreign key relationships
- Storage bucket configuration

**`docs/SRS_IMPLEMENTATION.md`** (~200 lines)

- Spaced repetition system deep dive
- SM-2-lite algorithm explanation with formulas
- Integration points in codebase
- Example calculations
- Testing procedures

**`PROJECT_SUMMARY.md`** (~300 lines)

- High-level project overview
- Feature list with implementation status
- Tech stack summary
- Deployment instructions
- Known issues and roadmap
