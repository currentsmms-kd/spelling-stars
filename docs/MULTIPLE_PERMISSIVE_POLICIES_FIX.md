# Fix for Multiple Permissive Policies Warning

**Date:** November 9, 2025
**Migration:** `20251109210000_fix_multiple_permissive_policies.sql`

## Problem

Supabase advisor detected 6 warnings about multiple permissive RLS policies:

| Table        | Role          | Action | Conflicting Policies                                                           |
| ------------ | ------------- | ------ | ------------------------------------------------------------------------------ |
| `list_words` | authenticated | SELECT | "Authenticated users can read list_words", "Parents can manage own list_words" |
| `rewards`    | authenticated | SELECT | "Children can manage own rewards", "Users can read appropriate rewards"        |
| `rewards`    | authenticated | UPDATE | "Children can manage own rewards", "Parents can update all rewards"            |
| `srs`        | authenticated | SELECT | "Children can manage own SRS", "Users can read appropriate SRS"                |
| `word_lists` | authenticated | SELECT | "Authenticated users can read word_lists", "Parents can manage own word_lists" |
| `words`      | authenticated | SELECT | "Authenticated users can read words", "Parents can manage words in own lists"  |

**Issue:** When using `FOR ALL` in RLS policies, it includes SELECT operations. Having both a dedicated SELECT policy AND an ALL policy causes PostgreSQL to evaluate both policies for every SELECT query, which is suboptimal for performance.

## Solution

Split `FOR ALL` policies into separate `FOR INSERT`, `FOR UPDATE`, and `FOR DELETE` policies. This ensures only ONE SELECT policy exists per table per role.

### Changes Made

#### 1. list_words Table

**Before:**

- ✗ "Authenticated users can read list_words" (SELECT)
- ✗ "Parents can manage own list_words" (ALL - includes SELECT)

**After:**

- ✓ "Authenticated users can read list_words" (SELECT only)
- ✓ "Parents can insert own list_words" (INSERT only)
- ✓ "Parents can update own list_words" (UPDATE only)
- ✓ "Parents can delete own list_words" (DELETE only)

#### 2. rewards Table

**Before:**

- ✗ "Users can read appropriate rewards" (SELECT)
- ✗ "Children can manage own rewards" (ALL - includes SELECT + UPDATE)
- ✗ "Parents can update all rewards" (UPDATE)

**After:**

- ✓ "Users can read appropriate rewards" (SELECT only)
- ✓ "Children can insert own rewards" (INSERT only)
- ✓ "Children can delete own rewards" (DELETE only)
- ✓ "Parents can update all rewards" (UPDATE only)

#### 3. srs Table

**Before:**

- ✗ "Users can read appropriate SRS" (SELECT)
- ✗ "Children can manage own SRS" (ALL - includes SELECT)

**After:**

- ✓ "Users can read appropriate SRS" (SELECT only)
- ✓ "Children can insert own SRS" (INSERT only)
- ✓ "Children can update own SRS" (UPDATE only)
- ✓ "Children can delete own SRS" (DELETE only)
- ✓ "Service role full access on SRS" (ALL - service_role keeps ALL)

#### 4. word_lists Table

**Before:**

- ✗ "Authenticated users can read word_lists" (SELECT)
- ✗ "Parents can manage own word_lists" (ALL - includes SELECT)

**After:**

- ✓ "Authenticated users can read word_lists" (SELECT only)
- ✓ "Parents can insert own word_lists" (INSERT only)
- ✓ "Parents can update own word_lists" (UPDATE only)
- ✓ "Parents can delete own word_lists" (DELETE only)

#### 5. words Table

**Before:**

- ✗ "Authenticated users can read words" (SELECT)
- ✗ "Parents can manage words in own lists" (ALL - includes SELECT)

**After:**

- ✓ "Authenticated users can read words" (SELECT only)
- ✓ "Parents can insert words" (INSERT only)
- ✓ "Parents can update words" (UPDATE only)
- ✓ "Parents can delete words" (DELETE only)

## Benefits

1. **Performance**: Each query now evaluates only the minimum necessary policies
2. **Clarity**: Explicit policies make permissions easier to understand and audit
3. **Maintainability**: Separate policies are easier to modify individually
4. **Compliance**: Resolves all 6 Supabase advisor warnings

## Verification

After applying the migration:

```sql
-- Query to verify no duplicate policies per table/role/action
SELECT
    tablename,
    cmd as action,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename, cmd
HAVING COUNT(*) > 1;
```

**Result:** No duplicate policies found ✓

### Policy Count Summary

| Table      | SELECT | INSERT | UPDATE | DELETE | ALL |
| ---------- | ------ | ------ | ------ | ------ | --- |
| list_words | 1      | 1      | 1      | 1      | 0   |
| rewards    | 1      | 1      | 1      | 1      | 0   |
| srs        | 1      | 1      | 1      | 1      | 1\* |
| word_lists | 1      | 1      | 1      | 1      | 0   |
| words      | 1      | 1      | 1      | 1      | 0   |

\*Service role only

## Related Documentation

- [Supabase RLS Performance Guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Database Linter: Multiple Permissive Policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)
- [RLS Optimization Migration](./RLS_OPTIMIZATION.md)

## Migration History

1. `20251109200000_optimize_rls_policies.sql` - Initial RLS optimization (consolidated policies, added SELECT wrappers)
2. `20251109210000_fix_multiple_permissive_policies.sql` - **This fix** - Split ALL policies into granular operations

## Notes for Future Development

When creating new RLS policies:

1. ✓ **DO**: Use specific command types (`FOR SELECT`, `FOR INSERT`, `FOR UPDATE`, `FOR DELETE`)
2. ✗ **DON'T**: Use `FOR ALL` for authenticated users if a separate SELECT policy exists
3. ✓ **DO**: Use `FOR ALL` only for service_role or when no other policies exist
4. ✓ **DO**: Wrap `auth.uid()` in `(SELECT auth.uid())` to prevent per-row evaluation
5. ✓ **DO**: Consolidate role-based SELECT logic into a single policy (e.g., "Users can read appropriate X")

## Testing

Verified functionality:

- ✓ Parents can create/read/update/delete their own word lists
- ✓ Parents can create/read/update/delete words
- ✓ Children can read all lists/words
- ✓ Children can create/read/update/delete their own SRS entries
- ✓ Children can read their own rewards/analytics
- ✓ Parents can read all rewards/analytics
- ✓ Service role maintains full access to all tables
