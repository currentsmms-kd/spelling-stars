# Minor Issues - Agent Prompts

## Issue #19: TODO Comment in Production Code

### Prompt for Agent

````
TASK: Remove TODO comment from wordsearch.ts and create GitHub issue for unit tests

CONTEXT:
`src/lib/wordsearch.ts` line 142 has TODO comment about adding unit tests. This is tech debt tracking that should be in issue tracker, not source code.

FINDINGS:
- Line 142: `// TODO: Add unit tests for fits(), getLineCells(), and generateGrid() flows once`
- Comment appears to be old (references functions that may have changed)
- No corresponding GitHub issue exists
- TODO clutters code with non-functional metadata

PROBLEM:
- Code comments not the right place for project management
- TODOs become stale and forgotten
- Makes codebase look unfinished
- Confuses new developers about priority

IMPACT:
- Low - just maintenance/clarity issue

RECOMMENDATION:
Remove comment, create GitHub issue with proper context.

FILES TO REVIEW:
- `src/lib/wordsearch.ts` (line 142)

IMPLEMENTATION:

**Step 1: Create GitHub Issue**

Title: "Add unit tests for word search grid generation"

Description:
```markdown
## Context
The wordsearch.ts module generates word search grids but lacks unit test coverage.

## Testing Scope
Need unit tests for:
- `fits()` - Checks if word fits in grid at position
- `getLineCells()` - Gets cells along a line (direction)
- `generateGrid()` - Main grid generation with word placement

## Test Cases Needed

### fits()
- [ ] Word fits horizontally in empty grid
- [ ] Word doesn't fit (extends past boundary)
- [ ] Word fits with existing letters (overlap valid)
- [ ] Word conflicts with existing letters
- [ ] Edge cases: single letter, grid boundaries

### getLineCells()
- [ ] Horizontal line (left to right)
- [ ] Vertical line (top to bottom)
- [ ] Diagonal line (8 directions)
- [ ] Line that exceeds grid bounds
- [ ] Empty line (length 0)

### generateGrid()
- [ ] Generates valid grid for simple word list
- [ ] Handles words that don't fit
- [ ] Fills empty cells with random letters
- [ ] Maintains word overlap rules
- [ ] Performance with large word lists (100+ words)

## Implementation Notes
- Use Vitest (aligns with Vite setup)
- Mock random functions for deterministic tests
- Test with various grid sizes (10x10, 20x20)
- Verify all words from input appear in grid

## Priority
Medium - Improves confidence in game functionality

## Related Files
- `src/lib/wordsearch.ts`
- `src/app/pages/child/PlayWordSearch.tsx`
````

Labels: `testing`, `enhancement`, `good-first-issue`

**Step 2: Remove TODO Comment**

In `src/lib/wordsearch.ts`, remove line 142:

```typescript
// Before (line 142):
/**
 * TODO: Add unit tests for fits(), getLineCells(), and generateGrid() flows once
 * the testing infrastructure is set up.
 */

// After:
// (comment removed - tracked in GitHub issue #XXX)
```

Or if you want to keep reference:

```typescript
// Unit test coverage tracked in issue #XXX
```

**Step 3: Link in Code (Optional)**

If you want traceability:

```typescript
/**
 * Generate word search grid with given words
 *
 * @see https://github.com/currentsmms-kd/spelling-stars/issues/XXX for test coverage
 */
export function generateGrid(words: string[], size: number): Grid {
  // ... implementation
}
```

ACCEPTANCE CRITERIA:

- [ ] GitHub issue created with full context
- [ ] TODO comment removed from wordsearch.ts
- [ ] Optional: Issue reference added to function JSDoc
- [ ] No other TODOs remain in src/lib/

DELIVERABLES:

1. GitHub issue link
2. Updated wordsearch.ts (comment removed)
3. Verification: `grep -r "TODO" src/lib/` shows no results

```

---

## Issue #20: Missing Accessibility Testing Automation

### Prompt for Agent

```

TASK: Add automated accessibility testing with eslint-plugin-jsx-a11y and axe-core

CONTEXT:
Documentation describes manual accessibility testing (keyboard navigation, screen readers) but no automated checks. Accessibility regressions could slip through.

FINDINGS:

- package.json has eslint but not eslint-plugin-jsx-a11y
- No axe-core or similar testing library
- No CI checks for accessibility
- Manual testing described in README

PROBLEM:
Without automated checks:

- Missing ARIA labels go unnoticed
- Improper heading hierarchy slips through
- Color contrast issues not caught
- Keyboard navigation breaks not detected

IMPACT:

- ACCESSIBILITY: Potential WCAG violations
- COMPLIANCE: Risk of failing accessibility audits
- UX: Users with disabilities face barriers

RECOMMENDATION:
Add eslint-plugin-jsx-a11y for static analysis and axe-core for runtime testing.

FILES TO REVIEW:

- `package.json`
- `.eslintrc.cjs` or similar
- `src/app/components/Button.tsx` - Reference for ARIA usage
- `README.md` - Accessibility section

IMPLEMENTATION:

**Step 1: Install Dependencies**

```bash
pnpm add -D eslint-plugin-jsx-a11y @axe-core/cli @axe-core/react
```

**Step 2: Configure ESLint**

Add to `.eslintrc.cjs`:

```javascript
module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended", // NEW
  ],
  plugins: ["react-refresh", "jsx-a11y"], // Add jsx-a11y
  rules: {
    // ... existing rules

    // Accessibility rules (customize as needed)
    "jsx-a11y/alt-text": "error",
    "jsx-a11y/aria-props": "error",
    "jsx-a11y/aria-proptypes": "error",
    "jsx-a11y/aria-unsupported-elements": "error",
    "jsx-a11y/click-events-have-key-events": "warn",
    "jsx-a11y/heading-has-content": "error",
    "jsx-a11y/no-static-element-interactions": "warn",
    "jsx-a11y/role-has-required-aria-props": "error",
    "jsx-a11y/role-supports-aria-props": "error",
  },
};
```

**Step 3: Add Axe Runtime Checks**

In `src/app/main.tsx` (dev only):

```typescript
if (import.meta.env.DEV) {
  // Axe accessibility checker in development
  import("@axe-core/react").then((axe) => {
    axe.default(React, ReactDOM, 1000, {
      // Configuration
      rules: [
        { id: "color-contrast", enabled: true },
        { id: "label", enabled: true },
        { id: "button-name", enabled: true },
      ],
    });
  });
}
```

**Step 4: Add Lint Script**

Update `package.json`:

```json
{
  "scripts": {
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "lint:a11y": "eslint . --ext ts,tsx --plugin jsx-a11y", // NEW
    "lint:fix": "eslint . --ext ts,tsx --fix" // NEW
  }
}
```

**Step 5: Add CI Check**

Create `.github/workflows/accessibility.yml`:

```yaml
name: Accessibility Checks

on: [push, pull_request]

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Run ESLint accessibility checks
        run: pnpm run lint:a11y

      - name: Build app
        run: pnpm run build

      - name: Run axe-core CLI
        run: npx @axe-core/cli dist/index.html
```

**Step 6: Fix Existing Violations**

Run lint and fix issues:

```bash
pnpm run lint:a11y
```

Common fixes:

- Add alt text to images
- Add ARIA labels to icon buttons
- Fix heading hierarchy
- Add keyboard handlers where needed

**Step 7: Document in README**

Add to README.md accessibility section:

````markdown
### Automated Accessibility Testing

**Static Analysis**

```bash
pnpm run lint:a11y
```
````

Checks for:

- Missing ARIA labels
- Improper heading hierarchy
- Interactive elements without keyboard support
- Missing alt text on images

**Runtime Checks (Development)**
Axe-core runs automatically in development mode.
Open browser console to see accessibility violations.

**CI/CD**
Accessibility checks run automatically on every push.
PRs with violations will fail checks.

```

ACCEPTANCE CRITERIA:
- [ ] eslint-plugin-jsx-a11y installed and configured
- [ ] ESLint rules enforced (warnings or errors)
- [ ] Axe-core runs in development
- [ ] Lint script added to package.json
- [ ] CI workflow checks accessibility
- [ ] All existing violations fixed
- [ ] Documentation updated

TESTING:
1. Run `pnpm run lint:a11y`
2. Verify catches missing ARIA labels
3. Add test component with violations
4. Verify ESLint flags issues
5. Run dev server, check console for axe violations
6. Fix all violations
7. Re-run lint, verify clean

DELIVERABLES:
1. Updated package.json with dependencies
2. Configured .eslintrc.cjs
3. Axe integration in main.tsx
4. CI workflow file
5. All existing violations fixed
6. Updated documentation
```

---

## Issue #23: Inconsistent Logging - Audit console.\* Usage

### Prompt for Agent

````
TASK: Audit codebase for direct console.* calls and replace with logger

CONTEXT:
Project has centralized logger with log level filtering, but some code may still use console.log directly, bypassing log level control.

FINDINGS:
- `src/lib/logger.ts` provides centralized logging
- Logger respects log levels (debug disabled in production)
- Grep search found 0 direct console.log usages in src/ (good sign!)
- But should verify console.warn, console.error, console.info

PROBLEM:
Direct console calls:
- Bypass log level filtering
- No telemetry tracking
- Can't disable in production
- Inconsistent formatting

IMPACT:
- Low - appears mostly compliant already
- Risk of future additions

RECOMMENDATION:
Audit for ALL console methods and add ESLint rule to prevent future additions.

FILES TO REVIEW:
- All files in `src/` directory
- `.eslintrc.cjs`

IMPLEMENTATION:

**Step 1: Comprehensive Grep Audit**

```bash
# Search for all console usage
grep -r "console\." src/ --include="*.ts" --include="*.tsx"

# Should find only logger.ts itself (expected)
# Any other matches need review
````

**Step 2: Add ESLint Rule**

In `.eslintrc.cjs`:

```javascript
module.exports = {
  rules: {
    // ... existing rules

    // Prevent direct console usage (except in logger.ts)
    "no-console": [
      "error",
      {
        allow: ["warn", "error"], // Allow for logger.ts internal use
      },
    ],
  },

  overrides: [
    {
      // Allow console in logger.ts itself
      files: ["src/lib/logger.ts"],
      rules: {
        "no-console": "off",
      },
    },
  ],
};
```

**Step 3: Replace Any Found Console Calls**

If audit finds direct usage:

```typescript
// Before:
console.log("User logged in:", user.email);
console.warn("API quota low");
console.error("Failed to save:", error);

// After:
logger.info("User logged in:", user.email);
logger.warn("API quota low");
logger.error("Failed to save:", error);
```

**Step 4: Add Pre-commit Hook (Optional)**

Install husky:

```bash
pnpm add -D husky
npx husky install
npx husky add .husky/pre-commit "pnpm run lint"
```

**Step 5: Document Logging Standards**

Add to README or CONTRIBUTING.md:

````markdown
## Logging Standards

**Use centralized logger**

```typescript
import { logger } from "@/lib/logger";

logger.debug("Development details"); // Dev only
logger.info("Normal information"); // Production
logger.warn("Concerning situation"); // Production
logger.error("Error occurred", error); // Production + telemetry
```
````

**Never use console directly**

```typescript
// ❌ DON'T
console.log("Something happened");

// ✅ DO
logger.info("Something happened");
```

**Log Levels**

- `debug`: Detailed troubleshooting info (dev only)
- `info`: General informational messages
- `warn`: Concerning but non-critical issues
- `error`: Errors that need attention

**Production Behavior**

- `debug` logs disabled automatically
- `error` logs tracked in telemetry
- All logs properly formatted with timestamps

```

ACCEPTANCE CRITERIA:
- [ ] Grep audit completed
- [ ] No direct console.* calls except in logger.ts
- [ ] ESLint rule added
- [ ] Lint passes with no violations
- [ ] Pre-commit hook optional but recommended
- [ ] Documentation added

TESTING:
1. Run grep audit, verify clean
2. Add test console.log to component
3. Run lint, verify error caught
4. Fix by using logger
5. Verify lint passes

DELIVERABLES:
1. Audit results (grep output)
2. Updated .eslintrc.cjs
3. Any console.* calls replaced
4. Documentation in README
5. Optional: pre-commit hook
```

---

## Issue #25: Missing Health Check Endpoint

### Prompt for Agent

````
TASK: Add /health endpoint for hosting platform monitoring

CONTEXT:
Many hosting platforms (Render, Railway, Kubernetes) expect a health check endpoint to verify app is running. SpellStars currently has no such endpoint, making automated monitoring difficult.

FINDINGS:
- No /health or /api/health route exists
- React Router handles all routes client-side
- No server-side health endpoint
- Static site (no backend server)

PROBLEM:
For static PWA:
- Health checks typically need server endpoint
- Client-side routes not suitable for monitoring
- index.html always returns 200 even if app broken

IMPACT:
- MONITORING: Can't verify app health programmatically
- DEPLOYMENT: No automated health checks in CI/CD
- UPTIME: Hosting platforms can't detect failures

RECOMMENDATION:

Since this is a static PWA with no backend, add a simple static health.json file that hosting platforms can ping. For more advanced needs, would require serverless function.

FILES TO REVIEW:
- `public/` directory
- `vite.config.ts`
- Hosting configuration (Vercel, Netlify, etc.)

IMPLEMENTATION:

**Step 1: Create Static Health File**

Create `public/health.json`:

```json
{
  "status": "ok",
  "app": "spellstars",
  "version": "0.1.0",
  "timestamp": "generated-at-build-time"
}
````

**Step 2: Add Build Script to Update Timestamp**

Create `scripts/generate-health.js`:

```javascript
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const health = {
  status: "ok",
  app: "spellstars",
  version: process.env.npm_package_version || "0.1.0",
  timestamp: new Date().toISOString(),
  build: process.env.GITHUB_SHA || "local",
};

const publicDir = path.join(__dirname, "..", "public");
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(
  path.join(publicDir, "health.json"),
  JSON.stringify(health, null, 2)
);

console.log("✅ Generated health.json");
```

**Step 3: Update Build Script**

In `package.json`:

```json
{
  "scripts": {
    "prebuild": "node scripts/generate-health.js",
    "build": "doppler run -- tsc && vite build",
    "health": "curl -f http://localhost:5173/health.json || exit 1"
  }
}
```

**Step 4: Add Client-Side Health Route (Optional)**

For more detailed checks:

```typescript
// src/app/pages/HealthCheck.tsx
export function HealthCheck() {
  const [health, setHealth] = useState({
    database: 'checking',
    auth: 'checking',
    storage: 'checking',
  });

  useEffect(() => {
    async function check() {
      // Test Supabase connection
      const { error: dbError } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);

      // Test auth
      const { error: authError } = await supabase.auth.getSession();

      setHealth({
        database: dbError ? 'error' : 'ok',
        auth: authError ? 'error' : 'ok',
        storage: 'ok', // Would need actual check
      });
    }
    check();
  }, []);

  return (
    <div className="p-4">
      <h1>Health Check</h1>
      <ul>
        <li>Database: {health.database}</li>
        <li>Auth: {health.auth}</li>
        <li>Storage: {health.storage}</li>
      </ul>
    </div>
  );
}

// Add to router.tsx
{
  path: "/health",
  element: <HealthCheck />,
}
```

**Step 5: Update Hosting Configuration**

For Vercel (vercel.json):

```json
{
  "headers": [
    {
      "source": "/health.json",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-cache, no-store, must-revalidate"
        }
      ]
    }
  ]
}
```

For Netlify (netlify.toml):

```toml
[[headers]]
  for = "/health.json"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate"
```

**Step 6: Configure Monitoring**

UptimeRobot, Pingdom, or hosting platform:

```
URL: https://your-domain.com/health.json
Interval: 5 minutes
Expected: HTTP 200, body contains "status":"ok"
```

**Step 7: Add Documentation**

In DEPLOYMENT.md:

````markdown
## Health Checks

SpellStars provides a `/health.json` endpoint for monitoring:

```bash
curl https://your-domain.com/health.json
```
````

Returns:

```json
{
  "status": "ok",
  "app": "spellstars",
  "version": "0.1.0",
  "timestamp": "2025-11-15T12:00:00.000Z"
}
```

### Monitoring Setup

**UptimeRobot**

1. Add new monitor (HTTP)
2. URL: <https://your-domain.com/health.json>
3. Check interval: 5 minutes
4. Alert keyword: "ok"

**Vercel/Netlify**
Health check URL automatically monitored by platform.

### Advanced Health Checks

For detailed checks (database, auth, storage), visit:
<https://your-domain.com/health>

Requires authentication - only accessible to admins.

```

ACCEPTANCE CRITERIA:
- [ ] health.json file created in public/
- [ ] Build script updates timestamp
- [ ] File accessible at /health.json
- [ ] Returns 200 status code
- [ ] Hosting configured (cache headers)
- [ ] Documentation added
- [ ] Optional: /health route with detailed checks

TESTING:
1. Run build: `pnpm run build`
2. Verify public/health.json exists
3. Run preview: `pnpm run preview`
4. Curl health.json: `curl http://localhost:4173/health.json`
5. Verify JSON structure
6. Deploy and test production URL
7. Setup monitoring service

DELIVERABLES:
1. public/health.json (static)
2. scripts/generate-health.js
3. Updated package.json
4. Hosting configuration
5. Documentation in DEPLOYMENT.md
6. Optional: /health route with detailed checks
```

---

I've created comprehensive agent prompts for all the major issues. Would you like me to create similar detailed prompts for the remaining moderate and minor issues, or would you like me to compile these into a master index file that makes it easy to find and assign each issue to an agent?
