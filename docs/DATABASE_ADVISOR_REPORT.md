# Database Advisor Report - SpellStars

**Date:** November 9, 2025
**Project:** spelling-stars
**Database:** PostgreSQL 17.6 on Supabase

## Executive Summary

The Supabase database advisor check identified **2 critical performance issues** that have been successfully resolved. The database now passes all health checks with no critical issues or warnings.

## Issues Found and Fixed

### Critical Issues (Fixed ✓)

#### 1. Missing Index: `idx_attempts_child_word`

**Severity:** Critical
**Status:** ✓ Fixed
**Impact:** High - affects attempt history queries

**Problem:**
The `attempts` table was missing a composite index on `(child_id, word_id)`, causing slow queries when fetching attempt history for specific child/word combinations.

**Used By:**

- `useCreateAttempt()` mutation hook
- Attempt history queries in analytics
- Progress tracking features

**Fix Applied:**

```sql
CREATE INDEX idx_attempts_child_word ON attempts(child_id, word_id);
```

**Performance Impact:**

- Queries filtering by child_id + word_id will use index scan instead of sequential scan
- Expected 10-100x improvement for attempt history lookups as data grows
- Critical for scalability as attempt records accumulate

---

#### 2. Missing Index: `idx_list_words_list_id`

**Severity:** Critical
**Status:** ✓ Fixed
**Impact:** High - affects primary user interface

**Problem:**
The `list_words` junction table was missing an index on `list_id`, causing slow queries when fetching all words in a spelling list.

**Used By:**

- `useWordList()` query hook (one of the most frequently called queries)
- Word list display in parent dashboard
- Word reordering operations
- Game initialization (loading words for practice)

**Fix Applied:**

```sql
CREATE INDEX idx_list_words_list_id ON list_words(list_id);
```

**Performance Impact:**

- Queries fetching words for a list will use index scan instead of sequential scan
- Expected 50-200x improvement as lists grow beyond 20 words
- Particularly important for drag-and-drop reordering feature
- Critical for offline-first gameplay (faster cache lookups)

---

## Database Health Summary

### ✓ All Checks Passed

#### Security

- ✓ All 11 tables have Row Level Security (RLS) enabled
- ✓ Total 42 RLS policies properly configured
- ✓ Both storage buckets (`audio-recordings`, `word-audio`) are **private** as required
- ✓ Security definer functions properly secured
- ✓ Profile role constraints enforce parent/child separation

#### Performance

- ✓ All 4 critical indexes now exist:
  - `idx_srs_due_date` - SRS due date queries
  - `idx_attempts_child_word` - Attempt history queries (ADDED)
  - `idx_list_words_list_id` - Word list queries (ADDED)
  - `idx_session_analytics_child_date` - Analytics queries
- ✓ All 13 foreign keys have supporting indexes
- ✓ No duplicate indexes found
- ✓ No unused indexes (previous false positive was due to new database)

#### Data Integrity

- ✓ All tables have primary keys
- ✓ 41 check constraints enforce data validity
- ✓ Proper column defaults on all timestamp and UUID columns
- ✓ Foreign key constraints maintain referential integrity

#### Functions & Triggers

- ✓ 2 critical functions exist: `handle_new_user`, `fn_add_stars`
- ✓ 5 update timestamp triggers properly configured
- ✓ Auth trigger on `auth.users` creates profiles automatically

---

## Migration Applied

**File:** `supabase/migrations/20251109180000_add_performance_indexes.sql`

```sql
-- Add Performance Indexes
CREATE INDEX IF NOT EXISTS idx_attempts_child_word
ON attempts(child_id, word_id);

CREATE INDEX IF NOT EXISTS idx_list_words_list_id
ON list_words(list_id);
```

**Applied:** November 9, 2025
**Status:** ✓ Success
**Rollback Safe:** Yes (can drop indexes without data loss)

---

## Advisor Tools Created

Three new PowerShell scripts were created for ongoing database monitoring:

### 1. `check-db-advisor.ps1`

Comprehensive application-specific database health check focusing on:

- Critical index verification
- RLS policy coverage
- Foreign key index coverage
- Storage bucket security
- Function and trigger existence
- Constraint validation

**Usage:**

```powershell
doppler run -- pwsh .\check-db-advisor.ps1
```

### 2. `check-db-health.ps1`

General database health metrics:

- Tables without primary keys
- Unused indexes
- Missing foreign key indexes
- RLS configuration
- Duplicate indexes
- Table sizes
- Security definer functions

**Usage:**

```powershell
doppler run -- pwsh .\check-db-health.ps1
```

### 3. `list-projects.ps1`

Lists all Supabase projects in the organization.

**Usage:**

```powershell
doppler run -- pwsh .\list-projects.ps1
```

---

## Recommendations for Future

### Monitoring

1. **Run advisor weekly** during active development
2. **Monitor query performance** using Supabase dashboard
3. **Check index usage** as data grows (pg_stat_user_indexes)

### Performance

1. Consider adding index on `srs.due_date` + `child_id` composite if SRS queries slow down
2. Monitor `attempts` table growth - may need partitioning after 1M+ records
3. Add database connection pooling if concurrent users exceed 50

### Security

1. Regularly audit RLS policies for new tables
2. Review security definer functions quarterly
3. Monitor storage bucket access patterns

### Data Management

1. Plan archival strategy for old attempts (> 1 year)
2. Consider read replicas for analytics if parent dashboards slow down
3. Implement soft deletes for word lists if users need undo functionality

---

## Testing Performed

✓ All indexes created successfully
✓ No duplicate indexes introduced
✓ RLS policies still functioning correctly
✓ Query performance validated (index scans confirmed in execution plans)
✓ No breaking changes to application code

---

## Conclusion

The database is now fully optimized with no critical issues or warnings. The two missing indexes have been added, which will prevent performance degradation as the application scales. All security measures (RLS, private buckets, constraints) are properly configured.

**Next Steps:**

1. Monitor query performance in production
2. Run advisor monthly or after major schema changes
3. Review index usage statistics after 30 days of production use

---

**Report Generated By:** Database Advisor Tooling
**Project:** spelling-stars (mxgamemjvrcajwhbefvz)
**Region:** us-east-2
**PostgreSQL Version:** 17.6.1.038
