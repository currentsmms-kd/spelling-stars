# Sync Telemetry and Observability

## Overview

The SpellStars app now includes comprehensive telemetry and observability for the offline sync system. This feature provides real-time monitoring of sync operations, detailed metrics, and user-visible status indicators to diagnose issues in development and production.

## Architecture

### Components

1. **Logger Metrics Module** (`src/lib/logger.ts`)
   - In-memory metrics storage with event subscription
   - Tracks counters for all sync operations
   - Provides real-time updates to subscribers

2. **Enhanced Sync Module** (`src/lib/sync.ts`)
   - Emits telemetry events at all critical paths
   - Tracks success/failure of uploads and syncs
   - Measures sync duration

3. **React Hook** (`src/app/hooks/useSyncStatus.ts`)
   - Exposes sync status to UI components
   - Provides control actions (manual sync, retry, clear)
   - Auto-refreshes based on network and sync state

4. **UI Component** (`src/app/components/SyncStatusBadge.tsx`)
   - Visual indicator in AppShell header
   - Expandable panel with detailed metrics
   - User actions for failed items

## Metrics Tracked

### Counters

- `attemptsQueued` - Total spelling attempts queued offline
- `attemptsSynced` - Successfully synced attempts
- `attemptsFailed` - Permanently failed attempts (after 5 retries)
- `audioQueued` - Total audio recordings queued offline
- `audioUploaded` - Successfully uploaded audio files
- `audioFailed` - Permanently failed audio uploads

### Status

- `syncInProgress` - Boolean indicating active sync
- `lastSyncTimestamp` - ISO timestamp of last sync completion
- `lastSyncDurationMs` - Duration of last sync in milliseconds

## Event Emission Points

### Logger Events

All events are emitted through `logger.metrics.*`:

```typescript
// Queue events (when offline)
logger.metrics.attemptQueued();
logger.metrics.audioQueued();

// Sync lifecycle
logger.metrics.syncStarted();
logger.metrics.syncCompleted(durationMs);

// Success events
logger.metrics.attemptSynced();
logger.metrics.audioUploaded();

// Failure events (after max retries)
logger.metrics.attemptFailed();
logger.metrics.audioFailed();
```

### Sync Module Integration

Critical paths in `sync.ts` that emit events:

1. **`syncQueuedData()`** - Sync lifecycle start/complete
2. **`syncQueuedAudio()`** - Audio upload success/failure
3. **`syncQueuedAttempts()`** - Attempt sync success/failure
4. **`queueAttempt()`** - Attempt queued
5. **`queueAudio()`** - Audio queued

## UI Integration

### SyncStatusBadge

Located in the AppShell header (both parent and child views).

**Visual States:**

- **Offline** (gray) - Device is offline, items queued
- **Syncing** (primary) - Active sync operation with spinner
- **Failed** (red) - Permanently failed items needing attention
- **Pending** (accent) - Items waiting to sync
- **Online** (gray) - Connected, no pending items

**Expanded Panel Shows:**

- Network status (online/offline)
- Last sync timestamp and duration
- Cumulative metrics (queued/synced/failed)
- Detailed failed items with error messages
- Action buttons:
  - **Sync Now** - Manual sync trigger
  - **Retry** - Retry individual failed items
  - **Clear All** - Remove all failed items from queue

### Usage in Components

```tsx
import { useSyncStatus } from "@/app/hooks/useSyncStatus";

function MyComponent() {
  const [status, actions] = useSyncStatus();

  // Access metrics
  console.log(status.metrics.attemptsSynced);
  console.log(status.pendingCount);
  console.log(status.failedCount);

  // Trigger actions
  await actions.manualSync();
  await actions.retryItem("attempt", 123);
  await actions.clearFailed();
  await actions.refreshStatus();

  return <div>...</div>;
}
```

## Hook API

### `useSyncStatus(): [SyncStatus, SyncActions]`

Returns a tuple with status and actions.

**SyncStatus:**

```typescript
interface SyncStatus {
  metrics: SyncMetrics; // Raw metrics from logger
  pendingCount: number; // Items waiting to sync
  failedCount: number; // Items permanently failed
  isOnline: boolean; // Network status
  isSyncing: boolean; // Active sync operation
  lastSyncTimestamp?: string; // Last sync ISO timestamp
  lastSyncDurationMs?: number; // Last sync duration
  failedItems: {
    attempts: Array<{
      id: number;
      retryCount: number;
      lastError?: string;
      startedAt: string;
    }>;
    audio: Array<{
      id: number;
      filename: string;
      retryCount: number;
      lastError?: string;
      createdAt: string;
    }>;
  };
}
```

**SyncActions:**

```typescript
interface SyncActions {
  manualSync: () => Promise<void>; // Trigger sync now
  clearFailed: () => Promise<void>; // Clear all failed items
  retryItem: (type, id) => Promise<void>; // Retry specific item
  refreshStatus: () => Promise<void>; // Force status refresh
}
```

## Subscription Pattern

The logger uses a pub/sub pattern for real-time updates:

```typescript
// Subscribe to metrics updates
const unsubscribe = logger.metrics.subscribe((metrics) => {
  console.log("Metrics updated:", metrics);
});

// Unsubscribe when done
unsubscribe();
```

React components automatically subscribe via `useSyncStatus()` hook.

## Production Considerations

### Performance

- Metrics are in-memory only (reset on app reload)
- Subscription pattern prevents polling
- Updates only trigger on actual changes
- Failed items query is cached and refreshed every 10s when syncing

### Error Handling

- Failed items are isolated (one failure doesn't block queue)
- Exponential backoff prevents thundering herd
- After 5 attempts, items marked as permanently failed
- User can manually retry or clear failed items

### Privacy

- No PII in metrics (only counts and IDs)
- Error messages logged but redacted by logger
- No network transmission of metrics (local only)

## Testing Scenarios

### Scenario 1: Offline Queue

1. Set device to offline mode
2. Complete spelling attempts
3. Observe badge show "Offline" with pending count
4. Check metrics show `attemptsQueued` and `audioQueued` incrementing

### Scenario 2: Successful Sync

1. With queued items, go online
2. Automatic sync triggers
3. Badge shows "Syncing..." with spinner
4. After completion, badge shows "Online"
5. Metrics show `attemptsSynced` and `audioUploaded` match queued

### Scenario 3: Failed Items

1. Simulate network error during sync (DevTools)
2. After 5 retries, item marked as failed
3. Badge shows "X Failed" in red
4. Expand panel to see error details
5. Retry individual item or clear all

### Scenario 4: Manual Sync

1. Click sync badge to expand
2. Click "Sync Now" button
3. Watch real-time progress
4. Verify metrics update

## Future Enhancements

### Potential Additions

1. **Remote Telemetry**
   - Send metrics to backend for analytics
   - Track sync performance across users
   - Identify common failure patterns

2. **Notifications**
   - Toast messages for sync completion
   - Alerts for critical failures
   - Background sync status updates

3. **Detailed Logs**
   - Export sync logs for debugging
   - Store logs in IndexedDB for offline diagnostics
   - Add timestamps and stack traces

4. **Analytics Dashboard**
   - Historical sync performance graphs
   - Failure rate trends
   - Average sync duration over time

5. **Automated Retry**
   - Smart retry timing based on network quality
   - Exponentially longer backoff for repeated failures
   - Different strategies for different error types

## Related Files

- `src/lib/logger.ts` - Metrics storage and subscription
- `src/lib/sync.ts` - Sync operations with telemetry
- `src/app/hooks/useSyncStatus.ts` - React hook
- `src/app/components/SyncStatusBadge.tsx` - UI component
- `src/app/components/AppShell.tsx` - Integration point
- `src/app/components/Navigation.tsx` - TopBar with badge

## Migration Notes

This feature is fully backward compatible:

- Existing sync code continues to work
- Metrics start at zero on app load
- No database migrations required
- UI badge is opt-in (added to AppShell)

No action required for existing deployments.
