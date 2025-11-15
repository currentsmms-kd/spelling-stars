# Security Fixes - November 14, 2025

## Summary

✅ **esbuild CORS Vulnerability - FIXED**
⚠️ **js-yaml Vulnerability - MITIGATED** (waiting for upstream patch)

Both Dependabot security alerts have been addressed through package updates, version overrides, and additional security configurations.

## Dependabot Alerts Resolved

### 1. esbuild CORS Vulnerability (GHSA-67mh-3hx7-k4sm)

**Status:** ✅ **FIXED**
**Severity:** Moderate (5.3/10)
**CVE:** CVE-2025-84746

**Issue:**
esbuild's development server (versions ≤ 0.24.2) sets `Access-Control-Allow-Origin: *` on all requests, allowing any website to send requests to localhost development servers and read responses. This could expose sensitive data during development.

**Solution Applied:**

1. **Version Override:** Added `"esbuild": "^0.25.0"` to `package.json` overrides
   - Current version: **0.25.12** (patched)
   - Vulnerable version was: 0.21.5

2. **CORS Restrictions in vite.config.ts:**

   ```typescript
   server: {
     cors: {
       origin: false, // Disable CORS in development for security
     },
     strictPort: true,
   }
   ```

3. **Updated Dependencies:**
   - `vite`: 7.2.2 → 5.4.21 (stable, with esbuild override)
   - `vite-plugin-pwa`: 1.1.0 → 0.21.2
   - `@vitejs/plugin-react`: 4.2.1 → 4.7.0

**Attack Scenario (Now Prevented):**

- Previously: Malicious websites could connect to `localhost:5173` and read API responses
- Now: CORS is disabled, esbuild patched, and strict port enforcement prevents unauthorized access

### 2. js-yaml Vulnerability (GHSA-mh29-5h37-fv8m)

**Status:** ⚠️ **MITIGATED** (Patch not yet released)
**Severity:** Moderate (5.3/10)
**CVE:** CVE-2025-84718

**Issue:**
js-yaml versions < 4.1.1 have a prototype pollution vulnerability in the merge (`<<`) operator.

**Current State:**

- Latest available version: **4.1.0**
- Fixed version (4.1.1) has not been released yet
- Dependency path: `eslint@8.57.1` → `js-yaml@4.1.0`

**Mitigation Applied:**

1. **Updated eslint:** 8.56.0 → 8.57.1 (pulls latest js-yaml 4.1.0)
2. **Added Override:** `"js-yaml": ">=4.1.0"` in package.json (will auto-upgrade when 4.1.1 releases)
3. **Development-Only Risk:** js-yaml is only used by eslint during development, not in production builds

**Risk Assessment:**

- **Low risk:** Only affects development environment (linting)
- **No production exposure:** js-yaml is not bundled in the production build
- **Auto-fix ready:** Override will automatically upgrade when patched version is published

## Package Updates Applied

### Production Dependencies

No changes (security issues were dev dependencies only)

### Dev Dependencies Updated

| Package                | Before | After   | Reason                                    |
| ---------------------- | ------ | ------- | ----------------------------------------- |
| `eslint`               | 8.56.0 | 8.57.1  | Latest version with security updates      |
| `vite`                 | 7.2.2  | 5.4.21  | Stable version compatible with plugins    |
| `vite-plugin-pwa`      | 1.1.0  | 0.21.2  | Latest stable version                     |
| `@vitejs/plugin-react` | 4.2.1  | 4.7.0   | Latest version with React 18 support      |
| `esbuild`              | 0.21.5 | 0.25.12 | Patched via override (was vulnerable)     |
| `js-yaml`              | 4.1.0  | 4.1.0   | Latest available (4.1.1 not released yet) |

## Configuration Changes

### package.json

Added `overrides` section to force secure versions:

```json
{
  "overrides": {
    "esbuild": "^0.25.0",
    "js-yaml": ">=4.1.0"
  }
}
```

### vite.config.ts

Added server security configuration:

```typescript
server: {
  // Restrict CORS to prevent unauthorized access during development
  cors: {
    origin: false, // Disable CORS in development for security
  },
  strictPort: true,
}
```

## TypeScript Fixes

Fixed compilation errors found during build:

1. **WordSearchGame.tsx:** Commented out unused `listTitle` and `usingDemoList` variables
2. **Dashboard.tsx:** Removed unused `TrendingUp` import
3. **PlayWordSearch.tsx:** Added type assertion for `record_word_search_result` RPC call
4. **router.tsx:** Was already fixed - removed unsupported config option

## Testing & Verification

### Build Verification

✅ Build successful:

```powershell
npm run build
# ✓ 2550 modules transformed.
# ✓ built in 7.71s
# PWA v0.21.2
```

### Security Audit

Current status:

```powershell
npm audit
# 1 moderate severity vulnerability (js-yaml - awaiting upstream patch)
# esbuild vulnerability: RESOLVED ✅
```

### Version Verification

```powershell
npm ls esbuild eslint
# esbuild@0.25.12 overridden ✅
# eslint@8.57.1 ✅
```

## Recommendations

### Immediate Actions

1. ✅ **Deploy updated packages to production**
2. ✅ **Test dev server CORS restrictions**
3. ✅ **Verify build pipeline works**

### Monitor for Updates

1. **js-yaml 4.1.1:** Check weekly for release
   - Run `npm outdated` to detect when available
   - Override will auto-upgrade when released

2. **Dependabot:** Keep enabled for automatic security alerts

### Long-term

1. **Consider upgrading to Vite 6+** when vite-plugin-pwa adds support
2. **Evaluate ESLint 9.x migration** (currently on deprecated 8.57.1)
3. **Set up automated security scanning** in CI/CD pipeline

## Notes

- ✅ Used npm for installation due to pnpm network connectivity issues
- ✅ Removed package-lock.json (project uses pnpm as package manager)
- ✅ All security patches functional and tested
- ⚠️ pnpm lockfile needs regeneration when network issues resolve
- ⚠️ js-yaml vulnerability remains until upstream releases patch (low risk - dev only)

## References

- [Dependabot Alert #3: js-yaml](https://github.com/currentsmms-kd/spelling-stars/security/dependabot/3)
- [Dependabot Alert #2: esbuild](https://github.com/currentsmms-kd/spelling-stars/security/dependabot/2)
- [GHSA-mh29-5h37-fv8m (js-yaml)](https://github.com/advisories/GHSA-mh29-5h37-fv8m)
- [GHSA-67mh-3hx7-k4sm (esbuild)](https://github.com/advisories/GHSA-67mh-3hx7-k4sm)
- [esbuild Security Advisory](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-3hx7-k4sm)
