import { useState, useEffect } from "react";
import { logger, type SyncMetrics } from "@/lib/logger";
import {
  getPendingCounts,
  getFailedItems,
  clearFailedItems,
  retryFailedItem,
  syncQueuedData,
} from "@/lib/sync";
import { useOnline } from "./useOnline";

export interface SyncStatus {
  metrics: SyncMetrics;
  pendingCount: number; // Total count of all pending items
  pendingDetails: {
    attempts: number;
    audio: number;
    srsUpdates: number;
    starTransactions: number;
  };
  failedCount: number;
  failedDetails: {
    attempts: number;
    audio: number;
    srsUpdates: number;
    starTransactions: number;
  };
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTimestamp?: string;
  lastSyncDurationMs?: number;
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

export interface SyncActions {
  manualSync: () => Promise<void>;
  clearFailed: () => Promise<void>;
  retryItem: (type: "attempt" | "audio", id: number) => Promise<void>;
  refreshStatus: () => Promise<void>;
}

/**
 * Hook to monitor sync queue status and provide control actions
 *
 * This hook provides real-time visibility into the offline sync queue:
 * - Pending items waiting to sync
 * - Failed items that exceeded retry limits
 * - Current sync operation status
 * - Manual controls for retry/clear
 *
 * Updates automatically when:
 * - Items are queued offline
 * - Sync completes (success or failure)
 * - Network status changes
 */
export function useSyncStatus(): [SyncStatus, SyncActions] {
  const isOnline = useOnline();
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

  // Refresh counts and failed items from IndexedDB
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

  // Subscribe to metrics updates from logger
  useEffect(() => {
    const unsubscribe = logger.metrics.subscribe((metrics) => {
      setStatus((prev) => ({
        ...prev,
        metrics,
        isSyncing: metrics.syncInProgress,
        lastSyncTimestamp: metrics.lastSyncTimestamp,
        lastSyncDurationMs: metrics.lastSyncDurationMs,
      }));
    });

    return unsubscribe;
  }, []);

  // Update online status
  useEffect(() => {
    setStatus((prev) => ({ ...prev, isOnline }));
  }, [isOnline]);

  // Refresh counts periodically and on online status change
  useEffect(() => {
    refreshStatus();

    // Refresh every 10 seconds if online and syncing
    const interval = setInterval(() => {
      if (status.isSyncing || !isOnline) {
        refreshStatus();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isOnline, status.isSyncing]);

  // Manual sync trigger
  const manualSync = async () => {
    if (!isOnline) {
      logger.warn("Cannot sync: device is offline");
      return;
    }

    if (status.isSyncing) {
      logger.warn("Sync already in progress");
      return;
    }

    try {
      logger.log("Manual sync triggered by user");
      await syncQueuedData();
      await refreshStatus();
    } catch (error) {
      logger.error("Manual sync failed:", error);
      await refreshStatus();
      throw error;
    }
  };

  // Clear all failed items
  const clearFailed = async () => {
    try {
      logger.log("Clearing failed items");
      await clearFailedItems();
      await refreshStatus();
    } catch (error) {
      logger.error("Error clearing failed items:", error);
      throw error;
    }
  };

  // Retry a specific failed item
  const retryItem = async (type: "attempt" | "audio", id: number) => {
    try {
      logger.log(`Retrying ${type} ${id}`);
      await retryFailedItem(type, id);
      await refreshStatus();

      // Trigger sync if online
      if (isOnline) {
        await syncQueuedData();
        await refreshStatus();
      }
    } catch (error) {
      logger.error(`Error retrying ${type} ${id}:`, error);
      throw error;
    }
  };

  const actions: SyncActions = {
    manualSync,
    clearFailed,
    retryItem,
    refreshStatus,
  };

  return [status, actions];
}
