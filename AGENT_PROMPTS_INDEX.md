# SpellStars Codebase Issues - Agent Assignment Index

**Review Date:** November 15, 2025
**Reviewer:** GitHub Copilot (Claude Sonnet 4.5)
**Total Issues:** 25 (4 Critical, 6 Major, 8 Moderate, 7 Minor)

---

## 🔴 CRITICAL ISSUES (Must Fix Immediately)

### Issue #1: Missing Test Coverage ⚠️ HIGH PRIORITY

- **Impact:** No automated validation of critical features (SRS algorithm, PIN security, offline sync)
- **Effort:** 8-10 days
- **Risk:** High - Bugs can deploy undetected
- **Prompt:** `AGENT_PROMPTS_CRITICAL.md` - Section "Issue #1"
- **Files:** `package.json`, `src/lib/srs.ts`, `src/lib/crypto.ts`, `src/lib/utils.ts`, `src/lib/sync.ts`
- **Skills Needed:** Testing (Vitest), TypeScript, Unit/Integration Testing
- **Blockers:** None - can start immediately
- **Priority:** 🔥 URGENT - Start first

---

### Issue #2: Database Schema Documentation Inconsistency

- **Impact:** New developers use wrong schema during setup
- **Effort:** 2-3 hours
- **Risk:** Medium - Can cause deployment issues
- **Prompt:** `AGENT_PROMPTS_CRITICAL.md` - Section "Issue #2"
- **Files:** `README.md`, `docs/database-schema.md`, `supabase/migrations/*.sql`
- **Skills Needed:** Documentation, SQL, Markdown
- **Blockers:** None
- **Priority:** High - Quick win, do early

---

### Issue #3: Missing Error Boundary Root Wrapping ⚠️

- **Impact:** Unhandled errors crash entire app with blank screen
- **Effort:** 30 minutes
- **Risk:** High - Poor UX, data loss
- **Prompt:** `AGENT_PROMPTS_CRITICAL.md` - Section "Issue #3"
- **Files:** `src/app/main.tsx`, `src/app/App.tsx`, `src/app/components/ErrorBoundary.tsx`
- **Skills Needed:** React, Error Boundaries
- **Blockers:** None
- **Priority:** 🔥 URGENT - Quick fix with high impact

---

### Issue #4: Service Worker Registration Conflict

- **Impact:** PWA functionality (offline mode, updates) may fail
- **Effort:** 2-3 hours
- **Risk:** High - Core PWA features at risk
- **Prompt:** `AGENT_PROMPTS_CRITICAL.md` - Section "Issue #4"
- **Files:** `src/app/main.tsx`, `vite.config.ts`, `src/vite-env.d.ts`, `src/app/components/UpdateBanner.tsx`
- **Skills Needed:** Service Workers, PWA, vite-plugin-pwa
- **Blockers:** None
- **Priority:** High - Critical for offline functionality

---

## 🟡 MAJOR ISSUES (Should Fix Soon)

### Issue #5: Incomplete Sync Status Implementation

- **Impact:** Inaccurate pending item counts in UI
- **Effort:** 4-6 hours
- **Risk:** Medium - Users close app thinking sync is complete
- **Prompt:** `AGENT_PROMPTS_MAJOR.md` - Section "Issue #5"
- **Files:** `src/lib/sync.ts`, `src/app/hooks/useSyncStatus.ts`, `src/data/db.ts`
- **Skills Needed:** IndexedDB (Dexie), React Hooks, TypeScript
- **Blockers:** None
- **Priority:** Medium-High

---

### Issue #6: Missing Index on attempts.list_id

- **Impact:** Slow analytics queries as data grows
- **Effort:** 1 hour
- **Risk:** Medium - Performance degradation at scale
- **Prompt:** `AGENT_PROMPTS_MAJOR.md` - Section "Issue #6"
- **Files:** `supabase/migrations/` (new migration), `docs/database-schema.md`
- **Skills Needed:** PostgreSQL, Database Indexing, SQL
- **Blockers:** Need Supabase access to test
- **Priority:** Medium - Performance optimization

---

### Issue #7: Potential Memory Leak in Session Store

- **Impact:** Unbounded memory growth in long sessions
- **Effort:** 4-5 hours
- **Risk:** Low-Medium - Affects extended use
- **Prompt:** `AGENT_PROMPTS_MAJOR_CONT.md` - Section "Issue #7"
- **Files:** `src/app/store/session.ts`, game page components
- **Skills Needed:** Zustand, Data Structures (LRU), Memory Management
- **Blockers:** None
- **Priority:** Medium

---

### Issue #8: Inadequate PIN Brute Force Protection

- **Impact:** Parental controls vulnerable to patient brute force
- **Effort:** 6-8 hours
- **Risk:** High - Security vulnerability
- **Prompt:** `AGENT_PROMPTS_MAJOR_CONT.md` - Section "Issue #8"
- **Files:** `src/app/store/parentalSettings.ts`, `src/lib/crypto.ts`, `src/app/components/PinLock.tsx`
- **Skills Needed:** Security, State Management, Progressive Lockout Algorithms
- **Blockers:** Need to understand current PIN flow
- **Priority:** High - Security issue

---

### Issue #9: Missing Foreign Key Index on list_words.word_id

- **Impact:** Slow word deletion operations
- **Effort:** 30 minutes
- **Risk:** Low - Only affects word deletion
- **Prompt:** Similar to Issue #6, apply to `list_words.word_id`
- **Files:** `supabase/migrations/` (new migration)
- **Skills Needed:** PostgreSQL, Database Indexing
- **Blockers:** Need Supabase access
- **Priority:** Low-Medium

---

### Issue #10: Inconsistent Query Key Patterns

- **Impact:** Potential cache invalidation bugs
- **Effort:** 2-3 hours
- **Risk:** Medium - Hard to debug when it fails
- **Prompt:** Audit `src/app/api/supa.ts` for all query keys, standardize with factory pattern
- **Files:** `src/app/api/supa.ts` (2046 lines - large refactor)
- **Skills Needed:** React Query, Refactoring
- **Blockers:** Need comprehensive testing after changes
- **Priority:** Medium

---

## 🟠 MODERATE ISSUES (Nice to Have)

### Issue #11: Missing CSV Import Validation

- **Impact:** Users can import malformed data
- **Effort:** 3-4 hours
- **Risk:** Medium - Data integrity
- **Prompt:** `AGENT_PROMPTS_MODERATE.md` - Section "Issue #11"
- **Files:** `src/lib/csvParser.ts`, `src/app/pages/parent/ListEditor.tsx`
- **Skills Needed:** Zod validation, CSV parsing
- **Blockers:** None
- **Priority:** Medium

---

### Issue #12: Hardcoded Cache Expiration Times

- **Impact:** Difficult to tune cache strategy
- **Effort:** 1 hour
- **Risk:** Low
- **Prompt:** Move cache durations from `vite.config.ts` to environment variables
- **Files:** `vite.config.ts`, `.env.example`
- **Skills Needed:** Configuration management
- **Priority:** Low

---

### Issue #13: Missing Telemetry Export UI

- **Impact:** Cannot debug user-reported issues
- **Effort:** 2-3 hours
- **Risk:** Low - Affects debugging only
- **Prompt:** `AGENT_PROMPTS_MODERATE.md` - Section "Issue #13"
- **Files:** `src/lib/logger.ts`, `src/app/main.tsx`, `src/app/pages/parent/Settings.tsx`
- **Skills Needed:** TypeScript, React UI
- **Blockers:** None
- **Priority:** Low-Medium

---

### Issue #14: Missing Retry Logic for Audio Upload

- **Impact:** Network blips lose recordings
- **Effort:** 1 hour
- **Risk:** Medium - Data loss
- **Prompt:** Add retry configuration to `useUploadAudio` mutation in `supa.ts`
- **Files:** `src/app/api/supa.ts`
- **Skills Needed:** React Query
- **Priority:** Medium

---

### Issue #15: Incomplete Type Safety

- **Impact:** TypeScript won't catch schema mismatches
- **Effort:** 4-6 hours (audit)
- **Risk:** Medium
- **Prompt:** Audit `src/app/api/supa.ts` for loose types, strengthen
- **Files:** `src/app/api/supa.ts`, `src/types/database.types.ts`
- **Skills Needed:** TypeScript, Type Safety
- **Priority:** Low-Medium

---

### Issue #16: No Production CORS Documentation

- **Impact:** Deployment may need manual CORS config
- **Effort:** 30 minutes
- **Risk:** Low - Documentation only
- **Prompt:** Document CORS requirements in `DEPLOYMENT.md`
- **Files:** `docs/DEPLOYMENT.md`, `vite.config.ts`
- **Priority:** Low

---

### Issue #17: Missing Loading States for Due Words

- **Impact:** UI shows stale "0 words" while loading
- **Effort:** 30 minutes
- **Risk:** Low - Minor UX issue
- **Prompt:** Audit components using `useDueWords`, ensure `isLoading` checked
- **Files:** Components using `useDueWords` hook
- **Priority:** Low

---

### Issue #18: Potential Race Condition in Sync

- **Impact:** Concurrent sync operations possible
- **Effort:** 2-3 hours
- **Risk:** Medium
- **Prompt:** Add mutex/lock pattern to `syncQueuedData()` in `sync.ts`
- **Files:** `src/lib/sync.ts`, `src/app/main.tsx`
- **Skills Needed:** Concurrency, Locks
- **Priority:** Medium

---

## 🟢 MINOR ISSUES (Low Priority)

### Issue #19: TODO Comment in Production Code

- **Impact:** Code hygiene only
- **Effort:** 15 minutes
- **Risk:** None
- **Prompt:** `AGENT_PROMPTS_MINOR.md` - Section "Issue #19"
- **Files:** `src/lib/wordsearch.ts`
- **Priority:** Low - Quick win

---

### Issue #20: Missing Accessibility Testing Automation

- **Impact:** A11y regressions could slip through
- **Effort:** 2-3 hours
- **Risk:** Low
- **Prompt:** `AGENT_PROMPTS_MINOR.md` - Section "Issue #20"
- **Files:** `package.json`, `.eslintrc.cjs`, `src/app/main.tsx`
- **Skills Needed:** ESLint, Accessibility
- **Priority:** Medium (important for compliance)

---

### Issue #21: Missing Doppler Integration Docs for Migrations

- **Impact:** Developers must maintain separate .env
- **Effort:** 15 minutes
- **Risk:** None
- **Prompt:** Document: `doppler run -- pwsh ./push-migration.ps1` in `README.md`
- **Files:** `README.md`, migration scripts
- **Priority:** Low

---

### Issue #22: No Bundle Size Monitoring

- **Impact:** Bundle could bloat unnoticed
- **Effort:** 1-2 hours
- **Risk:** Low
- **Prompt:** Add bundlesize or similar to CI/CD
- **Files:** `package.json`, `.github/workflows/`
- **Priority:** Low

---

### Issue #23: Inconsistent Logging Patterns

- **Impact:** Some logs bypass level filtering
- **Effort:** 1 hour
- **Risk:** Low
- **Prompt:** `AGENT_PROMPTS_MINOR.md` - Section "Issue #23"
- **Files:** All `src/` files, `.eslintrc.cjs`
- **Priority:** Low

---

### Issue #24: No Storybook

- **Impact:** Component testing harder
- **Effort:** 8-12 hours (full setup)
- **Risk:** None
- **Prompt:** Add Storybook for component library
- **Files:** New storybook config, story files
- **Skills Needed:** Storybook
- **Priority:** Low (nice to have)

---

### Issue #25: Missing Health Check Endpoint

- **Impact:** No automated health monitoring
- **Effort:** 2 hours
- **Risk:** Low
- **Prompt:** `AGENT_PROMPTS_MINOR.md` - Section "Issue #25"
- **Files:** `public/health.json`, `scripts/generate-health.js`
- **Priority:** Low

---

## 📊 Quick Stats

| Severity  | Count  | Total Effort | Avg Risk    |
| --------- | ------ | ------------ | ----------- |
| Critical  | 4      | ~12 days     | High        |
| Major     | 6      | ~4 days      | Medium-High |
| Moderate  | 8      | ~3 days      | Medium      |
| Minor     | 7      | ~2 days      | Low         |
| **TOTAL** | **25** | **~21 days** | **Mixed**   |

---

## 🎯 Recommended Action Plan

### Week 1: Critical Fixes (Foundation)

**Priority: Stability & Security**

1. **Day 1 Morning:** Issue #3 - Error Boundary (30 min) ✅
2. **Day 1 Afternoon:** Issue #2 - Schema Docs (2-3 hours) ✅
3. **Day 2:** Issue #4 - Service Worker Fix (2-3 hours) ✅
4. **Day 3-5:** Issue #1 - Test Infrastructure Setup (Focus on critical libs: srs, crypto, utils) ⚠️

**Outcome:** App won't crash on errors, PWA works, critical code tested

---

### Week 2: Security & Performance

**Priority: Protection & Scale**

1. **Day 1:** Issue #6 - Database Index (1 hour) ✅
2. **Day 2-3:** Issue #8 - PIN Protection (6-8 hours) ⚠️
3. **Day 4:** Issue #5 - Sync Status Fix (4-6 hours)
4. **Day 5:** Issue #7 - Session Memory Bounds (4-5 hours)

**Outcome:** Secure parental controls, faster queries, accurate sync status

---

### Week 3: Data Integrity & Testing

**Priority: Quality & Reliability**

1. **Day 1-3:** Issue #1 Continued - Integration tests for sync logic
2. **Day 4:** Issue #11 - CSV Validation (3-4 hours)
3. **Day 5:** Issue #14 - Audio Upload Retry (1 hour)

**Outcome:** Comprehensive test coverage, validated data imports

---

### Ongoing: Quick Wins & Maintenance

**Priority: Incremental Improvements**

- Issue #19 - Remove TODO (15 min)
- Issue #20 - A11y Testing (2-3 hours)
- Issue #23 - Logging Audit (1 hour)
- Issue #13 - Telemetry Export (2-3 hours)
- Issue #25 - Health Check (2 hours)

**Outcome:** Better DX, monitoring, accessibility

---

## 🚀 How to Use This Index

### For Project Managers

1. Assign issues based on developer skills and availability
2. Critical issues should be assigned to senior developers
3. Minor issues good for junior developers or first tasks
4. Estimate: 3-4 weeks of dedicated work for all issues

### For Developers

1. Read the appropriate `AGENT_PROMPTS_*.md` file for your assigned issue
2. Each prompt contains:
   - Full context and findings
   - Problem description and impact
   - Step-by-step implementation guide
   - Acceptance criteria
   - Testing checklist
   - Deliverables list
3. Follow the prompt as a detailed specification
4. Add your own insights and improvements as needed

### For AI Agents

Copy the entire section from the appropriate prompt file and follow instructions precisely. All necessary context is included.

---

## 📝 Notes

- **Effort estimates** are for one developer working full-time
- **Risk levels** reflect impact if issue not addressed
- **Blockers** indicate dependencies or prerequisites
- **Skills needed** help match issues to developer expertise
- All prompts include file paths, line numbers, and code examples
- Prompts assume familiarity with the tech stack (React, TypeScript, Supabase)

---

## ✅ Strengths (Don't Break These!)

The review also identified excellent practices to preserve:

1. **Security:** PBKDF2 PIN hashing, RLS policies, constant-time comparison
2. **Offline-First:** Comprehensive IndexedDB queue with retry logic
3. **Accessibility:** Extensive ARIA labels, keyboard navigation
4. **Type Safety:** Strict TypeScript, generated database types
5. **Documentation:** Excellent inline comments, comprehensive README
6. **Error Handling:** Centralized logger with telemetry
7. **Code Organization:** Clean separation of concerns
8. **State Management:** Appropriate Zustand + React Query usage
9. **PWA Implementation:** Proper service worker caching (once #4 fixed)
10. **Migration System:** Idempotent migrations with health checks

---

## 📞 Support

For questions about any issue or prompt:

1. Review the full prompt in the appropriate `AGENT_PROMPTS_*.md` file
2. Check related documentation in `docs/` folder
3. Reference `BUG_FIXES_HISTORY.md` for context on past fixes
4. Check `.github/copilot-instructions.md` for architectural patterns

---

**Last Updated:** November 15, 2025
**Next Review:** After critical issues resolved (2-3 weeks)
