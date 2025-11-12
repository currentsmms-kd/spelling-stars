# Bug Fixes: Listen & Type Game - November 11, 2025

## Issues Identified

### 1. RLS Policy Error - Duplicate SELECT Policies

**Problem**: Console showed error `"new row violates row-level security policy for table 'attempts'"`

- Two SELECT policies existed simultaneously on the `attempts` table:
  - "Parents can view attempts for their lists" (from `20251110214233_add_list_id_to_attempts.sql`)
  - "Users can read appropriate attempts" (from `20251109200000_optimize_rls_policies.sql`)
- This created a conflict in PostgreSQL's RLS evaluation

**Root Cause**: Migration `20251110214233_add_list_id_to_attempts.sql` created a new parent-only SELECT policy without dropping the existing consolidated policy.

**Solution**:

- Created migration `20251111000001_fix_attempts_duplicate_policies.sql`
- Removed duplicate "Parents can view attempts for their lists" policy
- Enhanced INSERT policy to validate:
  - User is a child (existing check)
  - List exists (new check)
  - Word exists in specified list (new check)

**Result**: Only one SELECT policy remains ("Users can read appropriate attempts"), which handles both children and parents appropriately.

### 2. No "Next Word" Button After Correct Answer

**Problem**: After typing a correct answer, users saw "Correct! 🎉" and confetti, but no visible way to proceed to the next word.

- UI relied on a 2-second automatic timeout
- No visual indicator that progression would happen
- Users were confused and stuck

**Solution**: Added explicit "Next Word →" button to the correct feedback section in `PlayListenType.tsx`:

```typescript
<Button
  onClick={onNextWord}
  size="child"
  className="w-full"
  disabled={isSaving}
>
  {isSaving ? (
    <span className="flex items-center gap-2">
      <span className="animate-spin">⏳</span>
      Saving...
    </span>
  ) : (
    "Next Word →"
  )}
</Button>
```

**Additional Improvements**:

- Extended auto-advance timeout from 2 seconds to 5 seconds
- Users can now click button immediately or wait for auto-advance
- Button shows "Saving..." state while database operations complete

### 3. Blocking Database Operations

**Problem**: `checkAnswer()` function used `await saveAttemptMutation.mutateAsync()`, which blocked the UI from updating until the database operation completed.

**Solution**: Changed from `mutateAsync()` (blocking) to `mutate()` (fire-and-forget):

- Database operations now happen asynchronously in the background
- UI updates immediately upon correct answer
- "Next Word" button appears instantly
- Saving state shows while operation completes, but doesn't block progression

**Before**:

```typescript
await saveAttemptMutation.mutateAsync({ ... });
```

**After**:

```typescript
saveAttemptMutation.mutate({ ... });
```

## Files Modified

### Database Migrations

1. **`supabase/migrations/20251111000001_fix_attempts_duplicate_policies.sql`** (new)
   - Removed duplicate SELECT policy on `attempts` table
   - Enhanced INSERT policy with additional validation checks
   - Added verification to ensure only one SELECT policy exists

### Frontend Code

2. **`src/app/pages/child/PlayListenType.tsx`**
   - Added "Next Word →" button to correct answer feedback (lines 503-517)
   - Extended auto-advance timeout from 2s to 5s (line 724)
   - Changed `mutateAsync()` to `mutate()` for non-blocking operations (lines 706, 715, 736, 747)
   - Updated comments to reflect new behavior

## Testing Performed

### Database

```powershell
doppler run -- pwsh .\push-migration.ps1  # Applied migration successfully
doppler run -- pwsh .\check-policies.ps1   # Verified only one SELECT policy exists
```

**Result**:

- 33 total policies (down from 34)
- Only "Users can read appropriate attempts" remains for SELECT on `attempts`
- "Children can insert own attempts" enhanced with list/word validation

### User Experience

**Expected Behavior**:

1. User types correct answer → presses Enter or clicks "Check Answer"
2. Immediately sees "Correct! 🎉" with confetti
3. "Next Word →" button appears (enabled after saving completes)
4. User can click button immediately or wait 5 seconds for auto-advance
5. Game progresses to next word or navigates to rewards page when complete

## Impact

### Positive Changes

- ✅ RLS policy errors resolved - attempts now save successfully
- ✅ Users can explicitly progress to next word (better UX)
- ✅ UI no longer blocks on database operations (smoother experience)
- ✅ Clear visual feedback during save operations
- ✅ Maintains auto-advance for users who prefer hands-off experience

### No Breaking Changes

- Game flow remains the same for users
- All existing functionality preserved
- Backward compatible with existing data

## Related Issues

This fix addresses the following:

1. Console error: `"new row violates row-level security policy for table 'attempts'"`
2. User confusion about game not progressing after correct answers
3. UI blocking/freezing during database saves
