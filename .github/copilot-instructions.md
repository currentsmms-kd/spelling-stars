# SpellStars - AI Coding Agent Instructions

## Project Overview

SpellStars is a Progressive Web App (PWA) designed to help children practice spelling through interactive games. The application features a **sophisticated dual-interface architecture** where parents manage content and children engage in gameplay, with carefully designed separation of concerns and security boundaries.

### Core Philosophy

- **Offline-first**: IndexedDB queue ensures no data loss during network outages
- **Accessibility-first**: WCAG 2.1 AA compliant with 88px child buttons, 44px parent buttons, 4px focus rings
- **Performance-first**: Code splitting, optimistic updates, CacheFirst for child routes
- **Security-first**: Row Level Security (RLS) on all tables, PIN-protected parent routes, role-based authentication

### Tech Stack

**Frontend:**

- React 18 (with strict mode) + TypeScript 5.2+ (strict)
- Vite 5.1+ (build tool with HMR)
- TanStack React Query 5.24+ (server state)
- Zustand 4.5+ (client state with persist middleware)
- React Router DOM 6.22+ (routing)

**UI & Styling:**

- Tailwind CSS 3.4+ (utility-first)
- class-variance-authority (CVA) - ALL components use this pattern
- Lucide React (icons)
- WaveSurfer.js 7.7+ (audio visualization)

**Backend & Storage:**

- Supabase (PostgreSQL + Auth + Storage)
- Dexie 3.2+ (IndexedDB abstraction)
- vite-plugin-pwa 0.19+ (Workbox service worker)

**Environment Management:**

- Doppler (secrets management - used in all npm scripts)
- PowerShell scripts (migration management)

## Architecture & Data Flow

### Two-Tier Interface Design

The application has **distinct security boundaries** for parent and child areas:

**Parent routes** (`/parent/*`):

- Protected by `<ProtectedRoute requiredRole="parent">` (auth + role check)
- **THEN** wrapped in `<PinProtectedRoute>` (PIN verification)
- PIN stored hashed in `useParentalSettingsStore` (persisted to localStorage)
- `isPinLocked` state resets on app restart (always locked by default)
- Parents can also access child routes (for preview/testing) - see `ProtectedRoute.tsx` line 28

**Child routes** (`/child/*`):

- Only protected by `<ProtectedRoute requiredRole="child">`
- No PIN requirement (children should access directly)
- Routes are cached offline with `CacheFirst` strategy in `vite.config.ts`

**Authentication Flow:**

1. User signs in via Supabase Auth (`useAuth` hook)
2. Profile auto-created via database trigger (`handle_new_user()` function)
3. `role` field from signup metadata determines access level
4. `supabase.auth.onAuthStateChange` keeps Zustand store synchronized
5. `RootRedirect` component handles initial routing based on role

### State Management Strategy

**Why three different state solutions?**

1. **Zustand stores** (ephemeral + persisted client state):
   - `useAuthStore` (`src/app/store/auth.ts`):
     - `user`: Supabase User object
     - `profile`: Database profile with role
     - `isLoading`: Auth initialization state
     - Pattern: Set via `useAuth()` hook, never modified directly in components

   - `useParentalSettingsStore` (`src/app/store/parentalSettings.ts`):
     - Uses `persist` middleware (syncs to localStorage as `parental-settings`)
     - Settings: `pinCode`, `showHintsOnFirstMiss`, `enforceCaseSensitivity`, etc.
     - Lock state (`isPinLocked`) NOT persisted (security feature)
     - Pattern: Use `setSettings()` for bulk updates, `setPinCode()` for PIN changes

   - `useThemeStore` (`src/app/store/theme.ts`):
     - Persisted theme ID (one of 30+ themes from `src/app/lib/themes.ts`)
     - `applyTheme()` function modifies CSS custom properties on `:root`
     - Children can switch themes from `/child/theme` page

   - `useSessionStore` (`src/app/store/session.ts`):
     - Tracks active gameplay session (start time, words practiced, accuracy)
     - Updates `session_analytics` table on session complete
     - Enforces `dailySessionLimitMinutes` from parental settings

2. **React Query** (server state with automatic caching/invalidation):

   **Location:** ALL data fetching in `src/app/api/supa.ts` (1133 lines)

   **Query Pattern:**

   ```tsx
   export function useWordLists(userId: string) {
     return useQuery({
       queryKey: ["word-lists", userId],
       queryFn: async () => {
         const { data, error } = await supabase
           .from("word_lists")
           .select("*, list_words(count)")
           .eq("created_by", userId)
           .order("created_at", { ascending: false });
         if (error) throw error;
         return data;
       },
       enabled: !!userId,
       staleTime: 1000 * 60 * 5, // 5 minutes
     });
   }
   ```

   **Mutation Pattern with Optimistic Updates:**

   ```tsx
   export function useReorderWords() {
     const queryClient = useQueryClient();
     return useMutation({
       mutationFn: async ({
         listId,
         words,
       }: {
         listId: string;
         words: WordWithIndex[];
       }) => {
         // Update sort_index for each word
         const updates = words.map((word, index) =>
           supabase
             .from("list_words")
             .update({ sort_index: index })
             .eq("list_id", listId)
             .eq("word_id", word.id)
         );
         await Promise.all(updates);
       },
       onMutate: async ({ listId, words }) => {
         // Cancel outgoing refetches
         await queryClient.cancelQueries(["word-list", listId]);
         // Snapshot previous value
         const previous = queryClient.getQueryData(["word-list", listId]);
         // Optimistically update
         queryClient.setQueryData(["word-list", listId], (old: any) => ({
           ...old,
           words,
         }));
         return { previous };
       },
       onError: (err, { listId }, context) => {
         // Rollback on error
         queryClient.setQueryData(["word-list", listId], context?.previous);
       },
       onSettled: (data, error, { listId }) => {
         // Refetch after mutation
         queryClient.invalidateQueries(["word-list", listId]);
       },
     });
   }
   ```

   **Query Key Convention:**
   - `['word-lists', userId]` - All lists for user
   - `['word-list', listId]` - Single list with words
   - `['due-words', childId]` - SRS words due today
   - `['session-analytics', childId, timeRange]` - Analytics data

   **Why React Query instead of more Zustand?**
   - Automatic background refetching
   - Built-in loading/error states
   - Request deduplication (multiple components can call same hook)
   - Automatic garbage collection of unused queries
   - Optimistic updates with rollback on error

3. **Dexie (IndexedDB)** for offline queue:

   **Schema** (`src/data/db.ts`):

   ```tsx
   export class SpellStarsDB extends Dexie {
     queuedAttempts!: Table<QueuedAttempt>;
     queuedAudio!: Table<QueuedAudio>;

     constructor() {
       super("SpellStarsDB");
       this.version(1).stores({
         queuedAttempts:
           "++id, child_id, word_id, list_id, mode, synced, created_at",
         queuedAudio: "++id, filename, synced, created_at",
       });
     }
   }
   ```

   **Sync Flow** (`src/lib/sync.ts`):
   1. `syncQueuedData()` called when app detects online status via `useOnline()` hook
   2. First syncs `queuedAudio` (uploads Blobs to Supabase Storage)
   3. Then syncs `queuedAttempts` (inserts into `attempts` table with audio URLs)
   4. Marks records as `synced: true` to prevent re-upload
   5. Failed uploads remain in queue for next sync attempt

   **Usage in game components:**

   ```tsx
   const isOnline = useOnline();

   const handleAttemptComplete = async (correct: boolean, answer: string) => {
     if (isOnline) {
       // Direct insert to Supabase
       await createAttempt.mutateAsync({
         word_id,
         correct,
         typed_answer: answer,
       });
     } else {
       // Queue for later sync
       await queueAttempt(
         childId,
         wordId,
         listId,
         "listen-type",
         correct,
         answer
       );
     }
   };
   ```

### Database Schema Deep Dive

**Core Tables with RLS Policies:**

1. **`profiles`** (User accounts)
   - `id` (uuid, PK, FK to auth.users)
   - `email` (text, unique)
   - `role` (text, CHECK in ('parent', 'child'))
   - RLS: Users can only view/update their own profile
   - Created via trigger on `auth.users` insert

2. **`word_lists`** (Parent-created spelling lists)
   - `id` (uuid, PK)
   - `title` (text, required)
   - `week_start_date` (date, nullable - for weekly planning)
   - `created_by` (uuid, FK to profiles)
   - RLS: Parents can CRUD own lists; children can read any list
   - Migration: `20241108000000_initial_schema.sql`

3. **`words`** (Individual vocabulary items)
   - `id` (uuid, PK)
   - `text` (text, the spelling word)
   - `phonetic` (text, nullable - IPA or simplified pronunciation)
   - `prompt_audio_url` (text, nullable - custom recording path)
   - `tts_voice` (text, nullable - override default TTS voice)
   - RLS: Created by parents; readable by all authenticated users
   - Migration: Added `tts_voice` in `20241109000005`

4. **`list_words`** (Junction table for many-to-many)
   - `list_id` (uuid, FK to word_lists)
   - `word_id` (uuid, FK to words)
   - `sort_index` (integer, for drag-and-drop ordering)
   - Composite PK: (list_id, word_id)
   - RLS: Managed by parents; readable by all
   - **Why separate junction table?** Allows same word in multiple lists with different ordering

5. **`attempts`** (Child practice history)
   - `id` (uuid, PK)
   - `child_id` (uuid, FK to profiles)
   - `word_id` (uuid, FK to words)
   - `mode` (text, 'listen-type' or 'say-spell')
   - `correct` (boolean, first-try correctness)
   - `typed_answer` (text, nullable - for listen-type mode)
   - `audio_url` (text, nullable - for say-spell mode)
   - `started_at` (timestamptz)
   - RLS: Children insert own attempts; parents can read all
   - Indexes: `idx_attempts_child_word`, `idx_attempts_child_date`

6. **`srs`** (Spaced Repetition System state)
   - `id` (uuid, PK)
   - `child_id` (uuid, FK to profiles)
   - `word_id` (uuid, FK to words)
   - `ease` (real, default 2.5, min 1.3) - difficulty factor
   - `interval_days` (integer, default 0) - days until next review
   - `due_date` (date, default today) - when word should be practiced
   - `reps` (integer, default 0) - successful repetitions count
   - `lapses` (integer, default 0) - number of misses
   - Unique constraint: (child_id, word_id)
   - Indexes: `idx_srs_child_due`, `idx_srs_due_date`
   - RLS: Children manage own SRS; parents can read all
   - Migration: `20241109000004_add_srs_table.sql`

7. **`parental_settings`** (Parent preferences)
   - `parent_id` (uuid, FK to profiles, unique)
   - `pin_code` (text, hashed)
   - `show_hints_on_first_miss` (boolean, default true)
   - `enforce_case_sensitivity` (boolean, default false)
   - `auto_readback_spelling` (boolean, default true)
   - `daily_session_limit_minutes` (integer, default 20)
   - `default_tts_voice` (text, default 'en-US')
   - RLS: Parents manage own settings; never readable by children
   - Migration: `20241109000005`

8. **`session_analytics`** (Practice session tracking)
   - `child_id` (uuid, FK to profiles)
   - `session_date` (date, default current_date)
   - `session_duration_seconds` (integer)
   - `words_practiced` (integer)
   - `correct_on_first_try` (integer)
   - `total_attempts` (integer)
   - Index: `idx_session_analytics_child_date`
   - Used by `AnalyticsDashboard` component in parent area

9. **`badges`** + **`user_badges`** (Achievement system)
   - `badges`: Defines available achievements
   - `user_badges`: Tracks which children earned which badges
   - Badge keys: 'first_word', 'streak_7', 'perfect_10', etc.
   - Displayed in `/child/stickers` page

**Storage Buckets:**

- **`word-audio`**:
  - Path: `lists/{listId}/words/{wordId}.webm`
  - Public read access (children need to hear words)
  - Parent write access (only parents upload audio)
  - Migration: `20241109000001_add_word_audio_bucket.sql`
  - Max file size: 10MB
  - Allowed MIME types: audio/webm, audio/mp4, audio/wav

### SRS (Spaced Repetition System) Implementation

**Algorithm:** SM-2-lite (simplified SuperMemo 2)

**Location:** `src/lib/srs.ts` (pure functions, no side effects)

**On Correct First Try:**

```typescript
ease = max(1.3, currentEase + 0.1)
interval = currentInterval === 0 ? 1 : round(currentInterval * ease)
due_date = today + interval days
reps = currentReps + 1
lapses = currentLapses (unchanged)
```

**On Miss (not first try):**

```typescript
ease = max(1.3, currentEase - 0.2)
interval = 0 (due immediately)
due_date = today
reps = currentReps (unchanged)
lapses = currentLapses + 1
```

**Integration Points:**

1. `PlayListenType.tsx` and `PlaySaySpell.tsx` call `useUpdateSrs()` mutation after each attempt
2. Tracks `hasTriedOnce` state to determine first-try status
3. `useUpdateSrs()` in `supa.ts` upserts SRS entry (creates if missing)
4. Child home page (`Home.tsx`) displays "Due Today" words where `due_date <= today`
5. Parent dashboard shows "Hardest Words" (lowest ease) and "Most Lapsed Words"

**Why SM-2-lite instead of full SM-2?**

- Simpler to implement and understand
- No "hard/good/easy" buttons (just correct/incorrect)
- Sufficient for elementary spelling practice
- Ease factor prevents words from getting stuck

## Development Workflows

### Running the App

```powershell
# With Doppler (RECOMMENDED - production-like environment)
npm run dev  # Executes: doppler run -- vite

# Without Doppler (requires manual .env file)
npm run dev:local

# Build for production
npm run build  # Executes: doppler run -- tsc && vite build

# Preview production build
npm run preview  # Executes: doppler run -- vite preview
```

**Why Doppler?**

- Secrets never stored in .env files (avoided in .gitignore)
- `SUPABASE_ACCESS_TOKEN` needed for migration scripts
- `doppler run --` prefix injects env vars before command execution
- Config stored in Doppler cloud at `spelling-stars/dev/dev`

**Required Environment Variables:**

- `VITE_SUPABASE_URL` - Project URL from Supabase dashboard
- `VITE_SUPABASE_ANON_KEY` - Public anon key (safe for client-side)
- `SUPABASE_ACCESS_TOKEN` - Management API token (for migrations only)

**Setting up Doppler locally:**

```powershell
# Install Doppler CLI
scoop install doppler  # or download from doppler.com

# Login and setup project
doppler login
doppler setup

# Verify environment
doppler secrets
```

### Database Migrations

**PowerShell Scripts** (all fetch `SUPABASE_ACCESS_TOKEN` from Doppler):

1. **`push-migration.ps1`** - Main migration script:

   ```powershell
   # Applies ALL .sql files in supabase/migrations/ in alphabetical order
   # Uses Supabase Management API (not local CLI)
   # Safe to run multiple times (idempotent SQL recommended)
   .\push-migration.ps1
   ```

   Implementation details:
   - Reads all `*.sql` files from `supabase/migrations/`
   - Sorts by filename (hence timestamp prefix importance)
   - POSTs each file to `/v1/projects/{projectRef}/database/query`
   - Shows ✓ or ✗ for each migration with error details

2. **`check-migrations.ps1`** - List applied migrations:

   ```powershell
   # Queries `supabase_migrations.schema_migrations` table
   .\check-migrations.ps1
   ```

3. **`check-schema.ps1`** - Show current schema:

   ```powershell
   # Introspects database schema via Management API
   .\check-schema.ps1
   ```

4. **`check-tables.ps1`** - List all tables:

   ```powershell
   # Quick table listing for verification
   .\check-tables.ps1
   ```

5. **`record-migration.ps1`** - Helper for documentation:
   ```powershell
   # Documents what each migration does
   # Usage: .\record-migration.ps1 -MigrationName "add_srs_table"
   ```

**Migration File Naming Convention:**

- Format: `YYYYMMDDHHMMSS_description.sql`
- Example: `20241109000001_add_word_audio_bucket.sql`
- Timestamp ensures chronological ordering
- Description should be snake_case and descriptive

**Current Migrations (in order):**

1. `20241108000000_initial_schema.sql` - Core tables (profiles, word_lists, words, attempts)
2. `20241108000003_safe_schema_update.sql` - Schema adjustments
3. `20241108000004_safe_seed_data.sql` - Initial data
4. `20241109000001_add_word_audio_bucket.sql` - Storage bucket creation
5. `20241109000002_fix_profile_rls.sql` - RLS policy fixes
6. `20241109000003_simplify_profile_rls.sql` - RLS simplification
7. `20241109000004_add_srs_table.sql` - Spaced repetition system
8. `20241109000005_add_parental_controls_analytics_badges.sql` - New feature tables
9. `20241109000006_add_color_theme.sql` - Theme preferences

**Creating a New Migration:**

1. Create file: `supabase/migrations/$(Get-Date -Format 'yyyyMMddHHmmss')_your_description.sql`
2. Write idempotent SQL (use `IF NOT EXISTS`, `IF EXISTS`, etc.)
3. Include RLS policies for new tables
4. Test locally first (if using local Supabase)
5. Run `.\push-migration.ps1` to apply
6. Verify with `.\check-tables.ps1`

### PWA & Offline Support

**Service Worker Configuration** (`vite.config.ts`):

```typescript
VitePWA({
  registerType: "autoUpdate",
  workbox: {
    globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
    runtimeCaching: [
      {
        // Supabase API: Try network first, fallback to cache
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "supabase-cache",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24, // 24 hours
          },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        // Child routes: Cache first for offline play
        urlPattern: /\/child\/.*/,
        handler: "CacheFirst",
        options: {
          cacheName: "child-routes-cache",
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
          },
        },
      },
    ],
  },
});
```

**Offline Data Flow:**

1. **Detection:** `useOnline()` hook listens to `window.online/offline` events
2. **Queue Attempt:**
   ```typescript
   if (!isOnline) {
     await db.queuedAttempts.add({
       child_id,
       word_id,
       list_id,
       mode,
       is_correct,
       typed_answer,
       audio_blob_id,
       created_at: new Date().toISOString(),
       synced: false,
     });
   }
   ```
3. **Queue Audio:**
   ```typescript
   const blobId = await db.queuedAudio.add({
     blob: audioBlob,
     filename: `${wordId}-${Date.now()}.webm`,
     created_at: new Date().toISOString(),
     synced: false,
   });
   ```
4. **Background Sync** (triggered on connection restore):
   - Service worker detects online event
   - Calls `syncQueuedData()` from `src/lib/sync.ts`
   - Uploads audio files first (generates storage URLs)
   - Inserts attempts with audio URLs
   - Marks records as `synced: true`

**Testing Offline Functionality:**

1. Open DevTools > Network tab
2. Select "Offline" from throttling dropdown
3. Play a game, record audio
4. Check Application tab > IndexedDB > SpellStarsDB
5. Verify `queuedAttempts` and `queuedAudio` have unsync records
6. Re-enable network
7. Watch for automatic sync in console logs
8. Verify data appears in Supabase dashboard

### TypeScript Configuration

**Strict Mode Enabled** (`tsconfig.json`):

- `strict: true`
- `noUncheckedIndexedAccess: true` (prevents undefined array access bugs)
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noImplicitReturns: true`

**Generated Types:** `src/types/database.types.ts`

- Auto-generated from Supabase schema
- Regenerate after migrations: `npx supabase gen types typescript --local > src/types/database.types.ts`
- Provides type safety for all database operations

## Component & Styling Patterns

### Component Structure

**ALL components use class-variance-authority (CVA)** for variant styling:

```tsx
// Example from Button.tsx
const buttonVariants = cva(
  // Base classes (always applied)
  "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/90",
        outline:
          "border-2 border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        danger:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        default: "parent-button", // CSS class defined in styles/index.css
        child: "child-button", // 88px min height for children
        sm: "h-9 px-3 text-sm",
        lg: "h-12 px-8 text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
```

**Shared Components:**

1. **`Button`** - 5 variants, 4 sizes, forwardRef pattern
2. **`Card`** - Container with optional hover states
3. **`AudioRecorder`** - Complex component with WaveSurfer.js integration:
   - Manages MediaRecorder API via `useAudioRecorder()` hook
   - Visual waveform with play/pause/record/delete controls
   - Returns Blob and URL via `onRecordingComplete` callback
   - Shows duration timer during recording
   - Properly cleans up MediaRecorder and stream tracks
4. **`Navigation`** - Responsive nav with role-based menu items
5. **`PinLock`** - 4-digit PIN entry screen with numeric keypad
6. **`ProtectedRoute`** - Auth + role checking wrapper
7. **`PinProtectedRoute`** - Additional PIN verification layer
8. **`RootRedirect`** - Initial routing logic based on auth state
9. **`SessionComplete`** - End-of-session stats modal
10. **`AnalyticsDashboard`** - Charts and graphs for parent area
11. **`ThemeToggle`** - Dark/light mode switcher (now theme picker)
12. **`ColorThemePicker`** - Grid of 30+ theme options
13. **`RewardStar`** - Animated star icon for celebrations

### Tailwind CSS Custom Design System

**CSS Variables Architecture** (`src/styles/index.css`):

The app uses **CSS custom properties** for theming, defined in `:root` for light mode and `.dark` class for dark mode. This allows runtime theme switching without CSS recompilation.

**Color Variables:**

```scss
:root {
  /* Kawaii Pink Theme (default) */
  --background: hsl(325.78 58.18% 93.73%);
  --foreground: hsl(0 0% 35.69%);
  --card: hsl(42.86 88.64% 90.78%);
  --card-foreground: hsl(0 0% 35.69%);
  --primary: hsl(325.78 58.18% 56.86%);
  --primary-foreground: hsl(300 33.33% 97.45%);
  --secondary: hsl(183.4 37.14% 67.65%);
  --muted: hsl(186.67 62.16% 79.61%);
  --accent: hsl(44.19 93.02% 82.75%);
  --destructive: hsl(359.13 92.52% 71.18%);
  --border: hsl(325.78 58.18% 56.86%);
  --ring: hsl(318.95 62.35% 66.47%);
  /* ... more colors */
}
```

**Custom Utility Classes:**

```css
.parent-button {
  @apply min-h-[44px] px-6 text-base;
  /* WCAG 2.1 AA minimum touch target */
}

.child-button {
  @apply min-h-[88px] px-8 text-2xl font-bold;
  /* Extra-large for children - exceeds WCAG 2.1 AAA */
}
```

**Flat Shadow System:**
The app uses a **flat shadow design** (inspired by neo-brutalism) instead of standard drop shadows:

```css
:root {
  --shadow-x: 3px;
  --shadow-y: 3px;
  --shadow-blur: 0px; /* No blur for flat look */
  --shadow-color: hsl(325.78 58.18% 56.86% / 0.5);

  /* Composed shadows */
  --shadow:
    3px 3px 0px 0px var(--shadow-color), 3px 1px 2px -1px var(--shadow-color);
}
```

Usage in Tailwind config:

```javascript
theme: {
  extend: {
    boxShadow: {
      '2xs': 'var(--shadow-2xs)',
      xs: 'var(--shadow-xs)',
      sm: 'var(--shadow-sm)',
      DEFAULT: 'var(--shadow)',
      md: 'var(--shadow-md)',
      lg: 'var(--shadow-lg)',
      xl: 'var(--shadow-xl)',
      '2xl': 'var(--shadow-2xl)'
    }
  }
}
```

**Typography Variables:**

```css
:root {
  --font-sans: Pangolin, cursive; /* Playful handwriting font */
  --font-serif: Merriweather, ui-serif, serif;
  --font-mono: Cousine, ui-monospace, monospace;
  --tracking-normal: 0em; /* Letter spacing */
  --spacing: 0.25rem; /* Base spacing unit */
}
```

**30+ Predefined Themes** (`src/app/lib/themes.ts`):

Themes are objects with `id`, `name`, `description`, and `cssVariables` properties:

```typescript
export interface ColorTheme {
  id: string;
  name: string;
  description: string;
  cssVariables: Record<string, string>;
}

export const colorThemes: ColorTheme[] = [
  {
    id: "kawaii-pink",
    name: "Kawaii Pink",
    description: "Playful pink theme perfect for kids",
    cssVariables: {
      /* all CSS custom properties */
    },
  },
  {
    id: "midnight-dark",
    name: "Midnight Dark",
    description: "Easy on the eyes dark theme",
    cssVariables: {
      /* dark mode colors */
    },
  },
  // ... 28 more themes
];
```

**Theme Application:**

```typescript
export function applyTheme(themeId: string): void {
  const theme = getThemeById(themeId);
  const root = document.documentElement;

  // Apply CSS variables
  Object.entries(theme.cssVariables).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  // Add theme class
  root.classList.add(themeId);

  // Add 'dark' class for compatibility
  if (themeId.endsWith("-dark")) {
    root.classList.add("dark");
  }
}
```

Children can switch themes from `/child/theme` page, selection persisted in `useThemeStore`.

### Utility Function Pattern

**The `cn()` function** (`src/lib/utils.ts`):

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Why both clsx and tailwind-merge?**

- `clsx`: Efficiently handles conditional classes
- `twMerge`: Intelligently merges Tailwind classes (prevents conflicts)

**Usage patterns:**

```tsx
// Conditional classes
<div className={cn(
  "base-classes",
  isActive && "active-classes",
  isError && "error-classes"
)} />

// Merging prop classes
<div className={cn("default-classes", className)} />

// Complex conditions
<div className={cn(
  "base",
  {
    "variant-a": variant === 'a',
    "variant-b": variant === 'b',
  },
  size === 'large' && "large-size"
)} />
```

### Accessibility Features

**Focus Ring System:**

```scss
:root {
  --ring: hsl(318.95 62.35% 66.47%);
}

/* Applied via Tailwind utilities */
.focus-visible:focus-visible {
  outline: 4px solid var(--ring);
  outline-offset: 2px;
}
```

**ARIA Labels:**

- All audio controls have `aria-label`
- Buttons have descriptive labels
- Form inputs have associated labels
- Icons have `aria-hidden="true"` when decorative

**Reduced Motion:**

```tsx
// Respect prefers-reduced-motion
<div
  className={cn(
    "transition-transform",
    !prefersReducedMotion && "animate-bounce"
  )}
/>
```

**Keyboard Navigation:**

- All interactive elements are keyboard accessible
- Logical tab order
- Focus trapping in modals
- Escape key closes modals

## Code Conventions

### React Query Hook Pattern

**Location:** ALL data fetching in `src/app/api/supa.ts` (1133 lines)

**File Structure:**

1. Type imports and aliases (lines 1-25)
2. Raw async functions for direct calls (lines 27-400)
3. React Query hooks (lines 400-1133)

**Query Hook Example:**

```tsx
export function useWordLists(userId: string) {
  return useQuery({
    queryKey: ["word-lists", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("word_lists")
        .select("*, list_words(count)") // Joined query with count
        .eq("created_by", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId, // Don't run if no userId
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 mins
  });
}
```

**Mutation Hook with Optimistic Updates:**

```tsx
export function useReorderWords() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listId,
      words,
    }: {
      listId: string;
      words: WordWithIndex[];
    }) => {
      // Batch update all word sort indices
      const updates = words.map((word, index) =>
        supabase
          .from("list_words")
          .update({ sort_index: index })
          .eq("list_id", listId)
          .eq("word_id", word.id)
      );
      const results = await Promise.all(updates);

      // Check for errors
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) throw firstError;
    },

    // Optimistic update: Update cache before server response
    onMutate: async ({ listId, words }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries(["word-list", listId]);

      // Snapshot the previous value
      const previousList = queryClient.getQueryData(["word-list", listId]);

      // Optimistically update to the new value
      queryClient.setQueryData(["word-list", listId], (old: any) => ({
        ...old,
        words, // Replace words array with new order
      }));

      // Return context with snapshot
      return { previousList };
    },

    // On error, roll back to the snapshot
    onError: (err, { listId }, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(["word-list", listId], context.previousList);
      }
      console.error("Failed to reorder words:", err);
    },

    // Always refetch after error or success
    onSettled: (data, error, { listId }) => {
      queryClient.invalidateQueries(["word-list", listId]);
    },
  });
}
```

**Available Hooks by Category:**

_Word Lists:_

- `useWordLists(userId)` - Get all lists for user
- `useWordList(listId)` - Get single list with all words
- `useCreateWordList()` - Create new list
- `useUpdateWordList()` - Update list metadata
- `useDeleteWordList()` - Delete list (cascades to list_words)
- `useDuplicateWordList()` - Clone existing list

_Words:_

- `useCreateWord()` - Create word and add to list
- `useUpdateWord()` - Update word properties
- `useDeleteWordFromList()` - Remove word from list
- `useReorderWords()` - Update sort indices
- `useUploadAudio()` - Upload to Storage and update word

_Attempts & SRS:_

- `useCreateAttempt()` - Log spelling attempt
- `useDueWords(childId)` - Get words due today
- `useUpdateSrs()` - Update SRS after attempt
- `useHardestWords(limit)` - Lowest ease words
- `useMostLapsedWords(limit)` - Most missed words

_Analytics & Rewards:_

- `useSessionAnalytics(childId, timeRange)` - Get practice stats
- `useUserBadges(childId)` - Get earned badges
- `useAwardBadge()` - Award new badge

### Authentication Flow

**Complete Flow with Code References:**

1. **App Initialization** (`src/app/main.tsx`):

   ```tsx
   // useAuth hook called in root component
   function App() {
     const { isLoading } = useAuth();
     if (isLoading) return <LoadingScreen />;
     return <RouterProvider router={router} />;
   }
   ```

2. **Auth Hook Setup** (`src/app/hooks/useAuth.ts`):

   ```tsx
   export function useAuth() {
     const { user, profile, isLoading, setUser, setProfile, setIsLoading } =
       useAuthStore();

     useEffect(() => {
       // Get initial session
       supabase.auth.getSession().then(({ data: { session } }) => {
         setUser(session?.user ?? null);
         if (session?.user) {
           fetchProfile(session.user.id);
         }
       });

       // Listen for changes (sign in, sign out, token refresh)
       const {
         data: { subscription },
       } = supabase.auth.onAuthStateChange((_event, session) => {
         setUser(session?.user ?? null);
         if (session?.user) {
           fetchProfile(session.user.id);
         } else {
           setProfile(null);
           setIsLoading(false);
         }
       });

       return () => subscription.unsubscribe();
     }, []);

     return { user, profile, isLoading, signIn, signUp, signOut };
   }
   ```

3. **Profile Fetching:**

   ```tsx
   const fetchProfile = async (userId: string) => {
     const { data, error } = await supabase
       .from("profiles")
       .select("*")
       .eq("id", userId)
       .single();

     if (error) console.error("Error fetching profile:", error);
     else setProfile(data);
     setIsLoading(false);
   };
   ```

4. **Route Protection** (`src/app/components/ProtectedRoute.tsx`):

   ```tsx
   export function ProtectedRoute({
     children,
     requiredRole,
   }: ProtectedRouteProps) {
     const { isAuthenticated, isLoading, profile } = useAuth();

     if (isLoading) return <LoadingScreen />;
     if (!isAuthenticated) return <Navigate to="/login" />;

     // Special case: Parents can access child routes
     if (requiredRole && profile?.role !== requiredRole) {
       if (profile?.role === "parent" && requiredRole === "child") {
         return <>{children}</>;
       }
       // Redirect to appropriate area
       return (
         <Navigate
           to={profile?.role === "parent" ? "/parent/dashboard" : "/child/home"}
         />
       );
     }

     return <>{children}</>;
   }
   ```

5. **PIN Protection** (`src/app/components/PinProtectedRoute.tsx`):

   ```tsx
   export function PinProtectedRoute({ children }: PinProtectedRouteProps) {
     const { isPinLocked, unlock, pinCode } = useParentalSettingsStore();

     // Only show lock if PIN is set and currently locked
     if (isPinLocked && pinCode) {
       return (
         <PinLock onUnlock={unlock} onCancel={() => navigate("/child/home")} />
       );
     }

     return <>{children}</>;
   }
   ```

6. **Database Trigger** (creates profile on signup):
   ```sql
   CREATE FUNCTION handle_new_user()
   RETURNS TRIGGER AS $$
   BEGIN
     INSERT INTO profiles (id, email, role)
     VALUES (
       NEW.id,
       NEW.email,
       COALESCE(NEW.raw_user_meta_data->>'role', 'parent')
     );
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```

### Audio Recording Pattern

**Hook Implementation** (`src/app/hooks/useAudioRecorder.ts`):

```tsx
export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      setAudioBlob(blob);
      stream.getTracks().forEach((track) => track.stop()); // Stop microphone
    };

    mediaRecorder.start();
    setIsRecording(true);
  };

  return {
    isRecording,
    audioBlob,
    startRecording,
    stopRecording,
    clearRecording,
  };
}
```

**Component Usage** (`src/app/components/AudioRecorder.tsx`):

```tsx
export function AudioRecorder({ onRecordingComplete }: AudioRecorderProps) {
  const recorder = useAudioRecorder();
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  // Initialize WaveSurfer when audio is available
  useEffect(() => {
    if (recorder.audioUrl && waveformRef.current) {
      wavesurferRef.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "hsl(271 91% 65%)",
        progressColor: "hsl(271 81% 56%)",
        height: 80,
      });
      wavesurferRef.current.load(recorder.audioUrl);
    }

    return () => wavesurferRef.current?.destroy();
  }, [recorder.audioUrl]);

  const handleStopRecording = () => {
    recorder.stopRecording();
    if (recorder.audioBlob && onRecordingComplete) {
      onRecordingComplete(recorder.audioBlob, recorder.audioUrl!);
    }
  };

  return (
    <div>
      <div ref={waveformRef} />
      <Button
        onClick={
          recorder.isRecording ? handleStopRecording : recorder.startRecording
        }
      >
        {recorder.isRecording ? <Square /> : <Mic />}
      </Button>
    </div>
  );
}
```

**Usage in Game Components:**

```tsx
// In ListEditor.tsx or game components
<AudioRecorder
  onRecordingComplete={async (blob, url) => {
    const isOnline = useOnline();

    if (isOnline) {
      // Upload directly to Supabase Storage
      const filename = `lists/${listId}/words/${wordId}.webm`;
      const { data, error } = await supabase.storage
        .from("word-audio")
        .upload(filename, blob);

      if (!error) {
        // Update word with audio URL
        await updateWord.mutateAsync({
          id: wordId,
          prompt_audio_url: data.path,
        });
      }
    } else {
      // Queue for later upload
      const blobId = await queueAudio(blob, `${wordId}-${Date.now()}.webm`);
      await queueAttempt(
        childId,
        wordId,
        listId,
        "say-spell",
        true,
        undefined,
        blobId
      );
    }
  }}
/>
```

## Testing & Debugging

### Offline Testing Procedures

**DevTools Method:**

1. **Enable Offline Mode:**
   - Open Chrome/Edge DevTools (F12)
   - Navigate to Network tab
   - Select "Offline" from throttling dropdown (top of Network tab)

2. **Test Gameplay:**

   ```tsx
   // In PlayListenType.tsx or PlaySaySpell.tsx
   const isOnline = useOnline(); // Should return false

   // Verify attempts are queued
   await db.queuedAttempts.add({
     child_id: profile.id,
     word_id: currentWord.id,
     list_id: listId,
     mode: "listen-type",
     is_correct: correct,
     typed_answer: answer,
     created_at: new Date().toISOString(),
     synced: false,
   });
   ```

3. **Verify IndexedDB Queue:**
   - Open DevTools > Application tab
   - Navigate to Storage > IndexedDB > SpellStarsDB
   - Check `queuedAttempts` table for unsync records
   - Check `queuedAudio` table for Blob entries

4. **Test Sync:**
   - Re-enable network (select "Online" in Network tab)
   - Watch console logs for sync activity
   - Verify in Supabase dashboard:
     - Storage > word-audio bucket for uploaded audio files
     - Database > attempts table for attempt records
   - Refresh IndexedDB view to confirm `synced: true`

**Service Worker Testing:**

```javascript
// In DevTools Console
navigator.serviceWorker.getRegistration().then((reg) => {
  console.log("Service Worker:", reg);
  console.log("Active:", reg.active);
  console.log("Waiting:", reg.waiting);
});

// Check cache contents
caches.keys().then((names) => {
  console.log("Cache names:", names);
  names.forEach((name) => {
    caches.open(name).then((cache) => {
      cache.keys().then((keys) => {
        console.log(
          `Cache ${name}:`,
          keys.map((r) => r.url)
        );
      });
    });
  });
});
```

**PWA Validation:**

1. Run Lighthouse audit (DevTools > Lighthouse tab)
2. Check "Progressive Web App" category
3. Target score: 100
4. Common issues:
   - Manifest not valid (check `index.html` has `<link rel="manifest">`)
   - Service worker not registered (check `src/app/main.tsx` imports `registerSW`)
   - Icons missing (verify `public/` has all required sizes)

### RLS Policy Testing

**Strategy:** Test with different user roles to verify access control

1. **Create Test Users:**

   ```sql
   -- In Supabase SQL Editor
   -- Parent user
   INSERT INTO profiles (id, email, role)
   VALUES ('test-parent-id', 'parent@test.com', 'parent');

   -- Child user
   INSERT INTO profiles (id, email, role)
   VALUES ('test-child-id', 'child@test.com', 'child');
   ```

2. **Test Parent Access:**

   ```tsx
   // Sign in as parent
   await supabase.auth.signIn({ email: "parent@test.com", password: "test" });

   // Should succeed: Create word list
   const { data, error } = await supabase
     .from("word_lists")
     .insert({ title: "Test List", created_by: "test-parent-id" });

   // Should succeed: Read own lists
   const { data: lists } = await supabase
     .from("word_lists")
     .select("*")
     .eq("created_by", "test-parent-id");

   // Should succeed: Read child attempts
   const { data: attempts } = await supabase
     .from("attempts")
     .select("*")
     .eq("child_id", "test-child-id");
   ```

3. **Test Child Access:**

   ```tsx
   // Sign in as child
   await supabase.auth.signIn({ email: 'child@test.com', password: 'test' });

   // Should succeed: Read word lists (read-only)
   const { data: lists } = await supabase
     .from('word_lists')
     .select('*');

   // Should succeed: Insert own attempt
   const { data, error } = await supabase
     .from('attempts')
     .insert({ child_id: 'test-child-id', word_id: 'some-word-id', ... });

   // Should FAIL: Update word list (permission denied)
   const { error: updateError } = await supabase
     .from('word_lists')
     .update({ title: 'Hacked!' })
     .eq('id', 'some-list-id');
   // Expected: updateError.code === 'PGRST301' (permission denied)

   // Should FAIL: Read parental settings
   const { error: settingsError } = await supabase
     .from('parental_settings')
     .select('*');
   // Expected: No rows returned (RLS blocks access)
   ```

4. **Check RLS Policies in Dashboard:**
   - Navigate to Supabase Dashboard > Authentication > Policies
   - Verify each table has policies for both roles
   - Common issue: Missing `USING` clause (defines who can access)
   - Common issue: Missing `WITH CHECK` clause (defines what can be inserted)

### Debugging Common Issues

**Issue: "Failed to fetch" errors**

Cause: Supabase client not configured correctly or offline

Solution:

```tsx
// Check environment variables
console.log("Supabase URL:", import.meta.env.VITE_SUPABASE_URL);
console.log(
  "Supabase Key:",
  import.meta.env.VITE_SUPABASE_ANON_KEY?.slice(0, 20) + "..."
);

// Verify client initialization
import { supabase } from "@/app/supabase";
console.log("Supabase client:", supabase);

// Test connection
const { data, error } = await supabase.from("profiles").select("count");
console.log("Connection test:", { data, error });
```

**Issue: React Query not refetching after mutation**

Cause: Query key mismatch or missing `invalidateQueries`

Solution:

```tsx
// Ensure query keys match
const listQuery = useQuery(['word-list', listId], ...);  // ✓ Correct
const updateMutation = useMutation({
  onSuccess: () => {
    queryClient.invalidateQueries(['word-list', listId]);  // ✓ Must match
  }
});

// Common mistake: Using different keys
const listQuery = useQuery(['list', listId], ...);  // ✗ "list"
const updateMutation = useMutation({
  onSuccess: () => {
    queryClient.invalidateQueries(['word-list', listId]);  // ✗ "word-list" (won't match)
  }
});
```

**Issue: SRS due dates not updating**

Cause: Timezone mismatch or incorrect date comparison

Debug:

```tsx
// Check current date vs due_date
const { data: srsEntries } = await supabase
  .from("srs")
  .select("*, words(text)")
  .eq("child_id", childId)
  .lte("due_date", new Date().toISOString().split("T")[0]); // Format: YYYY-MM-DD

console.log("Due words:", srsEntries);
console.log("Today:", new Date().toISOString().split("T")[0]);

// Verify SRS calculation
import { calculateSrsOnSuccess, calculateSrsOnMiss } from "@/lib/srs";
const result = calculateSrsOnSuccess({ ease: 2.5, interval_days: 1, reps: 1 });
console.log("SRS result:", result); // Should show new ease, interval, due_date
```

**Issue: Audio not recording or uploading**

Cause: Microphone permissions or HTTPS requirement

Debug:

```tsx
// Check microphone permissions
navigator.permissions.query({ name: "microphone" }).then((result) => {
  console.log("Microphone permission:", result.state);
  // 'granted', 'prompt', or 'denied'
});

// Test MediaRecorder support
console.log("MediaRecorder supported:", "MediaRecorder" in window);
console.log(
  "Supported MIME types:",
  ["audio/webm", "audio/webm;codecs=opus", "audio/mp4"].filter(
    MediaRecorder.isTypeSupported
  )
);

// Test Supabase Storage upload
const testBlob = new Blob(["test"], { type: "text/plain" });
const { data, error } = await supabase.storage
  .from("word-audio")
  .upload("test.txt", testBlob);
console.log("Storage test:", { data, error });
```

**Issue: Theme not applying**

Cause: CSS custom property not being set or theme ID mismatch

Debug:

```tsx
// Check current theme
import { useThemeStore } from "@/app/store/theme";
const { themeId } = useThemeStore();
console.log("Active theme ID:", themeId);

// Verify CSS variables
const root = document.documentElement;
console.log("--primary:", getComputedStyle(root).getPropertyValue("--primary"));
console.log(
  "--background:",
  getComputedStyle(root).getPropertyValue("--background")
);

// Manually apply theme
import { applyTheme } from "@/app/lib/themes";
applyTheme("kawaii-pink");
```

### Migration Debugging

**Check Migration Status:**

```powershell
# List all applied migrations
.\check-migrations.ps1

# Expected output:
# Applied migrations:
# - 20241108000000_initial_schema.sql
# - 20241108000003_safe_schema_update.sql
# ...
```

**Verify Schema Changes:**

```powershell
# Show current schema
.\check-schema.ps1

# List all tables
.\check-tables.ps1
```

**Common Migration Errors:**

1. **"relation already exists"**
   - Cause: Migration ran twice or table already created
   - Solution: Use `CREATE TABLE IF NOT EXISTS` in migrations

2. **"column does not exist"**
   - Cause: Missing prior migration or incorrect order
   - Solution: Check migration timestamps, ensure chronological order

3. **"permission denied for schema public"**
   - Cause: RLS policy blocks access
   - Solution: Add appropriate policy or use `SECURITY DEFINER` in function

**Rollback Strategy:**

Supabase doesn't support automatic rollbacks. Manual approach:

```sql
-- In Supabase SQL Editor
-- Drop problematic table
DROP TABLE IF EXISTS problematic_table CASCADE;

-- Re-run earlier migration
-- (copy SQL from migration file)

-- Or: Manually revert changes
ALTER TABLE my_table DROP COLUMN new_column;
```

### Performance Debugging

**React Query DevTools:**

```tsx
// Add to src/app/main.tsx in development
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

<QueryClientProvider client={queryClient}>
  <App />
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>;
```

**Vite Bundle Analysis:**

```powershell
# Build with bundle analysis
npm run build -- --mode analyze

# Generates dist/stats.html
```

**Lighthouse Performance Audit:**

Target scores:

- Performance: 90+
- Accessibility: 100
- Best Practices: 95+
- SEO: 90+
- PWA: 100

Common issues:

- Large bundle size → Code splitting needed
- Slow Time to Interactive → Reduce JavaScript execution time
- Poor Largest Contentful Paint → Optimize images and fonts

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
