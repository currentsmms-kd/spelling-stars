# Critical Issues - Agent Prompts

## Issue #1: Missing Test Coverage

### Prompt for Agent

````
TASK: Implement comprehensive test coverage for critical SpellStars functionality

CONTEXT:
The SpellStars codebase currently has ZERO test files. This is a high-risk situation as critical features like spaced repetition algorithms, PIN security, offline sync, and data normalization have no automated validation.

FINDINGS:
- Searched for `**/*.test.*` and `**/*.spec.*` - no test files found
- No test runner configured (no Jest, Vitest, or similar in package.json)
- Critical algorithms in production with no validation

PROBLEM:
Without tests:
- Breaking changes can be deployed undetected
- Refactoring is risky and time-consuming
- Bug fixes cannot verify they don't break existing functionality
- New developers lack executable documentation of expected behavior

IMPACT:
- HIGH RISK: Spaced repetition algorithm bugs could corrupt user learning data
- SECURITY RISK: PIN hashing/verification bugs could compromise parental controls
- DATA INTEGRITY: Spelling normalization bugs could mark correct answers as wrong
- RELIABILITY: Offline sync failures could lose user progress

RECOMMENDATION:
Implement testing in this priority order:

1. **Setup Testing Infrastructure** (Day 1)
   - Install Vitest: `pnpm add -D vitest @vitest/ui`
   - Add test scripts to package.json
   - Configure vitest.config.ts
   - Set up coverage reporting

2. **Unit Tests for Pure Functions** (Day 2-3)
   - `src/lib/srs.ts`: Test SM-2 algorithm calculations
   - `src/lib/crypto.ts`: Test PIN hashing and verification
   - `src/lib/utils.ts`: Test normalizeSpellingAnswer edge cases
   - `src/lib/wordsearch.ts`: Test grid generation logic

3. **Integration Tests for Sync Logic** (Day 4-5)
   - `src/lib/sync.ts`: Test queue, retry, and exponential backoff
   - Mock IndexedDB operations
   - Test error handling and recovery

4. **Component Tests** (Day 6-7)
   - Critical game components (PlayListenType, PlaySaySpell)
   - Authentication flows
   - Error boundaries

5. **E2E Tests** (Day 8-10)
   - Sign up → Create list → Play game → View progress
   - Offline mode → Queue attempt → Come online → Verify sync
   - Parent PIN lock flow

MINIMUM VIABLE TESTS (if time-constrained):
Focus only on items 1 and 2 above - pure function tests for srs.ts, crypto.ts, and utils.ts

FILES TO REVIEW:
- `package.json` - Check current dependencies
- `src/lib/srs.ts` (179 lines) - Spaced repetition algorithm
- `src/lib/crypto.ts` (~180 lines) - PIN security
- `src/lib/utils.ts` - Spelling normalization
- `src/lib/sync.ts` (1079 lines) - Offline sync logic
- `src/lib/wordsearch.ts` - Grid generation

ACCEPTANCE CRITERIA:
- [ ] Test runner configured and running
- [ ] At minimum 80% coverage on src/lib/srs.ts
- [ ] At minimum 90% coverage on src/lib/crypto.ts
- [ ] At minimum 80% coverage on normalizeSpellingAnswer function
- [ ] All tests passing in CI/CD pipeline
- [ ] Coverage report generated and accessible

TECHNICAL REQUIREMENTS:
- Use Vitest (aligns with Vite build tool)
- TypeScript test files (.test.ts)
- Mock Supabase client for integration tests
- Mock IndexedDB for offline sync tests
- Use @testing-library/react for component tests

EXAMPLE TEST STRUCTURE:
```typescript
// src/lib/srs.test.ts
import { describe, it, expect } from 'vitest';
import { calculateSrsOnSuccess, calculateSrsOnMiss } from './srs';

describe('calculateSrsOnSuccess', () => {
  it('should increase ease factor by 0.1', () => {
    const entry = { ease: 2.5, interval_days: 1, reps: 0, lapses: 0 };
    const result = calculateSrsOnSuccess(entry);
    expect(result.ease).toBe(2.6);
  });

  it('should set interval to 1 on first success when interval is 0', () => {
    const entry = { ease: 2.5, interval_days: 0, reps: 0, lapses: 0 };
    const result = calculateSrsOnSuccess(entry);
    expect(result.interval_days).toBe(1);
  });

  // ... more tests
});
````

DELIVERABLES:

1. vitest.config.ts configuration file
2. Test files covering critical functions
3. Updated package.json with test scripts
4. Coverage report (HTML format)
5. README section on running tests
6. CI/CD integration (GitHub Actions workflow)

```

---

## Issue #2: Database Schema Documentation Inconsistency

### Prompt for Agent

```

TASK: Fix database schema documentation inconsistencies between README and actual production schema

CONTEXT:
The README.md contains a "Getting Started" SQL example that uses outdated table names (spelling_lists) while the actual production schema uses different names (word_lists). This creates confusion for new developers.

FINDINGS:

- README.md line ~280: Shows schema with `spelling_lists` table
- Actual production uses `word_lists` (from migration 20241108000003_safe_schema_update.sql)
- README has disclaimer "NOTE: This is an illustrative example" but doesn't clarify production differences
- Migration 20241108000003 renamed: spelling_lists → word_lists, parent_id → created_by
- Migration removed description field, added week_start_date field

PROBLEM:
Developers following the README will:

- Create wrong table structure in new Supabase projects
- Get foreign key constraint errors when code references word_lists
- Spend time debugging mismatched table names
- Lose confidence in documentation accuracy

IMPACT:

- DEVELOPER ONBOARDING: New developers blocked during setup (1-2 hours lost)
- PRODUCTION ERRORS: Wrong schema deployed could corrupt production database
- MAINTENANCE BURDEN: Team fields repeated questions about schema differences

RECOMMENDATION:

**Option A: Update README to Match Production (Recommended)**
Replace the illustrative schema in README with the actual production schema from migrations. Add clear heading "Production Database Schema" and reference docs/database-schema.md for details.

**Option B: Separate Getting Started from Production**
Keep simplified schema for quickstart, but add prominent warning box linking to production schema documentation. Create a QUICKSTART.md with simplified setup and keep README production-focused.

**Option C: Schema Generator Script**
Create a PowerShell script that concatenates all migrations into a single schema file for easy copy-paste. Keep README minimal and direct users to generated schema.

CHOOSE OPTION A for simplicity and accuracy.

FILES TO REVIEW:

- `README.md` (lines ~250-400) - Getting started SQL
- `docs/database-schema.md` (lines 1-150) - Canonical schema reference
- `supabase/migrations/20241108000000_initial_schema.sql` - Original schema
- `supabase/migrations/20241108000003_safe_schema_update.sql` - Schema changes
- `supabase/migrations/20241109000004_add_srs_table.sql` - SRS table
- `supabase/migrations/20251110214233_add_list_id_to_attempts.sql` - Recent changes

DETAILED CHANGES NEEDED:

1. **In README.md** (replace SQL block starting ~line 280):
   - Change `spelling_lists` → `word_lists`
   - Change `parent_id` → `created_by`
   - Remove `description` column
   - Add `week_start_date DATE` column
   - Update all foreign key references
   - Add `list_words` junction table
   - Update `attempts` table to match current schema (mode, quality, duration_ms)
   - Add `srs` table creation

2. **Add Schema Version Notice**:

   ```markdown
   > **Schema Version**: This schema reflects production as of November 2025.
   > For complete migration history, see `supabase/migrations/` directory.
   > For detailed documentation, see `docs/database-schema.md`.
   ```

3. **Cross-reference docs/database-schema.md**:
   - Ensure docs/database-schema.md is canonical source of truth
   - Add link in README: "See [database-schema.md](docs/database-schema.md) for complete schema details"

4. **Add Migration Path Section**:

   ````markdown
   ## Database Setup

   ### For New Projects

   Run all migrations in order using the provided script:

   ```powershell
   .\push-migration.ps1
   ```
   ````

   ### Manual Setup (Alternative)

   If you prefer to set up manually, the complete schema is below...

   ```

   ```

ACCEPTANCE CRITERIA:

- [ ] README.md SQL matches production schema exactly
- [ ] All table names consistent (word_lists, not spelling_lists)
- [ ] All column names match current migrations
- [ ] Junction table list_words included
- [ ] SRS table included with correct columns
- [ ] Attempts table includes list_id, mode, quality, duration_ms
- [ ] Clear version notice added
- [ ] Link to docs/database-schema.md added
- [ ] No contradictions between README and docs/database-schema.md

TESTING:

1. Copy SQL from updated README
2. Create fresh Supabase project
3. Run SQL in SQL editor
4. Run app locally with new database
5. Verify no foreign key errors
6. Verify all queries work

DELIVERABLES:

1. Updated README.md with correct production schema
2. Updated docs/database-schema.md if any inconsistencies found
3. New section explaining migration vs. manual setup
4. Version notice with date stamp

```

---

## Issue #3: Missing Error Boundary Root Wrapping

### Prompt for Agent

```

TASK: Implement app-wide error boundary to catch React errors and prevent full app crashes

CONTEXT:
Documentation claims "App-wide error boundary catches component errors" but code review shows the ErrorBoundary component exists but is NOT wrapping the application root. This means unhandled React errors will crash the entire app with a blank screen.

FINDINGS:

- `src/app/components/ErrorBoundary.tsx` exists and is imported in App.tsx
- `src/app/App.tsx` imports ErrorBoundary but doesn't use it
- `src/app/main.tsx` renders `<App />` with no error boundary wrapper
- No try-catch around router or query client provider
- Documentation in README claims error boundary is implemented

PROBLEM:
Without error boundary wrapping:

- Any unhandled error in any component crashes entire app
- Users see blank white screen with no recovery option
- No error logging/telemetry captured
- No user-friendly error message
- App must be force-reloaded to recover

IMPACT:

- USER EXPERIENCE: Catastrophic - entire app becomes unusable
- DATA LOSS: Users lose in-progress work (spelling attempts, recordings)
- DEBUGGING: No error context captured for bug reports
- TRUST: Users abandon app after repeated crashes

RECOMMENDATION:

Implement error boundary at THREE levels for defense-in-depth:

**Level 1: Root Level (Critical)**
Wrap entire app to catch catastrophic errors

**Level 2: Route Level (Important)**
Wrap each route to isolate errors to specific pages

**Level 3: Component Level (Nice to have)**
Wrap complex components (AudioRecorder, game pages)

MINIMUM FIX: Implement Level 1 immediately

FILES TO REVIEW:

- `src/app/components/ErrorBoundary.tsx` - Existing error boundary component
- `src/app/main.tsx` - App entry point (render root)
- `src/app/App.tsx` - Main app component
- `src/app/router.tsx` - Route definitions

IMPLEMENTATION STEPS:

**Step 1: Review Existing ErrorBoundary Component**
Check src/app/components/ErrorBoundary.tsx for:

- State management (hasError, error, errorInfo)
- componentDidCatch implementation
- Fallback UI design
- Reset mechanism
- Integration with logger.metrics.errorCaptured()

**Step 2: Wrap Root App (Choose ONE approach)**

**Approach A: Wrap in main.tsx** (Recommended - catches everything including router errors)

```typescript
// src/app/main.tsx
import { ErrorBoundary } from './components/ErrorBoundary';

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
```

**Approach B: Wrap in App.tsx** (Alternative - more granular control)

```typescript
// src/app/App.tsx
export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
```

**Step 3: Add Route-Level Boundaries**
Wrap each route in router.tsx:

```typescript
{
  path: "/child/home",
  element: (
    <ErrorBoundary>
      <ProtectedRoute requiredRole="child">
        <ChildHome />
      </ProtectedRoute>
    </ErrorBoundary>
  ),
}
```

**Step 4: Enhance Fallback UI**
Ensure ErrorBoundary shows:

- User-friendly error message
- "Try Again" button to reset error state
- "Go Home" button for navigation recovery
- Option to copy error details for bug report
- Timestamp and error ID for support requests

**Step 5: Add Telemetry Integration**
In ErrorBoundary.componentDidCatch():

```typescript
componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  logger.metrics.errorCaptured({
    error,
    context: 'ErrorBoundary',
    severity: 'critical',
    component: errorInfo.componentStack,
  });

  this.setState({ hasError: true, error, errorInfo });
}
```

**Step 6: Test Error Boundary**
Create test scenarios:

```typescript
// Temporary test component
function BuggyComponent() {
  throw new Error('Test error boundary');
}

// Add to router temporarily
{ path: "/test-error", element: <BuggyComponent /> }
```

ACCEPTANCE CRITERIA:

- [ ] ErrorBoundary wraps root app in main.tsx or App.tsx
- [ ] Navigation to any route doesn't bypass error boundary
- [ ] Thrown errors show fallback UI instead of blank screen
- [ ] Fallback UI includes "Try Again" and "Go Home" buttons
- [ ] Error details logged to logger.metrics
- [ ] Error boundary resets when user clicks "Try Again"
- [ ] Error boundary resets on navigation to different route
- [ ] Test component verified error boundary works
- [ ] Documentation updated to reflect actual implementation

TESTING CHECKLIST:

1. Add temporary error-throwing component
2. Navigate to component and verify fallback UI appears
3. Click "Try Again" and verify state resets
4. Click "Go Home" and verify navigation works
5. Check console for telemetry logging
6. Test in child routes (big touch targets)
7. Test in parent routes
8. Test during loading states
9. Test during authentication flow
10. Remove test component after verification

DELIVERABLES:

1. Updated main.tsx or App.tsx with ErrorBoundary wrapper
2. Enhanced ErrorBoundary component with better fallback UI
3. Telemetry integration in componentDidCatch
4. Route-level error boundaries (optional but recommended)
5. Test results documentation
6. Updated README to accurately describe error handling

```

---

## Issue #4: Service Worker Registration Conflict

### Prompt for Agent

```

TASK: Fix service worker registration conflict between manual registration and vite-plugin-pwa auto-registration

CONTEXT:
The app manually registers a service worker at "/sw.js" in main.tsx while also using vite-plugin-pwa with autoUpdate mode. This creates potential conflicts and the manual registration path is incorrect for Vite's output structure.

FINDINGS:

- `src/app/main.tsx` line 47: Manual registration `navigator.serviceWorker.register("/sw.js")`
- `vite.config.ts` line 18: vite-plugin-pwa configured with `registerType: "autoUpdate"`
- vite-plugin-pwa generates service worker to `dev-dist/sw.js` (dev) or `dist/sw.js` (production)
- Manual registration path "/sw.js" doesn't match vite-plugin-pwa output location
- Double registration could cause:
  - Update detection failures
  - Cache conflicts
  - Background sync registration errors
  - Workbox routing conflicts

PROBLEM:

1. **Path Mismatch**: Manual registration looks for /sw.js but vite-plugin-pwa generates to different location
2. **Double Registration**: Both manual and auto registration could register same SW twice
3. **Update Handling**: Manual update check (line 53-90) duplicates vite-plugin-pwa's built-in update handling
4. **Background Sync**: Manual sync registration (line 180-215) should use plugin's generated SW

IMPACT:

- PWA FUNCTIONALITY: Service worker may fail to register or update properly
- OFFLINE MODE: App may not cache correctly for offline use
- UPDATES: Users may not receive updates or see update banner
- BACKGROUND SYNC: Queued data may not sync when online

RECOMMENDATION:

**Remove manual registration and use vite-plugin-pwa's virtual module**

This is the recommended approach from vite-plugin-pwa documentation. The plugin provides a virtual module that handles registration, updates, and lifecycle events properly.

FILES TO REVIEW:

- `src/app/main.tsx` (lines 40-215) - Manual SW registration and lifecycle
- `vite.config.ts` (lines 15-145) - vite-plugin-pwa configuration
- `src/app/App.tsx` (lines 20-45) - Update banner listener
- `src/app/components/UpdateBanner.tsx` - UI for SW updates

IMPLEMENTATION STEPS:

**Step 1: Install Virtual PWA Register**
The module is already available via vite-plugin-pwa, just need to import it.

**Step 2: Replace Manual Registration in main.tsx**

REMOVE lines 40-90 (manual registration and update checking)

ADD this at the top of main.tsx:

```typescript
import { registerSW } from "virtual:pwa-register";

// Register service worker with update handling
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Dispatch event for UpdateBanner component
    window.dispatchEvent(new CustomEvent("sw-update-available"));
    logger.info("Service worker update available");
  },
  onOfflineReady() {
    logger.info("App is ready for offline use");
  },
  onRegistered(registration) {
    if (registration) {
      // Check for updates every hour
      setInterval(
        () => {
          registration.update();
        },
        60 * 60 * 1000,
      );
    }
  },
  onRegisterError(error) {
    logger.error("Service worker registration failed:", error);
  },
});

// Expose updateSW globally for UpdateBanner to trigger manual update
window.__updateServiceWorker = updateSW;
```

**Step 3: Update TypeScript Declarations**

Add to `src/vite-env.d.ts`:

```typescript
/// <reference types="vite-plugin-pwa/client" />

interface Window {
  __updateServiceWorker?: () => Promise<void>;
}
```

**Step 4: Simplify Background Sync Registration**

KEEP lines 95-220 but simplify:

```typescript
// Background sync is supported natively by service worker
// Just check if we need to trigger it
window.addEventListener("online", async () => {
  const hasPending = await hasPendingSync();

  if (hasPending) {
    try {
      await syncQueuedData();
    } catch (error) {
      logger.error("Failed to sync queued data:", error);
    }
  }
});
```

The service worker generated by vite-plugin-pwa handles background sync registration automatically based on workbox configuration.

**Step 5: Update UpdateBanner Component**

Modify `src/app/components/UpdateBanner.tsx` to use global updateSW:

```typescript
const handleUpdate = () => {
  if (window.__updateServiceWorker) {
    window
      .__updateServiceWorker()
      .then(() => {
        logger.info("Update applied, reloading...");
        window.location.reload();
      })
      .catch((error) => {
        logger.error("Update failed:", error);
      });
  }
};
```

**Step 6: Update vite.config.ts**

Ensure proper configuration for update detection:

```typescript
VitePWA({
  registerType: "autoUpdate",
  devOptions: {
    enabled: true,
  },
  workbox: {
    // ... existing config
  },
  // Add this to enable update prompting
  injectRegister: null, // Let us control registration via virtual module
});
```

**Step 7: Test Service Worker Registration**

1. Build production: `pnpm run build`
2. Preview: `pnpm run preview`
3. Open DevTools > Application > Service Workers
4. Verify single registration (not duplicate)
5. Verify "waiting" state shows update banner
6. Click "Update" and verify reload
7. Verify offline mode works
8. Verify background sync triggers when online

ACCEPTANCE CRITERIA:

- [ ] Manual registration code removed from main.tsx
- [ ] virtual:pwa-register imported and used
- [ ] Single service worker registration (no duplicates)
- [ ] Update banner shows when new SW is waiting
- [ ] Clicking update button triggers SW activation
- [ ] Offline mode caches routes correctly
- [ ] Background sync triggers on online event
- [ ] No console errors about SW registration
- [ ] DevTools shows clean SW lifecycle
- [ ] Production build works correctly

EDGE CASES TO TEST:

- Hard refresh (Ctrl+Shift+R) during update
- Multiple tabs open during update
- Service worker update while offline
- Background sync while offline
- Cache invalidation when CACHE_VERSION changes

ROLLBACK PLAN:
If virtual module causes issues:

1. Keep manual registration but fix path to use import.meta.env.BASE_URL
2. Disable vite-plugin-pwa auto-registration
3. Document the decision and reasoning

DELIVERABLES:

1. Updated main.tsx using virtual:pwa-register
2. Updated vite-env.d.ts with type declarations
3. Updated UpdateBanner.tsx to use global updateSW
4. Test results showing single registration
5. Documentation of SW update flow
6. Updated DEPLOYMENT.md if necessary

```

---

Continue to next file for remaining critical issues...
```
