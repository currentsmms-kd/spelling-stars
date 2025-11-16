# Test Infrastructure - Installation & Verification Checklist

Use this checklist to verify the test infrastructure is working correctly after installing dependencies.

---

## ✅ Pre-Installation Checklist

- [x] Test configuration created (`vitest.config.ts`)
- [x] Test setup file created (`src/test/setup.ts`)
- [x] Test files created:
  - [x] `src/lib/srs.test.ts` (100+ tests)
  - [x] `src/lib/crypto.test.ts` (80+ tests)
  - [x] `src/lib/utils.test.ts` (120+ tests)
- [x] package.json updated with scripts and dependencies
- [x] README.md updated with testing documentation
- [x] BUG_FIXES_HISTORY.md updated

---

## ⏳ Installation Steps

### Step 1: Install Dependencies

Try these commands in order until successful:

```powershell
# Option 1: Standard install
pnpm install

# Option 2: If lockfile issues
pnpm install --no-frozen-lockfile

# Option 3: If persistent errors
pnpm store prune
pnpm install

# Option 4: Last resort
Remove-Item -Recurse -Force node_modules
Remove-Item pnpm-lock.yaml
pnpm install
```

**Expected output:** Installation should complete without errors and update pnpm-lock.yaml

**Common issues:**

- Network timeouts: Wait 5-10 minutes, retry
- ERR_INVALID_THIS: Network/proxy issue, check connection
- Broken lockfile: Use --no-frozen-lockfile flag

### Step 2: Verify Installation

```powershell
# Check Vitest is installed
pnpm list vitest

# Should show: vitest 3.2.4

# Check all test dependencies
pnpm list @vitest/ui happy-dom @testing-library/react
```

---

## 🧪 Verification Steps

### Step 3: Run Tests (Watch Mode)

```powershell
pnpm test
```

**Expected output:**

```
 ✓ src/lib/srs.test.ts (100+ tests)
 ✓ src/lib/crypto.test.ts (80+ tests)
 ✓ src/lib/utils.test.ts (120+ tests)

 Test Files  3 passed (3)
      Tests  300+ passed (300+)
```

**What to check:**

- [ ] All test files discovered
- [ ] All tests passing (green checkmarks)
- [ ] No red X's or failures
- [ ] Watch mode stays active (waiting for changes)

**If tests fail:**

1. Read error message carefully
2. Check if it's a missing dependency (install issue)
3. Check if it's a test logic issue (report to maintainer)
4. Try running specific file: `pnpm test src/lib/srs.test.ts`

### Step 4: Run Tests (Single Run)

```powershell
pnpm test:run
```

**Expected output:** Same as above but exits after completion

**What to check:**

- [ ] Exit code 0 (success)
- [ ] All tests passed
- [ ] No hanging processes

### Step 5: Generate Coverage Report

```powershell
pnpm test:coverage
```

**Expected output:**

```
 % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
---------|----------|---------|---------|-------------------
  95.00  |   92.00  |   95.00  |   95.00  |
```

**What to check:**

- [ ] Coverage report generated in `coverage/` directory
- [ ] srs.ts: 80%+ coverage (target: 95%)
- [ ] crypto.ts: 90%+ coverage (target: 92%)
- [ ] utils.ts: 80%+ coverage (target: 90%)
- [ ] HTML report exists: `coverage/index.html`

**View coverage:**

```powershell
# Open in browser
start coverage/index.html
```

**In the HTML report:**

- [ ] Green = well covered
- [ ] Yellow = partially covered
- [ ] Red = not covered
- [ ] Click files to see line-by-line coverage

### Step 6: Test Interactive UI (Optional)

```powershell
pnpm test:ui
```

**Expected output:**

```
  ➜  Local:   http://localhost:51204/__vitest__/
```

**What to check:**

- [ ] Browser opens automatically
- [ ] All test files visible in sidebar
- [ ] Can click test to see details
- [ ] Can filter/search tests
- [ ] Can see code coverage inline

**Close UI:** Ctrl+C in terminal

### Step 7: Test Specific Scenarios

```powershell
# Run specific file
pnpm test src/lib/srs.test.ts

# Run tests matching pattern
pnpm test -t "should increase ease"

# Verbose output
pnpm test --reporter=verbose
```

**What to check:**

- [ ] Can run individual files
- [ ] Pattern matching works
- [ ] Verbose output shows details

---

## 📊 Coverage Analysis

### Step 8: Analyze Coverage Report

Open `coverage/index.html` and verify:

#### srs.ts Coverage:

- [ ] `calculateSrsOnSuccess`: 100%
- [ ] `calculateSrsOnMiss`: 100%
- [ ] `createSrsInsertOnSuccess`: 100%
- [ ] `createSrsInsertOnMiss`: 100%
- [ ] `prepareSrsUpdate`: 100%
- [ ] `isDueToday`: 100%
- [ ] `isOverdue`: 100%
- [ ] `daysUntilDue`: 100%

**If < 80%:** Some edge cases not tested, review uncovered lines

#### crypto.ts Coverage:

- [ ] `hashPin`: 100%
- [ ] `verifyPin`: 100%
- [ ] `isValidPinFormat`: 100%
- [ ] `isValidStoredPinFormat`: 100%
- [ ] Helper functions: 90%+

**If < 90%:** Security-critical code, should be fully tested

#### utils.ts Coverage:

- [ ] `normalizeSpellingAnswer`: 90%+
- [ ] `getHintText`: 90%+
- [ ] `cn` utility: Can be lower (simple function)

**If < 80%:** Some normalization scenarios not tested

---

## 🐛 Troubleshooting

### Issue: "Cannot find module 'vitest'"

**Solution:**

```powershell
# Verify installation
pnpm list vitest

# If not installed
pnpm add -D vitest
```

### Issue: "Tests not running"

**Checklist:**

- [ ] Test files end in `.test.ts`
- [ ] Test files in correct location (`src/lib/`)
- [ ] vitest.config.ts exists
- [ ] Vitest is installed

### Issue: "Import errors in test files"

**Solution:**

```powershell
# Check TypeScript compilation
pnpm run build

# If errors, fix TypeScript issues first
```

### Issue: "Coverage report empty"

**Solution:**

```powershell
# Delete old coverage
Remove-Item -Recurse -Force coverage

# Regenerate
pnpm test:coverage
```

### Issue: "Tests are slow"

**Expected timings:**

- srs.test.ts: < 500ms
- crypto.test.ts: 2-3 seconds (PBKDF2 is slow by design)
- utils.test.ts: < 500ms

**If slower:**

- Check CPU usage (other apps)
- Check antivirus (may scan test files)
- Crypto tests are intentionally slow (100k iterations)

---

## ✅ Final Verification Checklist

### Installation Complete:

- [ ] `pnpm install` succeeded
- [ ] No error messages in terminal
- [ ] pnpm-lock.yaml updated
- [ ] node_modules/vitest exists

### Tests Working:

- [ ] `pnpm test` runs without errors
- [ ] All 300+ tests pass
- [ ] Watch mode works (Ctrl+C to exit)
- [ ] `pnpm test:run` passes
- [ ] Exit code is 0

### Coverage Working:

- [ ] `pnpm test:coverage` generates report
- [ ] coverage/index.html exists
- [ ] Can open HTML report in browser
- [ ] Coverage meets targets:
  - [ ] srs.ts: 80%+ (target 95%)
  - [ ] crypto.ts: 90%+ (target 92%)
  - [ ] utils.ts: 80%+ (target 90%)

### UI Working (Optional):

- [ ] `pnpm test:ui` starts server
- [ ] Browser opens to Vitest UI
- [ ] Can see all test files
- [ ] Can click tests to see details

---

## 🎯 Success Criteria

### Minimum Requirements (Must Pass):

1. ✅ All dependencies installed
2. ✅ All 300+ tests passing
3. ✅ Coverage > 80% on critical files
4. ✅ No TypeScript errors
5. ✅ Can run tests in watch mode

### Ideal State (Goal):

1. ✅ All tests passing
2. ✅ Coverage > 90% on critical files
3. ✅ Interactive UI working
4. ✅ HTML coverage report working
5. ✅ Can debug tests in VS Code
6. ✅ Tests run in < 5 seconds

---

## 📝 Notes

### Test Execution Time

**Normal timings:**

- srs.test.ts: ~200-500ms (100+ tests, pure functions)
- crypto.test.ts: ~2-3 seconds (80+ tests, PBKDF2 with 100k iterations)
- utils.test.ts: ~200-500ms (120+ tests, string operations)
- **Total**: ~3-4 seconds for all tests

**Why crypto tests are slow:**

PBKDF2 with 100,000 iterations is INTENTIONALLY slow for security. This is not a bug. Each PIN hash takes ~10-30ms, and we test many scenarios, so crypto tests take longer.

### Coverage Thresholds

**Configured in vitest.config.ts:**

```typescript
thresholds: {
  lines: 80,
  functions: 80,
  branches: 75,
  statements: 80,
}
```

Tests will FAIL if coverage drops below these thresholds.

### VS Code Integration

**To run tests in VS Code:**

1. Install "Vitest" extension (ZixuanChen.vitest-explorer)
2. Tests appear in sidebar Test Explorer
3. Click play button to run
4. Set breakpoints for debugging

### Watch Mode

**In watch mode, tests re-run when:**

- Any test file changes
- Any source file imported by tests changes
- vitest.config.ts changes

**To exit watch mode:** Press 'q' or Ctrl+C

---

## 🚀 Next Steps After Verification

1. **Commit test infrastructure:**

   ```powershell
   git add .
   git commit -m "feat: Add comprehensive test infrastructure

   - Configure Vitest with coverage thresholds
   - Add 100+ tests for SRS algorithm
   - Add 80+ tests for PIN security
   - Add 120+ tests for spelling normalization
   - Update documentation with testing guide

   Closes #1 - Missing Test Coverage"
   ```

2. **Set up CI/CD** (future):
   - Create `.github/workflows/test.yml`
   - Run tests on every PR
   - Block merge if tests fail

3. **Add more tests** (future):
   - Integration tests for sync logic
   - Component tests for game pages
   - E2E tests for user flows

4. **Move to next issue:**
   - Issue #3: Error Boundary Root Wrapping
   - Issue #4: Service Worker Registration Conflict

---

**End of Checklist**

If all items checked, test infrastructure is fully operational! 🎉
