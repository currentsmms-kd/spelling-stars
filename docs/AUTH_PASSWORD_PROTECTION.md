# Auth Leaked Password Protection Configuration

## Issue

Supabase Advisor Warning: **Leaked Password Protection Disabled**

**Level:** WARN
**Category:** SECURITY
**Description:** Leaked password protection is currently disabled.

## What This Means

Supabase Auth can prevent users from setting compromised passwords by checking against the HaveIBeenPwned.org database. This feature is currently disabled for this project.

## Why This Warning Exists

When enabled, Supabase will:

1. Check new passwords against the HaveIBeenPwned database during signup
2. Check passwords during password reset/change operations
3. Reject passwords that have been found in data breaches
4. Enhance overall account security

## How to Enable (Dashboard Configuration)

This setting **cannot** be configured via SQL migration. It must be enabled through the Supabase Dashboard:

### Steps

1. Go to your Supabase project dashboard: <https://supabase.com/dashboard/project/[project-id>]
2. Navigate to **Authentication** → **Policies**
3. Find the **Password Policy** section
4. Enable **"Check passwords against HaveIBeenPwned"**
5. Save changes

### Alternative: Supabase CLI (if using local dev)

If you're using local Supabase development:

```bash
# Update config.toml
[auth.password]
hibp_enabled = true
```

Then restart your local Supabase instance.

## Impact Assessment

### Pros (Why You Should Enable This)

- ✅ Prevents users from setting commonly breached passwords
- ✅ Reduces risk of account takeover attacks
- ✅ Industry best practice for password security
- ✅ No impact on existing users (only affects new passwords)
- ✅ Minimal performance impact (Supabase caches results)

### Cons (Minor Considerations)

- ⚠️ Slight delay during signup/password change (~100-200ms)
- ⚠️ Users may need to choose different passwords if theirs are breached
- ⚠️ Requires internet connectivity to HaveIBeenPwned API

## Recommendation

**✅ ENABLE THIS FEATURE**

For a children's spelling app where parents create accounts, this is a valuable security feature that:

- Protects parent accounts (which control child data)
- Educates users about password security
- Prevents common password choices that are easily compromised

## Additional Resources

- [Supabase Password Security Docs](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- [HaveIBeenPwned API](https://haveibeenpwned.com/API/v3)
- [Database Linter Documentation](https://supabase.com/docs/guides/database/database-linter)

## Action Items

- [ ] Enable leaked password protection in Supabase Dashboard (Authentication → Policies)
- [ ] Test signup with a known breached password (e.g., "password123")
- [ ] Verify error message is user-friendly
- [ ] Update user-facing documentation if needed
