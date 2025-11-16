# Major Issues (Continued) - Agent Prompts

## Issue #7: Potential Memory Leak in Session Store

### Prompt for Agent

````
TASK: Add memory bounds to session store's wordsAttempted Set to prevent unbounded growth

CONTEXT:
The session store tracks all word IDs attempted in current session using a Set. Long practice sessions with many words could cause this Set to grow unbounded, consuming memory and slowing down sessionStorage serialization.

FINDINGS:
- `src/app/store/session.ts` stores `wordsAttempted: Set<string>`
- Set persists to sessionStorage (serialized as array)
- No maximum size limit on Set
- No cleanup mechanism for old entries
- recordAttempt() always adds to Set, never removes
- Long session (100+ words) = 3600+ bytes in sessionStorage
- SessionStorage has 5-10MB limit across entire app

PROBLEM:
Unbounded growth scenarios:
- Child practices 200 unique words in one session
- Parent tests all lists in child mode (dev feature)
- Session left open for hours with repeated practice
- Set grows to thousands of entries
- sessionStorage serialization slows down
- Potential quota exceeded errors

IMPACT:
- MEMORY: Gradual memory consumption during long sessions
- PERFORMANCE: Slower sessionStorage writes as Set grows
- STORAGE: Risk of sessionStorage quota exceeded
- UX: Potential "Storage quota exceeded" errors

RECOMMENDATION:

Implement sliding window or maximum size limit on wordsAttempted Set. Options:

**Option A: Sliding Window** (Most Accurate)
Keep only last N words, removing oldest when adding new

**Option B: Size Limit** (Simplest)
Stop adding after reaching max size

**Option C: Session Time Limit** (Most Realistic)
Auto-end session after duration threshold

Choose Option A for accuracy + bounded memory

FILES TO REVIEW:
- `src/app/store/session.ts` (~130 lines) - Session state management
- `src/app/pages/child/PlayListenType.tsx` - Records attempts
- `src/app/pages/child/PlaySaySpell.tsx` - Records attempts
- `src/app/components/SessionComplete.tsx` - Session ending

IMPLEMENTATION STEPS:

**Step 1: Add Configuration Constants**

At top of session.ts:
```typescript
/**
 * Maximum number of unique words tracked in session
 * Prevents unbounded memory growth in long sessions
 *
 * Rationale: 100 words is ~2 hours of practice at reasonable pace
 * Balances accuracy with memory constraints
 */
const MAX_WORDS_TRACKED = 100;

/**
 * When reaching max, remove this many oldest entries
 * Makes room for new words without frequent cleanup
 */
const WORDS_TO_REMOVE = 20;
````

**Step 2: Convert Set to Array with Timestamps**

Change data structure to track insertion order:

```typescript
export interface SessionData {
  startTime: number;
  // CHANGED: Track word IDs with timestamps for LRU eviction
  wordsAttempted: Array<{
    wordId: string;
    timestamp: number;
  }>;
  correctOnFirstTry: number;
  totalAttempts: number;
  currentStreak: number;
  hasUpdatedStreak: boolean;
}
```

**Step 3: Update recordAttempt Function**

Implement sliding window logic:

```typescript
recordAttempt: (wordId: string, correctOnFirstTry: boolean) => {
  set((state) => {
    // Check if word already tracked
    const existingIndex = state.wordsAttempted.findIndex(
      (w) => w.wordId === wordId
    );

    let newWordsAttempted = [...state.wordsAttempted];

    if (existingIndex === -1) {
      // New word - add with timestamp
      newWordsAttempted.push({
        wordId,
        timestamp: Date.now(),
      });

      // Enforce size limit using sliding window
      if (newWordsAttempted.length > MAX_WORDS_TRACKED) {
        // Sort by timestamp (oldest first)
        newWordsAttempted.sort((a, b) => a.timestamp - b.timestamp);

        // Remove oldest entries
        newWordsAttempted = newWordsAttempted.slice(WORDS_TO_REMOVE);

        logger.debug(
          `Session word limit reached (${MAX_WORDS_TRACKED}). ` +
          `Removed ${WORDS_TO_REMOVE} oldest entries.`
        );
      }
    } else {
      // Word already tracked - update timestamp to mark as recent
      newWordsAttempted[existingIndex].timestamp = Date.now();
    }

    return {
      wordsAttempted: newWordsAttempted,
      correctOnFirstTry:
        state.correctOnFirstTry + (correctOnFirstTry ? 1 : 0),
      totalAttempts: state.totalAttempts + 1,
      currentStreak: correctOnFirstTry ? state.currentStreak + 1 : 0,
    };
  });
},
```

**Step 4: Update Serialization Logic**

Storage getter/setter already handles array serialization, just need to ensure compatibility:

```typescript
storage: {
  getItem: (name) => {
    const str = sessionStorage.getItem(name);
    if (!str) return null;
    const { state } = JSON.parse(str);

    // Handle both old Set format and new Array format
    if (Array.isArray(state.wordsAttempted)) {
      // New format - already an array
      return { state };
    } else {
      // Old format - convert Set to array with current timestamp
      state.wordsAttempted = Array.from(state.wordsAttempted || []).map(
        (wordId) => ({
          wordId,
          timestamp: Date.now(),
        })
      );
      return { state };
    }
  },
  setItem: (name, value) => {
    const { state } = value;
    // Array already serializable
    sessionStorage.setItem(name, JSON.stringify({ state }));
  },
  removeItem: (name) => sessionStorage.removeItem(name),
},
```

**Step 5: Update endSession to Return Unique Count**

```typescript
endSession: () => {
  const state = get();

  // Get unique word count (should always be correct with array)
  const uniqueWords = new Set(state.wordsAttempted.map(w => w.wordId)).size;

  const summary: SessionSummary = {
    durationSeconds: Math.floor((Date.now() - state.startTime) / 1000),
    wordsPracticed: uniqueWords, // Use actual unique count
    correctOnFirstTry: state.correctOnFirstTry,
    totalAttempts: state.totalAttempts,
    accuracy:
      state.totalAttempts > 0
        ? (state.correctOnFirstTry / state.totalAttempts) * 100
        : 0,
  };

  // Reset session
  set({
    startTime: 0,
    wordsAttempted: [],
    correctOnFirstTry: 0,
    totalAttempts: 0,
    currentStreak: 0,
    hasUpdatedStreak: false,
  });

  return summary;
},
```

**Step 6: Add Warning for Long Sessions**

Optional - log warning when approaching limit:

```typescript
// In recordAttempt after adding word
if (newWordsAttempted.length > MAX_WORDS_TRACKED * 0.8) {
  logger.warn(
    `Session has tracked ${newWordsAttempted.length} unique words. ` +
      `Approaching limit of ${MAX_WORDS_TRACKED}. ` +
      `Consider ending session for accurate statistics.`
  );
}
```

**Step 7: Update Initial State**

```typescript
const [status, setStatus] = useState<SessionStore>({
  startTime: 0,
  wordsAttempted: [], // Changed from Set to Array
  correctOnFirstTry: 0,
  totalAttempts: 0,
  currentStreak: 0,
  hasUpdatedStreak: false,
  // ... rest of initial state
});
```

**Alternative: Option B (Simpler)**

If LRU tracking is overkill, just use Set with size limit:

```typescript
recordAttempt: (wordId: string, correctOnFirstTry: boolean) => {
  set((state) => {
    const newWordsAttempted = new Set(state.wordsAttempted);

    // Only add if under limit
    if (newWordsAttempted.size < MAX_WORDS_TRACKED) {
      newWordsAttempted.add(wordId);
    } else {
      logger.warn('Session word tracking limit reached');
    }

    return {
      wordsAttempted: newWordsAttempted,
      correctOnFirstTry: state.correctOnFirstTry + (correctOnFirstTry ? 1 : 0),
      totalAttempts: state.totalAttempts + 1,
      currentStreak: correctOnFirstTry ? state.currentStreak + 1 : 0,
    };
  });
},
```

This is simpler but less accurate for very long sessions.

ACCEPTANCE CRITERIA:

- [ ] MAX_WORDS_TRACKED constant defined (recommend 100)
- [ ] wordsAttempted bounded to max size
- [ ] Old entries removed when limit reached
- [ ] Unique word count remains accurate
- [ ] sessionStorage writes don't fail
- [ ] No performance regression
- [ ] Backward compatible with old session data
- [ ] Tests added for limit enforcement

TESTING CHECKLIST:

1. Start session and practice 100+ unique words
2. Verify wordsAttempted stays at max size
3. Check sessionStorage doesn't grow unbounded
4. Verify unique word count in endSession() correct
5. Test page refresh preserves session
6. Test session across multiple game modes
7. Verify no "Storage quota exceeded" errors
8. Benchmark recordAttempt performance (should be <1ms)

EDGE CASES:

- Practicing same word repeatedly (shouldn't increase count)
- Switching between game modes mid-session
- Browser refresh during long session
- sessionStorage disabled in browser
- Very fast word completion (rapid recordAttempt calls)

PERFORMANCE EXPECTATIONS:

- Memory: Bounded to ~10KB regardless of session length
- recordAttempt: <1ms per call
- sessionStorage write: <5ms per call
- endSession: <10ms to calculate summary

DELIVERABLES:

1. Updated session.ts with bounded wordsAttempted
2. Constants defining limits with documentation
3. Backward compatibility for existing sessions
4. Unit tests for limit enforcement
5. Performance benchmarks
6. Documentation in code comments

```

---

## Issue #8: Inadequate PIN Brute Force Protection

### Prompt for Agent

```

TASK: Implement progressive lockout and rate limiting for PIN brute force attack prevention

CONTEXT:
Current PIN protection has exponential lockout (30s, 60s, 120s, 300s) but resets completely after lockout expires. An attacker could try 3 attempts, wait 30 seconds, try 3 more, etc., potentially testing ~720 combinations per hour. Need progressive lockout that persists across lockout periods.

FINDINGS:

- `src/app/store/parentalSettings.ts` has recordFailedAttempt() with lockout
- Lockout resets when timer expires (line 96: `lockoutUntil: null`)
- failedAttempts counter resets on unlock (line 84)
- No permanent escalation after multiple lockout periods
- No server-side rate limiting
- PIN is 4 digits = 10,000 possible combinations
- Current system: 3 attempts per 30s = ~360 attempts/hour max

PROBLEM:
Attack scenario:

1. Attacker tries 3 wrong PINs → 30s lockout
2. Waits 30s, lockout expires
3. Tries 3 more wrong PINs → 60s lockout
4. Waits 60s, lockout expires
5. Tries 3 more wrong PINs → 120s lockout
6. Process repeats indefinitely

In 1 hour of patient attempts:

- ~360-720 PIN combinations tested
- In 14-28 hours, all 10,000 PINs could be tested
- Automated script could run overnight

IMPACT:

- SECURITY: Parental controls bypassable with patient brute force
- CHILD SAFETY: Children could access parent area unsupervised
- DATA: Parent payment info, analytics, settings exposed
- TRUST: Parents lose confidence in app security

RECOMMENDATION:

Implement three-tier defense:

**Tier 1: Progressive Persistent Lockout** (Client-side)
Track total failed attempts across lockout periods, escalate permanently

**Tier 2: Long-term Attempt History** (Client-side)
Store failed attempts in localStorage with timestamps, detect patterns

**Tier 3: Server-side Rate Limiting** (Future enhancement)
Use Supabase Edge Functions to enforce global rate limits

Implement Tier 1 immediately, plan for Tier 2-3.

FILES TO REVIEW:

- `src/app/store/parentalSettings.ts` (~140 lines) - PIN state management
- `src/lib/crypto.ts` (~180 lines) - PIN hashing/verification
- `src/app/components/PinLock.tsx` - PIN entry UI
- `src/app/components/PinProtectedRoute.tsx` - Route protection

IMPLEMENTATION STEPS:

**Step 1: Add Persistent Attempt Tracking**

Add to ParentalSettings interface:

```typescript
export interface ParentalSettings {
  // ... existing fields

  // NEW: Track total failed attempts across all lockout periods
  totalFailedAttempts: number;

  // NEW: Track when protection was first triggered
  firstFailureTimestamp: number | null;

  // NEW: Track if account is permanently locked (requires special unlock)
  isPermanentlyLocked: boolean;

  // NEW: Timestamp when permanent lock can be reset (24 hours after lock)
  permanentLockResetTime: number | null;
}
```

**Step 2: Update Progressive Lockout Logic**

Replace recordFailedAttempt in parentalSettings.ts:

```typescript
recordFailedAttempt: () => {
  const state = get();
  const now = Date.now();

  // Increment both current and total counters
  const attempts = state.failedAttempts + 1;
  const totalAttempts = state.totalFailedAttempts + 1;

  // Track first failure for windowing
  const firstFailure = state.firstFailureTimestamp || now;

  // Progressive lockout durations (in milliseconds)
  let lockoutDuration = 0;

  if (totalAttempts >= 20) {
    // 20+ total failures = 24 hour permanent lock
    set({
      failedAttempts: attempts,
      totalFailedAttempts: totalAttempts,
      firstFailureTimestamp: firstFailure,
      isPermanentlyLocked: true,
      permanentLockResetTime: now + (24 * 60 * 60 * 1000), // 24 hours
      lockoutUntil: now + (24 * 60 * 60 * 1000),
    });

    logger.warn(
      `PIN permanently locked after ${totalAttempts} failed attempts. ` +
      `Unlock available after 24 hours.`
    );
    return;
  }

  // Escalating lockouts based on total attempts
  if (totalAttempts >= 15) {
    lockoutDuration = 60 * 60 * 1000; // 1 hour
  } else if (totalAttempts >= 12) {
    lockoutDuration = 30 * 60 * 1000; // 30 minutes
  } else if (totalAttempts >= 9) {
    lockoutDuration = 15 * 60 * 1000; // 15 minutes
  } else if (totalAttempts >= 6) {
    lockoutDuration = 5 * 60 * 1000; // 5 minutes
  } else if (attempts >= 5) {
    lockoutDuration = 120 * 1000; // 2 minutes
  } else if (attempts >= 4) {
    lockoutDuration = 60 * 1000; // 1 minute
  } else if (attempts >= 3) {
    lockoutDuration = 30 * 1000; // 30 seconds
  }

  const lockoutUntil = lockoutDuration > 0 ? now + lockoutDuration : null;

  set({
    failedAttempts: attempts,
    totalFailedAttempts: totalAttempts,
    firstFailureTimestamp: firstFailure,
    lockoutUntil,
  });

  if (lockoutDuration > 0) {
    const minutes = Math.floor(lockoutDuration / 60000);
    const seconds = Math.floor((lockoutDuration % 60000) / 1000);
    logger.warn(
      `PIN locked for ${minutes}m ${seconds}s after ${totalAttempts} total failed attempts`
    );
  }
},
```

**Step 3: Add Successful Unlock Decay**

Reset counters partially on successful unlock (not completely):

```typescript
unlock: () => {
  const state = get();

  // On successful unlock, reduce total attempts by 50% (decay)
  // This allows recovery from occasional mistakes while preserving security
  const decayedTotal = Math.floor(state.totalFailedAttempts * 0.5);

  set({
    isPinLocked: false,
    failedAttempts: 0,
    totalFailedAttempts: decayedTotal,
    lockoutUntil: null,
    // Keep firstFailureTimestamp to maintain window context
  });

  logger.info(
    `PIN unlocked successfully. ` +
    `Total failed attempts decayed from ${state.totalFailedAttempts} to ${decayedTotal}`
  );
},
```

**Step 4: Add 24-Hour Window Reset**

Reset total attempts if 24 hours pass without failures:

```typescript
isLockedOut: () => {
  const state = get();
  const now = Date.now();

  // Check for permanent lock
  if (state.isPermanentlyLocked) {
    if (state.permanentLockResetTime && now >= state.permanentLockResetTime) {
      // 24 hours passed, allow unlock but keep escalated protection
      set({
        isPermanentlyLocked: false,
        permanentLockResetTime: null,
        lockoutUntil: null,
        totalFailedAttempts: 10, // Start at elevated level
      });
      logger.info('Permanent lock period expired. Unlock available with elevated protection.');
      return false;
    }
    return true;
  }

  // Reset total attempts if 24 hours passed since first failure
  if (
    state.firstFailureTimestamp &&
    now - state.firstFailureTimestamp >= 24 * 60 * 60 * 1000
  ) {
    set({
      totalFailedAttempts: 0,
      firstFailureTimestamp: null,
    });
    logger.info('24-hour window expired. Failed attempt counter reset.');
  }

  // Check current lockout
  if (!state.lockoutUntil) return false;

  if (now >= state.lockoutUntil) {
    // Lockout expired, clear it but keep total attempts
    set({ lockoutUntil: null, failedAttempts: 0 });
    return false;
  }

  return true;
},
```

**Step 5: Update UI to Show Permanent Lock**

In PinLock.tsx, show different message for permanent lock:

```typescript
{isLockedOut() && (
  <div className="lock-message">
    {isPermanentlyLocked ? (
      <>
        <h2>Account Temporarily Locked</h2>
        <p>
          Too many failed PIN attempts.
          For security, this account is locked for 24 hours.
        </p>
        <p>
          Time remaining: {formatTimeRemaining(getLockoutTimeRemaining())}
        </p>
        <p className="help-text">
          If you forgot your PIN, contact support or reset via parent settings.
        </p>
      </>
    ) : (
      <>
        <h2>Too Many Attempts</h2>
        <p>Please wait {formatTimeRemaining(getLockoutTimeRemaining())} before trying again.</p>
      </>
    )}
  </div>
)}
```

**Step 6: Add Manual Reset Mechanism**

In ParentalSettings page, add emergency unlock:

```typescript
// Only available to authenticated parent users
const handleEmergencyUnlock = async () => {
  if (!confirm("Reset PIN protection? This will clear all lockouts.")) {
    return;
  }

  // Reset all PIN protection state
  setSettings({
    failedAttempts: 0,
    totalFailedAttempts: 0,
    firstFailureTimestamp: null,
    isPermanentlyLocked: false,
    permanentLockResetTime: null,
    lockoutUntil: null,
    isPinLocked: false,
  });

  toast.success("PIN protection reset successfully");
};
```

**Step 7: Persist to localStorage**

Update partialize to persist new fields:

```typescript
partialize: (state) => ({
  pinCode: state.pinCode,
  // ... other existing fields
  totalFailedAttempts: state.totalFailedAttempts, // NEW
  firstFailureTimestamp: state.firstFailureTimestamp, // NEW
  isPermanentlyLocked: state.isPermanentlyLocked, // NEW
  permanentLockResetTime: state.permanentLockResetTime, // NEW
  // Note: Still don't persist isPinLocked or lockoutUntil
}),
```

ACCEPTANCE CRITERIA:

- [ ] Progressive lockout escalates based on total attempts
- [ ] 20+ failed attempts triggers 24-hour lock
- [ ] Successful unlock reduces total attempts by 50%
- [ ] 24-hour window resets counter completely
- [ ] Permanent lock message shown in UI
- [ ] Emergency unlock available to authenticated parents
- [ ] All counters persist to localStorage
- [ ] Testing confirms brute force is impractical

TESTING CHECKLIST:

1. Try 3 wrong PINs → 30s lockout
2. Wait 30s, try 3 more → 1min lockout (6 total)
3. Continue pattern → verify escalating lockouts
4. Reach 20 attempts → verify 24-hour permanent lock
5. Try correct PIN during permanent lock → denied
6. Wait 24 hours (or change system clock) → verify unlock available
7. Successful unlock → verify attempt counter decayed 50%
8. Wait 24 hours after first failure → verify full reset
9. Test emergency unlock in settings → verify clears all state

SECURITY ANALYSIS:

- Old system: ~720 attempts/hour possible
- New system: ~20 attempts max before 24-hour lock
- Brute force time: 24+ hours minimum (vs 14-28 hours)
- With decay: Legitimate users recover from mistakes
- With window reset: No permanent account lockout

DELIVERABLES:

1. Updated parentalSettings.ts with progressive lockout
2. Updated PinLock.tsx with permanent lock UI
3. Emergency unlock in settings page
4. localStorage persistence of new fields
5. Security analysis documentation
6. Testing results

```

Continue to next file...
```
