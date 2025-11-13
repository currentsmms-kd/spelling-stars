# Bug Fix: Attempts and Stars Not Saving

## Issue Description

Kids' attempts and answers were not being saved to the database. The game would show "Correct!" and allow moving to the next word, but at the end of the game session, no stars were awarded and attempts weren't recorded in the database.

## Root Cause Analysis

### Error Observed

Console showed PostgreSQL error code 42501 (insufficient_privilege):

```
[ERROR] Error saving attempt: {"code":"42501","details":null,"hint":null,"message":"new row violates row-level security policy for table \"attempts\""}
```

### RLS Policy Requirements

The `attempts` table has an INSERT policy that requires:

1. `child_id = auth.uid()` - Child ID must match authenticated user
2. User must have role 'child' in profiles table
3. List must exist in word_lists table
4. **Word must exist in list_words junction table for that specific list**

### Identified Issues

1. **No Session Verification**: The code was attempting to insert attempts without first verifying an active Supabase session exists

2. **Potential Session Timing**: Between when the user navigates to the game and when they submit an answer, the Supabase session JWT could potentially expire or become invalid

3. **Silent Failures**: Errors were being caught and logged but the game continued as if the save succeeded

## Changes Made

### 1. Added Session Verification (PlayListenType.tsx)

**Location**: Lines 697-709

**Before**:

```typescript
if (isOnline) {
  const { error } = await supabase.from("attempts").insert(attemptData);
  if (error) throw error;
}
```

**After**:

```typescript
if (isOnline) {
  // Verify we have an active auth session
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    logger.error("No active session for insert:", { sessionError });
    throw new Error("Authentication session expired. Please sign in again.");
  }

  // Debug logging
  logger.log("Attempting to save (online):", {
    attemptData,
    authUser: session.user.id,
    profileId: profile.id,
    match: session.user.id === profile.id,
    hasSession: !!session,
  });

  const { error } = await supabase.from("attempts").insert(attemptData);
  if (error) {
    logger.error("INSERT error details:", {
      error,
      attemptData,
      authUserId: session.user.id,
      profileId: profile.id,
    });
    throw error;
  }
}
```

### 2. Added Session Verification (PlaySaySpell.tsx)

**Location**: Lines 920-955

Applied the same session verification and enhanced logging to the say-spell game mode.

### 3. Enhanced Error Logging

Both game components now log:

- Auth session status before INSERT
- User ID from session vs. profile ID (mismatch detection)
- Full attempt data being inserted
- Detailed error information if INSERT fails

## Testing Instructions

1. **Clear existing session**:
   - Open DevTools > Application > Storage > Clear site data
   - Sign in again as a child user

2. **Test game flow**:
   - Navigate to Listen & Type game
   - Play through at least 3 words
   - Check console for new log messages:
     - "Attempting to save (online)" with session details
     - Should NOT see "No active session" errors
     - Should NOT see RLS policy errors

3. **Verify data persistence**:
   - Complete the game session
   - Check that stars are awarded
   - Parent dashboard should show attempt history
   - Navigate to parent dashboard > analytics to verify attempts recorded

4. **Test offline queue** (if still having issues):
   - Go offline (DevTools > Network > Offline)
   - Play through words
   - Go back online
   - Check that queued attempts sync successfully

## Additional Diagnostics

If the issue persists, check:

1. **Session validity**:

   ```typescript
   const {
     data: { session },
   } = await supabase.auth.getSession();
   console.log("Session:", session);
   ```

2. **Profile role**:

   ```sql
   SELECT id, email, role FROM profiles WHERE id = '<child-id>';
   ```

3. **Word in list_words**:

   ```sql
   SELECT * FROM list_words
   WHERE list_id = '<list-id>' AND word_id = '<word-id>';
   ```

4. **RLS policy evaluation** (as superuser):
   ```sql
   SET ROLE authenticated;
   SET request.jwt.claims TO '{"sub":"<user-id>"}';
   INSERT INTO attempts (...) VALUES (...);
   ```

## Next Steps

1. Rebuild the application: `npm run build`
2. Clear browser cache and storage
3. Test with fresh login
4. Monitor console for new diagnostic logs
5. If issue persists, collect the new detailed logs for further analysis

## Related Files

- `src/app/pages/child/PlayListenType.tsx` (Lines 697-735)
- `src/app/pages/child/PlaySaySpell.tsx` (Lines 920-980)
- `supabase/migrations/20251111000001_fix_attempts_duplicate_policies.sql` (RLS policy definition)
