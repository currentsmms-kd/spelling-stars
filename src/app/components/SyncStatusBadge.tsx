import { useState } from "react";
import { useSyncStatus } from "../hooks/useSyncStatus";
import { Button } from "./Button";
import {
  CloudOff,
  Cloud,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card } from "./Card";

interface SyncStatusBadgeProps {
  variant?: "parent" | "child";
}

interface SyncStatusSummaryProps {
  isOnline: boolean;
  lastSyncTimestamp?: string;
  lastSyncDurationMs?: number;
}

interface SyncMetricsProps {
  metrics: {
    attemptsQueued: number;
    attemptsSynced: number;
    audioQueued: number;
    audioUploaded: number;
  };
}

interface FailedItemsProps {
  failedCount: number;
  failedItems: {
    attempts: Array<{ id: number; lastError?: string; retryCount: number }>;
    audio: Array<{
      id: number;
      filename: string;
      lastError?: string;
      retryCount: number;
    }>;
  };
  isOnline: boolean;
  onClearFailed: () => void;
  onRetryItem: (type: "attempt" | "audio", id: number) => void;
}

const formatTimestamp = (timestamp?: string) => {
  if (!timestamp) return "Never";

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return date.toLocaleDateString();
};

function SyncStatusSummary({
  isOnline,
  lastSyncTimestamp,
  lastSyncDurationMs,
}: SyncStatusSummaryProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Network:</span>
        <span className="font-medium">
          {isOnline ? (
            <span className="text-green-600 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Online
            </span>
          ) : (
            <span className="text-red-600 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> Offline
            </span>
          )}
        </span>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Last Sync:</span>
        <span className="font-medium">
          {formatTimestamp(lastSyncTimestamp)}
        </span>
      </div>

      {lastSyncDurationMs && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Duration:</span>
          <span className="font-medium">{lastSyncDurationMs}ms</span>
        </div>
      )}
    </div>
  );
}

// Component to display sync metrics (queued/synced counts)
function SyncMetrics({ metrics }: SyncMetricsProps) {
  return (
    <div className="border-t pt-4 space-y-2">
      <h3 className="font-semibold text-sm">Metrics</h3>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <MetricItem label="Attempts Queued" value={metrics.attemptsQueued} />
        <MetricItem
          label="Attempts Synced"
          value={metrics.attemptsSynced}
          success
        />
        <MetricItem label="Audio Queued" value={metrics.audioQueued} />
        <MetricItem
          label="Audio Uploaded"
          value={metrics.audioUploaded}
          success
        />
      </div>
    </div>
  );
}

function MetricItem({
  label,
  value,
  success,
}: {
  label: string;
  value: number;
  success?: boolean;
}) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className={`font-mono font-bold ${success ? "text-green-600" : ""}`}>
        {value}
      </div>
    </div>
  );
}

// Component to display failed items with retry/clear functionality
function FailedItems({
  failedCount,
  failedItems,
  isOnline,
  onClearFailed,
  onRetryItem,
}: FailedItemsProps) {
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);

  if (failedCount === 0) return null;

  const warningMessage =
    "Clear all failed items? This cannot be undone. Failed items will be permanently removed from the queue.";

  return (
    <div className="border-t pt-4 space-y-2">
      <FailedItemsHeader
        failedCount={failedCount}
        showClearConfirmation={showClearConfirmation}
        onClearClick={() => setShowClearConfirmation(true)}
        onCancelClear={() => setShowClearConfirmation(false)}
        onConfirmClear={() => {
          onClearFailed();
          setShowClearConfirmation(false);
        }}
      />

      {showClearConfirmation && (
        <div className="p-2 bg-destructive/10 rounded text-xs text-destructive">
          {warningMessage}
        </div>
      )}

      <FailedAttemptsList
        attempts={failedItems.attempts}
        isOnline={isOnline}
        onRetryItem={onRetryItem}
      />

      <FailedAudioList
        audio={failedItems.audio}
        isOnline={isOnline}
        onRetryItem={onRetryItem}
      />
    </div>
  );
}

function FailedItemsHeader({
  failedCount,
  showClearConfirmation,
  onClearClick,
  onCancelClear,
  onConfirmClear,
}: {
  failedCount: number;
  showClearConfirmation: boolean;
  onClearClick: () => void;
  onCancelClear: () => void;
  onConfirmClear: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="font-semibold text-sm text-destructive flex items-center gap-1">
        <AlertTriangle className="w-4 h-4" />
        Failed Items ({failedCount})
      </h3>
      {showClearConfirmation ? (
        <ClearConfirmButtons
          onCancel={onCancelClear}
          onConfirm={onConfirmClear}
        />
      ) : (
        <Button size="sm" variant="outline" onClick={onClearClick}>
          Clear All
        </Button>
      )}
    </div>
  );
}

function ClearConfirmButtons({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex gap-1">
      <Button size="sm" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <Button size="sm" variant="danger" onClick={onConfirm}>
        Confirm
      </Button>
    </div>
  );
}

function FailedAttemptsList({
  attempts,
  isOnline,
  onRetryItem,
}: {
  attempts: Array<{ id: number; lastError?: string; retryCount: number }>;
  isOnline: boolean;
  onRetryItem: (type: "attempt" | "audio", id: number) => void;
}) {
  if (attempts.length === 0) return null;

  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium text-muted-foreground">Attempts</h4>
      {attempts.map((attempt) => (
        <FailedItemCard
          key={attempt.id}
          id={attempt.id}
          type="attempt"
          displayText={`#${attempt.id}`}
          lastError={attempt.lastError}
          retryCount={attempt.retryCount}
          isOnline={isOnline}
          onRetry={() => onRetryItem("attempt", attempt.id)}
        />
      ))}
    </div>
  );
}

function FailedAudioList({
  audio,
  isOnline,
  onRetryItem,
}: {
  audio: Array<{
    id: number;
    filename: string;
    lastError?: string;
    retryCount: number;
  }>;
  isOnline: boolean;
  onRetryItem: (type: "attempt" | "audio", id: number) => void;
}) {
  if (audio.length === 0) return null;

  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium text-muted-foreground">Audio</h4>
      {audio.map((item) => (
        <FailedItemCard
          key={item.id}
          id={item.id}
          type="audio"
          displayText={item.filename}
          lastError={item.lastError}
          retryCount={item.retryCount}
          isOnline={isOnline}
          onRetry={() => onRetryItem("audio", item.id)}
        />
      ))}
    </div>
  );
}

function FailedItemCard({
  displayText,
  lastError,
  retryCount,
  isOnline,
  onRetry,
}: {
  id: number;
  type: "attempt" | "audio";
  displayText: string;
  lastError?: string;
  retryCount: number;
  isOnline: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2 p-2 bg-destructive/10 rounded text-xs">
      <div className="flex-1 min-w-0">
        <div className="font-mono truncate">{displayText}</div>
        {lastError && (
          <div className="text-destructive truncate">{lastError}</div>
        )}
        <div className="text-muted-foreground">{retryCount} attempts</div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onRetry}
        disabled={!isOnline}
      >
        Retry
      </Button>
    </div>
  );
}

/**
 * Sync status indicator with expandable details panel
 *
 * Displays:
 * - Network status (online/offline)
 * - Sync progress (syncing/idle)
 * - Pending items count
 * - Failed items count with retry/clear actions
 * - Last sync timestamp
 *
 * Click to expand for detailed view with individual failed items
 */
export function SyncStatusBadge({ variant = "parent" }: SyncStatusBadgeProps) {
  const [status, actions] = useSyncStatus();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const isChild = variant === "child";
  const buttonSize = isChild ? "child" : "default";

  // Determine badge color and icon based on status
  const getBadgeStatus = () => {
    if (!status.isOnline) {
      return {
        icon: <CloudOff className="w-4 h-4" />,
        color: "bg-muted text-muted-foreground",
        label: "Offline",
      };
    }

    if (status.isSyncing) {
      return {
        icon: <Loader2 className="w-4 h-4 animate-spin" />,
        color: "bg-primary text-primary-foreground",
        label: "Syncing...",
      };
    }

    if (status.failedCount > 0) {
      return {
        icon: <AlertTriangle className="w-4 h-4" />,
        color: "bg-destructive text-destructive-foreground",
        label: `${status.failedCount} Failed`,
      };
    }

    if (status.pendingCount > 0) {
      return {
        icon: <RefreshCw className="w-4 h-4" />,
        color: "bg-accent text-accent-foreground",
        label: "Pending",
      };
    }

    return {
      icon: <Cloud className="w-4 h-4" />,
      color: "bg-muted text-muted-foreground",
      label: "Online",
    };
  };

  const badgeStatus = getBadgeStatus();

  const handleManualSync = async () => {
    try {
      setIsSyncing(true);
      await actions.manualSync();
    } catch (error) {
      // Error already logged by hook
      console.error("Sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearFailed = async () => {
    try {
      await actions.clearFailed();
    } catch (error) {
      console.error("Failed to clear items:", error);
    }
  };

  const handleRetryItem = async (type: "attempt" | "audio", id: number) => {
    try {
      await actions.retryItem(type, id);
    } catch (error) {
      console.error(`Failed to retry ${type} ${id}:`, error);
    }
  };

  return (
    <div className="relative">
      {/* Badge Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg
          transition-all duration-200
          ${badgeStatus.color}
          hover:opacity-90
          focus-visible:ring-4 focus-visible:ring-ring
          ${isChild ? "min-h-[88px] text-lg" : "min-h-[44px] text-sm"}
        `}
        aria-label={`Sync status: ${badgeStatus.label}`}
        aria-expanded={isExpanded}
      >
        {badgeStatus.icon}
        <span className="font-medium">{badgeStatus.label}</span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {/* Expanded Details Panel */}
      {isExpanded && (
        <Card
          className="
            absolute right-0 top-full mt-2 w-80 z-50
            shadow-lg max-h-96 overflow-y-auto
          "
        >
          <div className="p-4 space-y-4">
            {/* Status Summary */}
            <SyncStatusSummary
              isOnline={status.isOnline}
              lastSyncTimestamp={status.lastSyncTimestamp}
              lastSyncDurationMs={status.lastSyncDurationMs}
            />

            {/* Metrics */}
            <SyncMetrics metrics={status.metrics} />

            {/* Failed Items */}
            <FailedItems
              failedCount={status.failedCount}
              failedItems={status.failedItems}
              isOnline={status.isOnline}
              onClearFailed={handleClearFailed}
              onRetryItem={handleRetryItem}
            />

            {/* Actions */}
            <div className="border-t pt-4 space-y-2">
              <Button
                size={buttonSize}
                variant="outline"
                onClick={handleManualSync}
                disabled={!status.isOnline || status.isSyncing || isSyncing}
                className="w-full"
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${status.isSyncing || isSyncing ? "animate-spin" : ""}`}
                />
                {status.isSyncing || isSyncing ? "Syncing..." : "Sync Now"}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
