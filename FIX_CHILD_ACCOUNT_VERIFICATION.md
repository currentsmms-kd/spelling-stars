# Fix: Child Account Email Verification Issue

**Date:** November 15, 2025
**Issue:** Child accounts require email verification, but children don't have access to parent's email inbox

## Problem Summary

When parents create child accounts:

1. Supabase sends verification email to `parent+childusername@domain.com`
2. Email goes to parent's inbox (via plus-addressing)
3. Parent clicks verification link
4. Child still can't log in - shows "Email not verified"
5. The verification link redirects to login page but doesn't actually confirm the account

## Root Cause

- **Production Supabase has email confirmation ENABLED** (Dashboard setting)
- Child accounts use parent's email with plus-addressing
- The email verification flow redirects to login page but the account remains unconfirmed
- Local config has `enable_confirmations = false` but production overrides this

## Solution #1: Disable Email Confirmation (RECOMMENDED)

**Best for:** This app since parents create child accounts

### Steps:

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/[your-project-id]
2. Navigate to **Authentication** → **Email Auth**
3. Find setting: **"Confirm email"**
4. **Toggle it OFF** (disable email confirmation)
5. Click **Save**

**Why this works:**

- Parents are authenticated users creating child accounts
- Email verification adds no security benefit (parent controls everything)
- Simplifies user experience
- Matches local development config

**After applying:**

- New child accounts work immediately
- No email verification required
- Existing unverified accounts still need manual fix (see Solution #3)

---

## Solution #2: Auto-Confirm via Edge Function (Advanced)

**Best for:** If you need email confirmation for parent accounts but not child accounts

### Implementation Status: ✅ Live

We now ship an Edge Function that creates and confirms child accounts using the service role so we never touch `auth.users` via SQL. Frontend calls this function right after parents submit the create-child form.

**Function:** `supabase/functions/auto-confirm-child/index.ts`

Key behavior:

- Validates username/password/display name server-side (mirrors UI validation)
- Uses parent session (Authorization header) to verify parent role
- Generates plus-addressed child email using parent email automatically
- Creates the child via `supabase.auth.admin.createUser()` with `email_confirm: true`
- Updates `profiles` with parent relationship metadata
- Returns `loginEmail`, `username`, and `userId` so UI can show login instructions

### Deploy Steps

```powershell
# Ensure env vars SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in the function
corepack pnpm supabase functions deploy auto-confirm-child --project-ref <PROJECT_REF>

# (Optional) Test locally
corepack pnpm supabase functions serve auto-confirm-child --env-file supabase/.env
```

**Required Edge Function secrets (Supabase Dashboard → Edge Functions → Secrets):**

| Name                             | Value                                  |
| -------------------------------- | -------------------------------------- |
| `EDGE_SUPABASE_URL`              | Project URL (https://xxxx.supabase.co) |
| `EDGE_SUPABASE_ANON_KEY`         | anon key from project settings         |
| `EDGE_SUPABASE_SERVICE_ROLE_KEY` | service role key                       |

> Supabase forbids secrets that start with `SUPABASE_` for Edge Functions, so these keys use the `EDGE_` prefix. The function reads them via `Deno.env.get("EDGE_SUPABASE_*")`.

### Client Integration

`src/app/pages/parent/ChildManagement.tsx` now calls the function:

```typescript
const { data, error } = await supabase.functions.invoke("auto-confirm-child", {
  body: { username, password, displayName },
});

if (error) throw error;
```

The UI displays `data.loginEmail` from the function response so parents can copy/paste credentials immediately.

---

## Solution #3: Manually Confirm Existing Accounts

**Use this to fix accounts already created and stuck in unverified state**

### Option A: Via Supabase Dashboard

1. Go to **Authentication** → **Users**
2. Find the child account (search by email: `parent+username@domain.com`)
3. Click the user
4. Click **"Confirm email"** button
5. Child can now log in

### Option B: Via SQL (Bulk Fix)

Run this in Supabase SQL Editor:

```sql
-- Confirm all child accounts (where role='child' in metadata)
UPDATE auth.users
SET
  email_confirmed_at = NOW(),
  confirmed_at = NOW()
WHERE
  raw_user_meta_data->>'role' = 'child'
  AND email_confirmed_at IS NULL;

-- Verify
SELECT
  id,
  email,
  email_confirmed_at,
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data->>'username' as username
FROM auth.users
WHERE raw_user_meta_data->>'role' = 'child';
```

---

## Recommended Approach

**For immediate fix:**

1. ✅ Apply **Solution #1** (disable email confirmation in dashboard)
2. ✅ Apply **Solution #3B** (bulk confirm existing child accounts via SQL)

**Total time:** 2 minutes

**Why this is best:**

- Simple, no code changes required
- Matches the app's design (parents control child accounts)
- Fixes all existing stuck accounts
- Prevents future issues

---

## Verification

After applying fix, test:

1. **Create new child account:**

   ```
   - Go to /parent/children
   - Click "Add Child"
   - Enter username: testchild
   - Enter password: test123
   ```

2. **Log out and try child login:**

   ```
   - Click "Sign Out"
   - Go to login page
   - Enter username: testchild
   - Enter password: test123
   - Should login successfully ✅
   ```

3. **Check no email sent:**
   - Parent shouldn't receive verification email
   - Child account works immediately

---

## Why the Migration Failed

The attempted migration (`20251115000000_auto_confirm_child_accounts.sql`) failed with:

```
ERROR: 42501: must be owner of relation users
```

**Reason:** The `auth.users` table is managed by Supabase Auth service, not accessible to regular database triggers. We cannot create triggers on protected auth schema tables.

**Alternative:** Edge Functions with Service Role key (Solution #2) or Dashboard settings (Solution #1)

---

## Production Configuration Update

Update your production Supabase project to match local config:

**File:** `supabase/config.toml` (lines 96-97)

```toml
[auth.email]
# ...
enable_confirmations = false  # ← Should be disabled for this app
```

**Note:** This config only applies to local Supabase. For hosted Supabase, change via Dashboard.

---

## Security Considerations

**Is it safe to disable email confirmation?**

✅ **Yes, for this app:**

- Child accounts created by **authenticated parents** only
- Parents are verified via their own email
- Children don't have real email addresses
- Parent email plus-addressing (`parent+child@domain.com`) is internal implementation
- Row Level Security (RLS) enforces parent-child relationships

**Still secure because:**

- Passwords still required and hashed
- RLS policies prevent unauthorized access
- Parent must be logged in to create child accounts
- Children can only access their own data

---

## Related Files

- `src/app/pages/parent/ChildManagement.tsx` - Child account creation
- `src/app/pages/auth/Login.tsx` - Login flow (handles usernames)
- `supabase/config.toml` - Local auth configuration
- `supabase/migrations/20251110000000_fix_child_profile_creation.sql` - Profile creation trigger

---

## Questions?

**Q: Will existing parent accounts need to reverify?**
A: No, only affects new signups. Existing accounts unchanged.

**Q: Can I re-enable later?**
A: Yes, toggle back on in Dashboard. Existing accounts remain confirmed.

**Q: What about forgot password?**
A: Parents reset child passwords via parent dashboard (feature to be added)

---

## Next Steps

1. ✅ Disable email confirmation in Supabase Dashboard (2 min)
2. ✅ Run SQL to confirm existing child accounts (30 sec)
3. ✅ Test child account creation and login
4. ⏭️ (Optional) Add "Reset Child Password" button in parent dashboard
5. ⏭️ (Optional) Document parent-controlled password reset flow

---

**Status:** Ready to implement
**Estimated Fix Time:** 2-3 minutes
**Risk Level:** Low (config change only, easily reversible)
