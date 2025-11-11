# Username Validation and Uniqueness Implementation

## Overview

This document describes the username validation and uniqueness checking implementation for child account creation in SpellStars. The system ensures that child usernames are valid, unique, and properly validated before account creation.

## Implementation Date

November 10, 2025

## Problem Statement

Previously, child account creation lacked:

1. Front-end validation for username format and constraints
2. Uniqueness checking before attempting to create accounts
3. Clear user feedback about username availability
4. Reserved username protection
5. Documentation about the username-to-email conversion mechanism

## Solution

### Username Validation Rules

#### Format Requirements

- **Length**: 3-30 characters
- **Characters**: Letters (a-z, A-Z) and numbers (0-9) only
- **Start character**: Must begin with a letter
- **No special characters**: No spaces, symbols, or punctuation
- **Case handling**: Automatically converted to lowercase

#### Reserved Usernames

The following usernames are blocked to prevent conflicts with system accounts:

```typescript
const RESERVED_USERNAMES = [
  "admin",
  "administrator",
  "root",
  "system",
  "spellstars",
  "support",
  "help",
  "info",
  "contact",
  "noreply",
  "no-reply",
  "postmaster",
  "hostmaster",
  "webmaster",
  "parent",
  "child",
  "user",
  "guest",
  "test",
  "demo",
];
```

### Username-to-Email Conversion

Child usernames are internally converted to email format for Supabase authentication:

```typescript
const generatedEmail = `${username}@spellstars.app`;
```

**Why `.app` domain?**

- Valid top-level domain (TLD) that satisfies Supabase email validation
- Clearly distinguishes internal child accounts from parent email accounts
- Not a real domain used for external communication

**User Experience:**

- Children login with just their username (e.g., "sally")
- Parents login with their real email (e.g., "parent@example.com")
- The email conversion is transparent to users

## Implementation Details

### Key Functions

#### `validateUsername(username: string): string | null`

Validates username format and checks against reserved names.

**Returns:**

- `null` if valid
- Error message string if invalid

**Checks:**

1. Non-empty
2. Length constraints (3-30 chars)
3. Alphanumeric only
4. Starts with a letter
5. Not a reserved name

#### `checkUsernameAvailability(username: string): Promise<{available: boolean, message?: string}>`

Checks if username is already taken using a clever client-side workaround.

**Strategy:**

Since Supabase doesn't expose `auth.users` to clients, we use the authentication system itself:

1. Attempt sign-in with generated email and dummy password
2. Parse the error response:
   - `"Invalid login credentials"` → User exists (username taken)
   - `"Email not confirmed"` → User exists (username taken)
   - `"User not found"` → Username available
   - Other errors → Assume available (let signUp handle it)

**Why this approach?**

- No need for admin API or edge functions
- Works within client security constraints
- Provides immediate feedback
- Fallback behavior is safe (signUp will catch actual conflicts)

### User Interface Integration

#### Real-time Validation

```typescript
const handleUsernameChange = (value: string) => {
  setChildUsername(value.toLowerCase());
  setUsernameError(null); // Clear error when user types
};
```

**When user types:**

- Input converted to lowercase
- Previous errors cleared
- Validation deferred until blur

#### On-blur Validation

```typescript
const handleUsernameBlur = async () => {
  // 1. Validate format
  const validationError = validateUsername(childUsername);
  if (validationError) {
    setUsernameError(validationError);
    return;
  }

  // 2. Check availability
  setIsCheckingUsername(true);
  const { available, message } = await checkUsernameAvailability(childUsername);

  if (!available) {
    setUsernameError(message);
  }

  setIsCheckingUsername(false);
};
```

**When user leaves field:**

1. Format validation (instant)
2. Availability check (async with loading indicator)
3. Display results or errors

#### Form Submission

```typescript
const handleCreateChild = async (e: React.FormEvent) => {
  e.preventDefault();

  // 1. Validate format
  const validationError = validateUsername(childUsername);
  if (validationError) {
    setUsernameError(validationError);
    return;
  }

  // 2. Check availability
  setIsCheckingUsername(true);
  const { available, message } = await checkUsernameAvailability(childUsername);

  if (!available) {
    setUsernameError(message);
    setIsCheckingUsername(false);
    return;
  }

  // 3. Create account
  createChild.mutate({ username, password, displayName, parentId });
};
```

**Before submission:**

1. Re-validate format (in case bypass)
2. Re-check availability (in case race condition)
3. Only proceed if both pass

### Visual Feedback

#### Username Input Field

```tsx
<input
  id="childUsername"
  type="text"
  value={childUsername}
  onChange={(e) => handleUsernameChange(e.target.value)}
  onBlur={handleUsernameBlur}
  className={`... ${usernameError ? "border-destructive" : ""}`}
  disabled={isCheckingUsername}
  minLength={USERNAME_MIN_LENGTH}
  maxLength={USERNAME_MAX_LENGTH}
  pattern="^[a-zA-Z][a-zA-Z0-9]*$"
/>
```

**States:**

- Normal: Default styling
- Checking: Disabled with spinner
- Error: Red border + error message
- Valid: Success state (implied by no error)

#### Loading Indicator

```tsx
{
  isCheckingUsername && (
    <div className="absolute right-3 top-1/2 -translate-y-1/2">
      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
```

Shows animated spinner while checking availability.

#### Error Messages

```tsx
{
  usernameError ? (
    <p className="text-xs text-destructive mt-1">{usernameError}</p>
  ) : (
    <p className="text-xs text-muted-foreground mt-1">
      3-30 characters, letters and numbers only, must start with a letter. This
      creates a login username (no email needed).
    </p>
  );
}
```

**Dynamic helper text:**

- Error state: Shows specific error message
- Normal state: Shows format requirements and clarifies no email needed

#### Submit Button

```tsx
<Button
  type="submit"
  disabled={
    createChild.isPending || isCheckingUsername || Boolean(usernameError)
  }
>
  {isCheckingUsername
    ? "Checking username..."
    : createChild.isPending
      ? "Creating..."
      : "Create Child Account"}
</Button>
```

**Button states:**

- Checking: "Checking username..." (disabled)
- Creating: "Creating..." (disabled)
- Ready: "Create Child Account" (enabled)
- Error: Disabled if validation error exists

### Error Handling

#### Enhanced Mutation Error Handler

```typescript
onError: (error) => {
  let errorMessage = "Failed to create child account";

  if (error instanceof Error) {
    if (error.message.includes("user already registered")) {
      errorMessage = "This username is already taken.";
      setUsernameError("Username already taken");
    } else if (error.message.includes("password")) {
      errorMessage = "Password does not meet requirements (min 6 characters)";
    } else if (error.message.includes("email")) {
      errorMessage = "Invalid username format.";
    }
  }

  logger.error(errorMessage);
};
```

**Handles edge cases:**

- Race conditions (username taken between check and creation)
- Network failures during availability check
- Supabase-specific errors
- Updates UI state to show relevant errors

## User Flow

### Happy Path

1. Parent clicks "Add Child"
2. Fills in child's name
3. Types username → auto-converts to lowercase
4. Leaves username field (blur) → validation + availability check
5. ✅ Green checkmark (implied by no error)
6. Fills in password
7. Clicks "Create Child Account"
8. Account created successfully

### Error Path: Invalid Format

1. Parent types "my child" (contains space)
2. Leaves field → Format validation fails
3. ❌ Red border + "Username can only contain letters and numbers"
4. Submit button disabled
5. Parent fixes username
6. Validation passes → Submit enabled

### Error Path: Username Taken

1. Parent types "sally"
2. Leaves field → Format valid, checking availability...
3. ❌ "Username already taken"
4. Submit button disabled
5. Parent tries "sally2"
6. ✅ Available → Submit enabled

### Error Path: Reserved Name

1. Parent types "admin"
2. Leaves field → Format validation fails
3. ❌ "This username is reserved and cannot be used"
4. Submit button disabled
5. Parent chooses different username

## Testing Considerations

### Manual Testing Checklist

- [ ] Username too short (< 3 chars)
- [ ] Username too long (> 30 chars)
- [ ] Username with spaces
- [ ] Username with special characters
- [ ] Username starting with number
- [ ] Reserved username
- [ ] Duplicate username
- [ ] Available username
- [ ] Network failure during check
- [ ] Race condition (username taken between check and create)
- [ ] Copy-paste username with trailing spaces
- [ ] Mixed case username (should convert to lowercase)

### Edge Cases Handled

1. **Empty username**: Caught by HTML required attribute + validateUsername
2. **Whitespace**: Trimming could be added if needed (currently rejected by pattern)
3. **Case sensitivity**: Auto-converted to lowercase
4. **Race conditions**: Double-check on submit
5. **Network errors**: Graceful fallback (assume available)
6. **Reserved names**: Blocked before API call
7. **Format issues**: Caught client-side before API call

## Security Considerations

### Why Client-Side Check is Safe

**Potential concern:** Client-side availability check could be bypassed.

**Mitigation:**

1. Server-side uniqueness enforced by Supabase auth system
2. Client check is UX enhancement, not security control
3. `signUp` will fail with proper error if username exists
4. No sensitive data exposed (we only check existence)

### Reserved Usernames

**Purpose:** Prevent conflicts with:

- System accounts
- Support/admin accounts
- Common test usernames
- Future feature names

**Implementation:** Client-side array is sufficient since:

- These are known values
- Server won't have conflicting accounts
- UX improvement to catch early

## Future Enhancements

### Potential Improvements

1. **Toast notifications**: Replace logger.error with toast UI
2. **Debounced checking**: Add delay to reduce API calls during typing
3. **Username suggestions**: "sally is taken, try sally2, sally123"
4. **Admin edge function**: Proper auth.users query for availability
5. **Batch validation**: Check multiple usernames at once
6. **Username history**: Show recently used usernames to avoid conflicts
7. **Strength indicator**: Visual feedback for good usernames

### Backend Enhancement (Future)

Create Supabase Edge Function for proper username checking:

```typescript
// supabase/functions/check-username/index.ts
export default async (req: Request) => {
  const { username } = await req.json();
  const email = `${username}@spellstars.app`;

  // Admin API can query auth.users
  const { data } = await supabase.auth.admin.listUsers();
  const exists = data.users.some((u) => u.email === email);

  return Response.json({ available: !exists });
};
```

**Benefits:**

- Direct auth.users query
- No dummy password workaround
- Cleaner implementation

**Trade-off:**

- Requires edge function deployment
- Additional API endpoint to maintain
- Current solution works fine

## Documentation Updates

### Updated Files

1. **src/app/pages/parent/ChildManagement.tsx**
   - Added validation functions
   - Added availability checking
   - Enhanced form UI
   - Improved error handling

2. **docs/PARENT_PAGES_SETUP.md**
   - Added "Creating Child Accounts" section
   - Documented username requirements
   - Explained email conversion
   - Listed reserved usernames

3. **docs/USERNAME_VALIDATION.md** (this file)
   - Complete implementation documentation
   - User flows
   - Technical details
   - Testing guidance

## Related Documentation

- **USERNAME_AUTH_IMPLEMENTATION.md**: Original username-based auth design
- **PARENT_PAGES_SETUP.md**: Parent features user guide
- **AUTH_PASSWORD_PROTECTION.md**: Overall authentication security

## Conclusion

This implementation provides robust username validation with excellent UX:

✅ Clear format requirements
✅ Reserved username protection
✅ Real-time availability checking
✅ User-friendly error messages
✅ Proper documentation
✅ Edge case handling
✅ Security considerations

The username-to-email conversion is transparent to users while satisfying Supabase's authentication requirements. Children get simple username-based login while parents use standard email authentication.
