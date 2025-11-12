# Database Advisor Report - SpellStars

**Date:** November 11, 2025
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

### Performance Optimization (November 11, 2025)

#### Unused Index Removal

##### 1. Dropped `idx_srs_due_date`

**Status:** ✓ Optimized
**Issue:** Index on just `due_date` column was unused (0 scans)

**Root Cause:**
All queries filter by `child_id` first, making the composite index `idx_srs_child_due` the preferred choice for the query planner.

**Queries Analyzed:**

- `getDueWords()` in supa.ts - Uses `idx_srs_child_due` (child_id, due_date)
- `get_next_batch()` function - Uses `idx_srs_child_due` (child_id, due_date)

**Action Taken:**
Dropped `idx_srs_due_date` in migration `20251111000000_drop_unused_srs_indexes.sql`

**Impact:**
Reduced storage overhead and improved write performance on srs table

---

##### 2. Dropped `idx_srs_child_word`

**Status:** ✓ Optimized
**Issue:** Index on (child_id, word_id) was redundant with unique constraint

**Root Cause:**
The UNIQUE constraint on (child_id, word_id) automatically creates a backing index `srs_child_id_word_id_key`. The manually created `idx_srs_child_word` was a duplicate.

**Queries Analyzed:**

- `getSrsEntry()` in supa.ts - Uses unique constraint index
- `upsertSrsEntry()` in supa.ts - Requires unique constraint
- Sync operations in sync.ts - Use unique constraint index

**Action Taken:**
Dropped `idx_srs_child_word` in migration `20251111000000_drop_unused_srs_indexes.sql`

**Data Integrity:**
UNIQUE constraint remains intact, ensuring no duplicate (child_id, word_id) pairs

**Impact:**
Eliminated duplicate index maintenance overhead

---

##### 3. Kept `srs_child_id_word_id_key` (Unique Constraint Index)

**Status:** ✓ Retained (Required)
**Issue:** Shows 0 scans in early health checks but is essential

**Why This Index is Required:**

The `srs_child_id_word_id_key` index is automatically created by PostgreSQL to enforce the `UNIQUE(child_id, word_id)` constraint on the `srs` table. This constraint is critical for data integrity and is actively used by the application.

**Used By:**

- `getSrsEntry()` in supa.ts - Looks up existing SRS record by (child_id, word_id)
- `upsertSrsEntry()` in supa.ts - Requires unique constraint for ON CONFLICT clause
- All SRS update operations - Ensures no duplicate spaced repetition entries

**Query Patterns:**

```sql
-- Used in getSrsEntry()
SELECT * FROM srs WHERE child_id = ? AND word_id = ?;

-- Used in upsertSrsEntry()
INSERT INTO srs (child_id, word_id, ease, interval_days, ...)
VALUES (?, ?, ?, ?, ...)
ON CONFLICT (child_id, word_id) DO UPDATE SET ...;
```

**Why 0 Scans is Expected:**

Early health check readings may show 0 scans for this index due to:

1. **Low Load:** Development/testing environments have minimal SRS lookups
2. **Statistics Lag:** PostgreSQL's `pg_stat_user_indexes` view doesn't update instantly
3. **Constraint Enforcement:** The index is used for UNIQUE constraint checks on INSERT/UPDATE, which may not be tracked the same way as SELECT queries in scan statistics

**Expected Behavior:**

As the application is used in production, this index will show increased scan counts from:

- Children playing spelling games (SRS lookups on each word attempt)
- Automatic SRS updates after practice sessions
- Due word queries that filter by child_id + word_id combinations

**Cannot Be Dropped:**

Attempting to drop this index would fail because:

```sql
DROP INDEX srs_child_id_word_id_key;
-- ERROR: cannot drop index srs_child_id_word_id_key because constraint
-- srs_child_id_word_id_key on table srs requires it
```

The only way to remove it would be to drop the UNIQUE constraint itself, which would break application logic that depends on preventing duplicate (child_id, word_id) entries.

**Impact:**
Essential for data integrity. Initial 0-scan readings are not a performance concern and will change with usage.

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

- ✓ All 3 critical indexes now exist:
  - `idx_srs_child_due` - SRS due date queries (composite: child_id, due_date)
  - `idx_attempts_child_word` - Attempt history queries
  - `idx_list_words_list_id` - Word list queries
  - `idx_session_analytics_child_date` - Analytics queries
- ✓ All 13 foreign keys have supporting indexes
- ✓ No duplicate indexes found
- ✓ Unused indexes identified and removed in November 2025 optimization

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
4. **Verify index usage** with `pg_stat_user_indexes` view quarterly
5. **Check for duplicate indexes** when adding new unique constraints

### Performance (Recommendations)

1. The existing `idx_srs_child_due` composite index on (child_id, due_date) is optimal for all SRS due date queries. No additional indexes needed.
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

The database is now fully optimized with no critical issues or warnings. The two missing indexes have been added, which will prevent performance degradation as the application scales. In November 2025, additional optimization removed 2 unused/redundant indexes on the srs table, further improving write performance. All security measures (RLS, private buckets, constraints) are properly configured and no unused indexes remain.

**Next Steps:**

1. Monitor query performance in production
2. Run advisor monthly or after major schema changes
3. Review index usage statistics after 30 days of production use

---

**Report Generated By:** Database Advisor Tooling
**Project:** spelling-stars (mxgamemjvrcajwhbefvz)
**Region:** us-east-2
**PostgreSQL Version:** 17.6.1.038
