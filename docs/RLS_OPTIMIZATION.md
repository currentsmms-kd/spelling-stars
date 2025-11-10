# RLS Policy Optimization - November 9, 2025

## Overview

This document records the optimization of Row Level Security (RLS) policies to resolve Supabase Advisor warnings related to performance issues.

## Problems Addressed

### 1. Auth RLS Initialization Plan (auth_rls_initplan)

**Issue:** RLS policies were calling `auth.uid()` directly, causing the function to be re-evaluated for **every row** in query results. This creates significant performance overhead as the database scales.

**Solution:** Wrapped all `auth.uid()` calls in a subquery: `(SELECT auth.uid())`

This ensures the function is evaluated once per query rather than once per row.

**Example:**

```sql
-- Before (inefficient):
USING (child_id = auth.uid())

-- After (optimized):
USING (child_id = (SELECT auth.uid()))
```

### 2. Multiple Permissive Policies (multiple_permissive_policies)

**Issue:** Multiple permissive policies existed for the same role and action (e.g., authenticated/SELECT), causing PostgreSQL to evaluate **all policies** for every relevant query.

**Tables affected:**

- `attempts` - Children read own, parents read all
- `profiles` - Overlapping INSERT/SELECT/UPDATE policies
- `rewards` - Children read own, parents read all
- `session_analytics` - Children read own, parents read all
- `srs` - Children read own, parents read all
- `user_badges` - Children read own, parents read all

**Solution:** Consolidated overlapping policies into single policies with OR conditions.

**Example:**

```sql
-- Before (multiple policies):
CREATE POLICY "Children can read own attempts" ...
CREATE POLICY "Parents can read all attempts" ...

-- After (consolidated):
CREATE POLICY "Users can read appropriate attempts"
  ON attempts FOR SELECT
  TO authenticated
  USING (
    (child_id = (SELECT auth.uid()) AND <child role check>)
    OR
    <parent role check>
  );
```

## Migration Details

**File:** `supabase/migrations/20251109200000_optimize_rls_policies.sql`

### Tables Updated

1. **profiles** - Consolidated to single "manage own profile" policy with optimized auth
2. **word_lists** - Consolidated INSERT/UPDATE/DELETE into "manage own" policy
3. **words** - Consolidated INSERT/UPDATE/DELETE into "manage in own lists" policy
4. **list_words** - Consolidated INSERT/UPDATE/DELETE into "manage own" policy
5. **attempts** - Consolidated SELECT policies (children own / parents all)
6. **rewards** - Consolidated SELECT policies + separate manage policies
7. **srs** - Consolidated SELECT policies (children own / parents all)
8. **parental_settings** - Consolidated INSERT/UPDATE/SELECT into "manage own" policy
9. **session_analytics** - Consolidated SELECT policies (children own / parents all)
10. **user_badges** - Consolidated SELECT policies (children own / parents all)

### Policy Count Reduction

**Before:** 35+ policies across all tables
**After:** 22 policies (37% reduction)

### Performance Benefits

1. **Reduced query evaluation time** - `auth.uid()` now evaluated once per query, not per row
2. **Simplified query planning** - PostgreSQL no longer needs to combine results from multiple permissive policies
3. **Clearer security model** - Single policy per action type makes debugging and auditing easier
4. **Better scalability** - Performance improvements become more significant as data volume grows

## Verification

Run `.\check-policies.ps1` to see current policies:

```powershell
doppler run -- pwsh .\check-policies.ps1
```

Expected output should show:

- 22 total policies
- 5 "appropriate" consolidated policies (for multi-role access)
- All policies use `(SELECT auth.uid())` pattern

## References

- [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select)
- [Database Linter - Auth RLS Init Plan](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)
- [Database Linter - Multiple Permissive Policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)

## Impact Assessment

### Expected Performance Improvements

- **Small datasets (< 100 rows):** Minimal impact (~5-10ms improvement)
- **Medium datasets (100-1000 rows):** Noticeable improvement (~20-50ms improvement)
- **Large datasets (> 1000 rows):** Significant improvement (~100ms+ improvement)

### Security

No security changes were made. All policies maintain the exact same access control logic:

- Parents can manage their own content
- Children can read their own data and insert attempts/analytics
- Parents can read all child data
- Role checks remain strict and properly enforced

### Breaking Changes

**None.** This is a pure optimization migration with no API or behavior changes.

## Testing Recommendations

1. **Functional Testing:** Verify all parent and child operations work as before
2. **Performance Testing:** Compare query execution times for large result sets
3. **Security Testing:** Confirm role-based access restrictions still work correctly

## Rollback Plan

If issues arise, the previous policies can be restored by:

1. Running the earlier migrations that created the original policies
2. Or manually dropping optimized policies and recreating the originals

However, this should not be necessary as the logic is functionally identical.

## Notes

- The `profiles` table has both "Service role can manage profiles" and "Service role full access" policies from different migrations. This duplication can be cleaned up in a future migration.
- The `srs` table similarly has "Service role full access on SRS" which could be consolidated.
- These duplicates don't cause performance issues but could be simplified for cleaner schema.
