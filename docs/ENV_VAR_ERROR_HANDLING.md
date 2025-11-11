# Environment Variable Error Handling

## Overview

SpellStars now provides graceful error handling for missing Supabase environment variables, preventing confusing crashes and guiding developers through proper setup.

## Implementation Details

### 1. Enhanced `src/app/supabase.ts`

**Previous Behavior:**

- Threw generic error: "Missing Supabase environment variables"
- No guidance on resolution
- Same behavior in dev and production

**New Behavior:**

- Development: Throws immediately with detailed setup instructions
- Production: Returns null client, allowing app to show friendly error page
- Exports helper functions: `hasSupabaseConfig()`, `getSupabaseConfigErrors()`
- Detailed error logging via `logger` utility

**Benefits:**

- Fail-fast in development (catch issues early)
- Graceful degradation in production (user-friendly error page)
- Clear actionable error messages

### 2. New `src/app/components/SetupError.tsx`

User-friendly error component displayed when configuration is missing:

**Features:**

- Large, clear error message with alert icon
- Detailed list of missing configuration items
- Step-by-step setup guide (both .env and Doppler methods)
- Links to Supabase Dashboard
- References to documentation files
- Styled consistently with app theme

**When Displayed:**

- Production only (development throws immediately)
- Only when both or either env vars are missing
- Replaces entire app UI to prevent cascading errors

### 3. Updated `src/app/main.tsx`

**Changes:**

- Imports `hasSupabaseConfig()`, `getSupabaseConfigErrors()`, and `SetupError`
- Checks configuration before rendering router
- Conditionally renders either `SetupError` or main app
- Only applies check in production (dev still fails fast)

**Flow:**

```typescript
if (!hasSupabaseConfig() && !import.meta.env.DEV) {
  // Show SetupError component
} else {
  // Render normal app
}
```

### 4. Enhanced `.env.example`

**New Content:**

- Detailed header with quick start guide
- Step-by-step instructions for getting Supabase credentials
- Links to Supabase Dashboard sections
- Doppler setup instructions with benefits
- Migration token explanation (SUPABASE_ACCESS_TOKEN)
- Comprehensive troubleshooting section
- Common error scenarios with solutions

**Sections:**

1. Quick Start Guide
2. Supabase Project URL instructions
3. Supabase Anonymous Key instructions
4. Doppler alternative setup
5. Migration scripts token (separate from app)
6. Troubleshooting common errors

### 5. Updated `docs/DEPLOYMENT.md`

**New Sections:**

- Prerequisites expanded with Supabase setup steps
- Environment variables section with credential retrieval guide
- Local development setup (both .env and Doppler)
- Error handling explanation (dev vs prod)
- Database migration instructions
- Troubleshooting section for environment variable issues

**Key Additions:**

- How to get Supabase credentials (step-by-step)
- Warning about `anon public` vs `service_role` keys
- Doppler setup instructions
- Environment variable troubleshooting subsection

## Developer Experience Improvements

### Before Changes

❌ Generic error: "Missing Supabase environment variables"
❌ No guidance on what's missing
❌ No instructions on how to fix
❌ Same confusing error in dev and production
❌ App crashes immediately

### After Changes

✅ Development: Detailed error with exact missing vars and setup steps
✅ Production: User-friendly error page with setup guide
✅ Clear .env.example with comprehensive instructions
✅ Deployment docs explain credential retrieval
✅ Multiple setup paths documented (env file + Doppler)
✅ Troubleshooting section for common issues

## Testing

### Test Missing Environment Variables

**Development Mode:**

```bash
# 1. Rename or remove .env file
mv .env .env.backup

# 2. Try to start dev server
npm run dev

# Expected: Immediate error with detailed instructions
# Example output:
# Error: Missing required Supabase environment variables:
# VITE_SUPABASE_URL is not set
# VITE_SUPABASE_ANON_KEY is not set
#
# Please create a .env file with:
# VITE_SUPABASE_URL=your_supabase_url
# VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
#
# Or use Doppler: doppler run -- npm run dev
# See docs/DEPLOYMENT.md for setup instructions.
```

**Production Build:**

```bash
# 1. Rename or remove .env file
mv .env .env.backup

# 2. Build and preview
npm run build
npm run preview

# Expected: App loads with SetupError component
# Shows friendly error page with setup instructions
```

### Test Partial Configuration

```bash
# Set only one variable
export VITE_SUPABASE_URL=https://test.supabase.co

# Start dev server
npm run dev

# Expected: Error indicates VITE_SUPABASE_ANON_KEY is missing
```

### Test Valid Configuration

```bash
# Restore .env file
mv .env.backup .env

# Start dev server
npm run dev

# Expected: App starts normally, no errors
```

## Security Considerations

### Development vs Production

**Why different behavior?**

- **Development**: Fail-fast prevents wasting time debugging cascading errors
- **Production**: Graceful error page prevents white screen, provides guidance

### Environment Variable Safety

- `VITE_SUPABASE_ANON_KEY` is safe for client-side use
- Protected by Row Level Security (RLS) policies
- Never use `service_role` key in client code
- `.env.example` includes warning about key types

### Logging

- Missing vars logged via `logger` utility
- Sensitive data redaction already built into logger
- Includes `isDev` flag in logs for context
- Errors include specific missing variable names (not values)

## Related Files

- `src/app/supabase.ts` - Supabase client with error handling
- `src/app/components/SetupError.tsx` - Error display component
- `src/app/main.tsx` - App initialization with config check
- `.env.example` - Environment variable template with instructions
- `docs/DEPLOYMENT.md` - Deployment guide with setup instructions
- `src/lib/logger.ts` - Logging utility (used for error reporting)

## Future Enhancements

### Potential Improvements

1. **Runtime config validation**: Check Supabase connection on app start
2. **Config health endpoint**: API endpoint to verify configuration
3. **Setup wizard**: Interactive first-run setup flow
4. **Auto-detection**: Detect Doppler presence and suggest usage
5. **Migration checker**: Verify migrations applied before running app

### Monitoring

Consider adding:

- Error tracking for configuration issues (Sentry)
- Analytics for setup error page views
- Alerting when production deployment has config issues

## Migration Guide

### For Existing Deployments

If you have existing deployments, no action needed unless:

1. **Environment variables not set**: Follow new setup guide in `.env.example`
2. **Using old .env**: Update with new template for better documentation
3. **Team onboarding**: Share updated `docs/DEPLOYMENT.md` with team

### For New Deployments

1. Read `docs/DEPLOYMENT.md` prerequisites section
2. Follow environment variable setup instructions
3. Choose .env file or Doppler based on team needs
4. Verify setup works locally before deploying

## Support Resources

- `.env.example` - Comprehensive setup template
- `docs/DEPLOYMENT.md` - Full deployment guide
- `docs/QUICKSTART.md` - Quick start guide
- Supabase Dashboard: <https://supabase.com/dashboard>
- Doppler Docs: <https://docs.doppler.com>

## Conclusion

These changes significantly improve the developer experience when setting up SpellStars by:

1. Providing clear, actionable error messages
2. Including comprehensive setup documentation
3. Offering multiple setup paths (env file + Doppler)
4. Preventing confusing cascading errors
5. Guiding users through proper configuration

The implementation balances fail-fast development workflow with user-friendly production error handling.
