# Critical Bugs Found - November 10, 2025

## Testing Session Results

**Tester**: User feedback
**Date**: November 10, 2025
**Status**: Multiple critical issues blocking core functionality

---

## 🔴 CRITICAL BUG #1: No Child Account Creation UI

**Status**: CRITICAL - Blocks parent workflow
**Component**: Parent Dashboard
**Description**: There is no UI in the parent dashboard for creating child accounts. Parents cannot add children to the system.

**Current State**:

- No "Add Child" button or form in parent dashboard
- No child management page exists
- `useAuth().signUp()` supports `role: "child"` parameter but no UI calls it

**Expected Behavior**:

- Parent dashboard should have "Add Child" or "Manage Children" section
- Form to create child accounts with email/password
- Display list of associated children

**Impact**: HIGH - Parents cannot create child accounts, blocking the entire child workflow

**Fix Required**:

- Create ChildManagement component or add to Dashboard
- Wire up child creation form to `useAuth().signUp(email, password, "child")`
- Link child profiles to parent via `parent_id` column

---

## 🔴 CRITICAL BUG #2: Game List Selection Broken

**Status**: CRITICAL - Blocks gameplay
**Component**: `src/app/pages/child/PlayListenType.tsx` & `PlaySaySpell.tsx`
**Description**: When clicking "Play" on either game mode, no word lists are shown for selection.

**Current State**:

```tsx
function ListSelector() {
  return (
    <Card variant="child">
      <div className="text-center space-y-6">
        <h3 className="text-3xl font-bold">Choose a list to practice</h3>
        <Link to="/child/home">
          <Button size="child">Go to Home</Button>
        </Link>
      </div>
    </Card>
  );
}
```

Component only shows "Go to Home" button, no list selection UI.

**Expected Behavior**:

- Display all available word lists
- Child can click a list to start practicing
- Lists should be fetched from database and displayed as clickable cards

**Impact**: HIGH - Children cannot play any games

**Fix Required**:

- Fetch word lists using `useWordLists()` hook
- Display each list as a clickable card
- Pass `listId` as URL param when list is selected
- Implement in both PlayListenType.tsx and PlaySaySpell.tsx

---

## 🔴 CRITICAL BUG #3: Word Count Display Incorrect

**Status**: MEDIUM - UI display bug
**Component**: `src/app/pages/parent/Lists.tsx`
**Location**: Lines ~215 (table display)

**Description**: Word lists show incorrect word counts (all showing "1 word" when actual counts are 4 and 10).

**Current Query** (`src/app/api/supa.ts` line 836-848):

```typescript
const { data, error } = await supabase
  .from("word_lists")
  .select(
    `
    *,
    list_words (count)
  `
  )
  .eq("created_by", userId)
  .order("created_at", { ascending: false });

// Transform to include word count
return (data || []).map((list) => ({
  ...list,
  word_count: Array.isArray(list.list_words)
    ? list.list_words.length
    : (list.list_words as { count?: number })?.count || 0,
  words: [], // Will be populated when fetching individual list
})) as WordListWithWords[];
```

**Diagnosis**: Supabase `.select('list_words (count)')` returns `[{ count: N }]`, but code checks if it's an array and uses `.length` which is always 1.

**Impact**: MEDIUM - Misleading UI, but doesn't block functionality

**Fix Required**:

- Update word count extraction logic to properly parse Supabase count aggregation
- Test with actual data to verify correct counts

---

## 🔴 CRITICAL BUG #4: Audio Recording Not Working

**Status**: CRITICAL - Blocks content creation
**Component**: `src/app/components/AudioRecorder.tsx`
**Location**: Used in `src/app/pages/parent/ListEditor.tsx`

**Description**: Audio recording functionality doesn't work in parent list editor

**Current State**:

- AudioRecorder component imported and rendered
- No specific error message provided by user
- Need to investigate: microphone permissions, MediaRecorder API, WaveSurfer.js integration

**Possible Causes**:

1. Microphone permissions not requested/denied
2. MediaRecorder API not supported in browser
3. WaveSurfer.js initialization error
4. Event handlers not wired correctly

**Impact**: HIGH - Parents cannot add audio prompts to words

**Fix Required**:

- Add error logging to AudioRecorder component
- Check microphone permission flow
- Verify MediaRecorder API compatibility
- Test audio recording end-to-end

---

## Additional Issues to Investigate

### 1. List Populating on Child Dashboard

**Reported**: "They populate on the kids dashboard, but they are not clickable"

**Need to check**:

- Child Home page list display
- Are lists fetching correctly?
- Are click handlers working?
- Are navigation links correct?

---

## Fix Priority Order

1. **BUG #2**: Fix game list selection (BLOCKING gameplay)
2. **BUG #1**: Add child account creation UI (BLOCKING parent workflow)
3. **BUG #4**: Fix audio recording (BLOCKING content creation)
4. **BUG #3**: Fix word count display (UI polish)
5. Investigate child dashboard click issues

---

## Next Steps

1. Fix ListSelector component in both game pages
2. Create child account management UI
3. Debug audio recording component
4. Fix word count aggregation
5. Full end-to-end testing after fixes
