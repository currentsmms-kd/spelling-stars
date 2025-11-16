# Major Issues - Agent Prompts

## Issue #5: Incomplete Sync Status Implementation

### Prompt for Agent

````
TASK: Fix pending item count in sync status to show actual count instead of boolean conversion

CONTEXT:
The useSyncStatus hook displays pending sync items to users but only shows "1 item pending" when there could be 10+ items queued. The issue is `hasPendingSync()` returns a boolean, which gets converted to 0 or 1 instead of returning the actual count.

FINDINGS:
- `src/app/hooks/useSyncStatus.ts` line 88: `pendingCount: pending ? 1 : 0`
- `hasPendingSync()` from sync.ts returns boolean (true if ANY pending items exist)
- No function exists to get actual count of pending items across all queues
- Four IndexedDB tables need counting: queuedAttempts, queuedAudio, queuedSrsUpdates, queuedStarTransactions
- Each table has `synced: false` records that need counting

PROBLEM:
Users see inaccurate sync status:
- "1 item pending" when actually 15 items queued
- No visibility into what types of items are pending (attempts vs audio vs SRS)
- Cannot assess sync completion progress
- Misleading UI leads to premature app closing while data syncing

IMPACT:
- USER EXPERIENCE: Users close app thinking sync is complete when it's not
- DATA LOSS: Partial syncs leave some data unsynced
- TRUST: Inaccurate counts reduce confidence in offline mode
- DEBUGGING: Support cannot assess sync queue state from user reports

RECOMMENDATION:

Add `getPendingCounts()` function to sync.ts that returns detailed count breakdown, then update useSyncStatus to display accurate counts.

FILES TO REVIEW:
- `src/lib/sync.ts` (1079 lines) - Sync logic and queue management
- `src/app/hooks/useSyncStatus.ts` (180 lines) - Sync status hook
- `src/data/db.ts` - IndexedDB schema with queue tables
- `src/app/components/SyncStatusBadge.tsx` (if exists) - UI component

IMPLEMENTATION STEPS:

**Step 1: Add getPendingCounts Function to sync.ts**

Add this function after `hasPendingSync()`:

```typescript
/**
 * Get detailed count of pending items in sync queues
 *
 * @returns Object with counts for each queue type and total
 */
export async function getPendingCounts(): Promise<{
  attempts: number;
  audio: number;
  srsUpdates: number;
  starTransactions: number;
  total: number;
  failed: {
    attempts: number;
    audio: number;
    srsUpdates: number;
    starTransactions: number;
    total: number;
  };
}> {
  try {
    // Count pending (not synced, not failed) in each table
    const [
      pendingAttempts,
      pendingAudio,
      pendingSrs,
      pendingStars,
      failedAttempts,
      failedAudio,
      failedSrs,
      failedStars,
    ] = await Promise.all([
      db.queuedAttempts.filter(item => !item.synced && !item.failed).count(),
      db.queuedAudio.filter(item => !item.synced && !item.failed).count(),
      db.queuedSrsUpdates.filter(item => !item.synced && !item.failed).count(),
      db.queuedStarTransactions.filter(item => !item.synced && !item.failed).count(),
      db.queuedAttempts.filter(item => item.failed).count(),
      db.queuedAudio.filter(item => item.failed).count(),
      db.queuedSrsUpdates.filter(item => item.failed).count(),
      db.queuedStarTransactions.filter(item => item.failed).count(),
    ]);

    const total = pendingAttempts + pendingAudio + pendingSrs + pendingStars;
    const failedTotal = failedAttempts + failedAudio + failedSrs + failedStars;

    return {
      attempts: pendingAttempts,
      audio: pendingAudio,
      srsUpdates: pendingSrs,
      starTransactions: pendingStars,
      total,
      failed: {
        attempts: failedAttempts,
        audio: failedAudio,
        srsUpdates: failedSrs,
        starTransactions: failedStars,
        total: failedTotal,
      },
    };
  } catch (error) {
    logger.error('Error getting pending counts:', error);
    return {
      attempts: 0,
      audio: 0,
      srsUpdates: 0,
      starTransactions: 0,
      total: 0,
      failed: {
        attempts: 0,
        audio: 0,
        srsUpdates: 0,
        starTransactions: 0,
        total: 0,
      },
    };
  }
}
````

**Step 2: Update SyncStatus Interface**

In `src/app/hooks/useSyncStatus.ts`, update the interface:

```typescript
export interface SyncStatus {
  metrics: SyncMetrics;
  pendingCount: number; // CHANGE: Now actual total count
  pendingDetails: {      // NEW: Breakdown by type
    attempts: number;
    audio: number;
    srsUpdates: number;
    starTransactions: number;
  };
  failedCount: number;
  failedDetails: {       // NEW: Failed item breakdown
    attempts: number;
    audio: number;
    srsUpdates: number;
    starTransactions: number;
  };
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTimestamp?: string;
  lastSyncDurationMs?: number;
  failedItems: {         // Keep existing for backward compatibility
    attempts: Array<...>;
    audio: Array<...>;
  };
}
```

**Step 3: Update refreshStatus Function**

Replace the `refreshStatus` function in useSyncStatus.ts:

```typescript
const refreshStatus = async () => {
  try {
    const counts = await getPendingCounts();
    const failed = await getFailedItems();
    const metrics = logger.metrics.getMetrics();

    setStatus((prev) => ({
      ...prev,
      metrics,
      pendingCount: counts.total,
      pendingDetails: {
        attempts: counts.attempts,
        audio: counts.audio,
        srsUpdates: counts.srsUpdates,
        starTransactions: counts.starTransactions,
      },
      failedCount: counts.failed.total,
      failedDetails: {
        attempts: counts.failed.attempts,
        audio: counts.failed.audio,
        srsUpdates: counts.failed.srsUpdates,
        starTransactions: counts.failed.starTransactions,
      },
      isSyncing: metrics.syncInProgress,
      lastSyncTimestamp: metrics.lastSyncTimestamp,
      lastSyncDurationMs: metrics.lastSyncDurationMs,
      failedItems: {
        attempts: failed.failedAttempts,
        audio: failed.failedAudio,
      },
    }));
  } catch (error) {
    logger.error("Error refreshing sync status:", error);
  }
};
```

**Step 4: Update SyncStatusBadge Component**

If UI component exists, update to show breakdown:

```typescript
// Tooltip or expanded view
{status.pendingCount > 0 && (
  <div className="sync-details">
    <p>{status.pendingCount} items pending:</p>
    <ul>
      {status.pendingDetails.attempts > 0 && (
        <li>{status.pendingDetails.attempts} attempts</li>
      )}
      {status.pendingDetails.audio > 0 && (
        <li>{status.pendingDetails.audio} audio files</li>
      )}
      {status.pendingDetails.srsUpdates > 0 && (
        <li>{status.pendingDetails.srsUpdates} progress updates</li>
      )}
      {status.pendingDetails.starTransactions > 0 && (
        <li>{status.pendingDetails.starTransactions} star rewards</li>
      )}
    </ul>
  </div>
)}
```

**Step 5: Export New Function**

Add to exports in sync.ts:

```typescript
export {
  syncQueuedData,
  hasPendingSync,
  getPendingCounts, // NEW
  getFailedItems,
  // ... other exports
};
```

**Step 6: Update Initial State**

In useSyncStatus.ts, update initial state:

```typescript
const [status, setStatus] = useState<SyncStatus>({
  metrics: logger.metrics.getMetrics(),
  pendingCount: 0,
  pendingDetails: {
    attempts: 0,
    audio: 0,
    srsUpdates: 0,
    starTransactions: 0,
  },
  failedCount: 0,
  failedDetails: {
    attempts: 0,
    audio: 0,
    srsUpdates: 0,
    starTransactions: 0,
  },
  isOnline,
  isSyncing: false,
  failedItems: {
    attempts: [],
    audio: [],
  },
});
```

ACCEPTANCE CRITERIA:

- [ ] getPendingCounts() function added to sync.ts
- [ ] Function counts all four queue tables correctly
- [ ] Function handles IndexedDB errors gracefully
- [ ] useSyncStatus hook uses getPendingCounts()
- [ ] UI shows actual count (e.g., "15 items pending" not "1 item pending")
- [ ] Breakdown by type available in status object
- [ ] Failed items counted separately
- [ ] No performance regression (counts should be fast)
- [ ] Tests added for getPendingCounts()

TESTING CHECKLIST:

1. Queue 5 attempts, 3 audio files, 2 SRS updates offline
2. Check status shows "10 items pending"
3. Verify breakdown shows correct counts
4. Bring online and verify counts decrease
5. Mark 2 items as failed (exceed retry limit)
6. Verify failed count shows "2 items failed"
7. Test with empty queues (0 pending)
8. Test with only one type of item pending
9. Test concurrent count queries (no race conditions)

PERFORMANCE CONSIDERATIONS:

- Count queries should use IndexedDB indexes
- Consider caching counts for 1-2 seconds to avoid repeated queries
- Debounce refresh calls during rapid sync operations

DELIVERABLES:

1. Updated sync.ts with getPendingCounts() function
2. Updated useSyncStatus.ts with detailed counts
3. Updated SyncStatus interface
4. Updated UI components to show breakdown
5. Unit tests for getPendingCounts()
6. Integration test for count accuracy during sync
7. Performance benchmark (count query should be <50ms)

```

---

## Issue #6: Missing Index on attempts.list_id ✅ RESOLVED

**STATUS:** ✅ **COMPLETED - November 15, 2025**

**Resolution Summary:**
- Migration `20251115120000_add_attempts_list_id_index.sql` created and applied successfully
- Index `idx_attempts_list_id` confirmed present in database
- Also added composite index `idx_attempts_list_child` for multi-column queries
- Documentation updated in `docs/database-schema.md`
- Verified via database health check (see `db-health-report.txt`)

**Note:** Investigation revealed the index already existed in the original schema (`20241108000000_initial_schema.sql`) and was re-confirmed in the list_id migration (`20251110214233_add_list_id_to_attempts.sql`). The new migration adds it redundantly with `IF NOT EXISTS` for safety and adds an additional composite index.

---

### Original Prompt for Agent (HISTORICAL - ISSUE RESOLVED)

```

TASK: Add database index on attempts.list_id column to optimize list-scoped analytics queries

CONTEXT:
The attempts table includes list_id for list-scoped analytics (per documentation), but migration 20241110214233_add_list_id_to_attempts.sql adds the column without creating an index. Queries filtering by list_id will perform full table scans (O(n)) instead of indexed lookups (O(log n)).

FINDINGS:

- Migration 20241110214233 adds list_id column to attempts table
- No CREATE INDEX statement in that migration or subsequent migrations
- docs/database-schema.md documents list_id as "for list-scoped analytics"
- Parent dashboard likely queries: "show all attempts for words in list X"
- Initial schema (20241108000000) creates indexes for child_id, word_id, but not list_id
- At scale (1000+ attempts), missing index causes slow queries

PROBLEM:
Without index on list_id:

- Queries like "SELECT \* FROM attempts WHERE list_id = X" scan entire table
- Analytics dashboard loads slowly for parents with many attempts
- Performance degrades linearly with attempt count
- Database CPU usage spikes during analytics queries
- Poor user experience on dashboard page

IMPACT:

- PERFORMANCE: Dashboard loads take 2-5 seconds instead of <500ms
- SCALABILITY: Problem worsens as users practice more words
- COST: Higher database CPU usage, potential auto-scaling charges
- UX: Parents frustrated by slow loading analytics

RECOMMENDATION:

Create new migration to add index on attempts.list_id column. Use conditional creation (IF NOT EXISTS) for idempotency.

FILES TO REVIEW:

- `supabase/migrations/20241110214233_add_list_id_to_attempts.sql` - Column addition
- `supabase/migrations/20241108000000_initial_schema.sql` - Initial indexes
- `docs/database-schema.md` - Schema documentation
- `push-migration.ps1` - Migration deployment script
- `check-db-health.ps1` - Database health checker

IMPLEMENTATION STEPS:

**Step 1: Create New Migration File**

Filename: `supabase/migrations/20251115120000_add_attempts_list_id_index.sql`

Content:

```sql
-- Add index on attempts.list_id for list-scoped analytics queries
-- This optimizes queries like: SELECT * FROM attempts WHERE list_id = 'uuid'
-- Expected usage: Parent dashboard analytics, list-specific progress tracking

-- Create index if it doesn't already exist (idempotent)
CREATE INDEX IF NOT EXISTS idx_attempts_list_id ON attempts(list_id);

-- Verify index was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename = 'attempts'
    AND indexname = 'idx_attempts_list_id'
  ) THEN
    RAISE NOTICE 'Index idx_attempts_list_id created successfully';
  ELSE
    RAISE WARNING 'Index idx_attempts_list_id was not created';
  END IF;
END $$;

-- Add comment documenting index purpose
COMMENT ON INDEX idx_attempts_list_id IS
  'Optimizes list-scoped analytics queries for parent dashboard. ' ||
  'Added November 2025 to improve dashboard load performance.';
```

**Step 2: Consider Composite Index**

If queries commonly filter by BOTH list_id AND child_id, create composite index:

```sql
-- Composite index for queries like:
-- SELECT * FROM attempts WHERE list_id = X AND child_id = Y
-- This is more efficient than two separate indexes

CREATE INDEX IF NOT EXISTS idx_attempts_list_child
ON attempts(list_id, child_id);

-- Note: This index can also serve queries filtering only by list_id
-- (leftmost column principle), so might replace single-column index
```

**Decision Point**: Analyze actual query patterns

- If most queries filter ONLY by list_id → single-column index
- If most queries filter by list_id AND child_id → composite index
- If both patterns common → create both indexes

**Step 3: Check Query Patterns**

Before deciding, review src/app/api/supa.ts for attempts queries:

```bash
# Search for attempts queries in codebase
grep -r "from.*attempts" src/app/api/supa.ts
grep -r "\.eq.*list_id" src/app/api/supa.ts
```

Common patterns:

- Dashboard: Filter by list_id for list analytics
- Child progress: Filter by child_id AND list_id
- Word stats: Filter by word_id (already indexed)

**Step 4: Deploy Migration**

```powershell
# Test in development first
doppler run -- pwsh .\push-migration.ps1

# Verify index created
doppler run -- pwsh .\check-db-health.ps1
```

**Step 5: Verify Index Usage**

In Supabase SQL Editor:

```sql
-- Check index exists
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'attempts'
ORDER BY indexname;

-- Explain query plan to verify index usage
EXPLAIN ANALYZE
SELECT * FROM attempts
WHERE list_id = 'some-uuid-here'
LIMIT 100;

-- Should show "Index Scan using idx_attempts_list_id"
-- NOT "Seq Scan on attempts"
```

**Step 6: Update Documentation**

Add to docs/database-schema.md:

```markdown
### Indexes on attempts table

| Index Name            | Columns  | Purpose                                |
| --------------------- | -------- | -------------------------------------- |
| idx_attempts_child_id | child_id | Filter attempts by child               |
| idx_attempts_word_id  | word_id  | Filter attempts by word                |
| idx_attempts_list_id  | list_id  | List-scoped analytics (added Nov 2025) |

Note: list_id index added in migration 20251115120000 to optimize
parent dashboard analytics queries.
```

**Step 7: Performance Testing**

Before and after benchmark:

```sql
-- Create test data (if needed)
-- Insert 10,000 test attempts spread across 10 lists

-- Benchmark WITHOUT index
EXPLAIN (ANALYZE, BUFFERS)
SELECT
  COUNT(*) as total_attempts,
  AVG(CASE WHEN correct THEN 1 ELSE 0 END) as accuracy
FROM attempts
WHERE list_id = 'test-list-uuid';

-- Add index
CREATE INDEX idx_attempts_list_id ON attempts(list_id);

-- Benchmark WITH index
EXPLAIN (ANALYZE, BUFFERS)
SELECT
  COUNT(*) as total_attempts,
  AVG(CASE WHEN correct THEN 1 ELSE 0 END) as accuracy
FROM attempts
WHERE list_id = 'test-list-uuid';

-- Compare execution time (should be 10-100x faster with index)
```

ACCEPTANCE CRITERIA:

- [ ] Migration file created with IF NOT EXISTS for idempotency
- [ ] Migration applied successfully to database
- [ ] Index visible in pg_indexes system table
- [ ] EXPLAIN ANALYZE shows index usage in query plans
- [ ] Documentation updated with index information
- [ ] Performance benchmark shows significant improvement
- [ ] No breaking changes to existing queries
- [ ] Index size reasonable (should be ~10-20% of table size)

PERFORMANCE EXPECTATIONS:

- Query time reduction: 10-100x faster depending on table size
- For 1000 attempts: ~500ms → ~50ms
- For 10,000 attempts: ~5s → ~100ms
- Index overhead: Slightly slower INSERTs (negligible)

EDGE CASES:

- Empty table: Index creation fast, no data to index
- Large table: Index creation may take 30-60 seconds
- Concurrent writes: Index maintained automatically
- Null list_id values: Index handles nulls correctly

ROLLBACK PLAN:
If index causes issues:

```sql
DROP INDEX IF EXISTS idx_attempts_list_id;
```

Note: Dropping index is safe and instant, doesn't affect data.

DELIVERABLES:

1. New migration file: 20251115120000_add_attempts_list_id_index.sql
2. Updated docs/database-schema.md with index documentation
3. Performance benchmark results (before/after)
4. Query plan verification (EXPLAIN output)
5. Index size report
6. Updated check-db-health.ps1 output showing new index

```

---

Continue to next file for remaining major issues...
```
