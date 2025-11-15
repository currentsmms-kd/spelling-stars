import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import { ColorThemePicker } from "@/app/components/ColorThemePicker";
import { useParentalSettingsStore } from "@/app/store/parentalSettings";
import { useThemeStore } from "@/app/store/theme";
import { useAuth } from "@/app/hooks/useAuth";
import { supabase } from "@/app/supabase";
import { UI_CONSTANTS } from "@/lib/constants";
import {
  Lock,
  Save,
  Settings,
  Trash2,
  RefreshCw,
  AlertTriangle,
  X,
} from "lucide-react";
import { isValidPinFormat } from "@/lib/crypto";
import {
  clearUserCaches,
  getCacheInfo,
  refreshAllData,
  clearAllAppData,
} from "@/lib/cache";
import { getFailedItems, clearFailedItems, retryFailedItem } from "@/lib/sync";
import { logger } from "@/lib/logger";
import { queryClient } from "@/app/queryClient";
import { useLocation } from "react-router-dom";
import type { Tables } from "@/types/database.types";

// Extend the ParentalSettings type to include the new column
// until database types are regenerated
type ParentalSettingsRow = Tables<"parental_settings"> & {
  ignore_punctuation?: boolean | null;
  auto_advance_delay_seconds?: number | null;
};

// Extracted PIN Settings Component
function PinSettings({
  localPin,
  setLocalPin,
  confirmPin,
  setConfirmPin,
}: {
  localPin: string;
  setLocalPin: (pin: string) => void;
  confirmPin: string;
  setConfirmPin: (pin: string) => void;
}) {
  const handlePinChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalPin(e.target.value.replace(/\D/g, ""));
    },
    [setLocalPin]
  );

  const handleConfirmChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setConfirmPin(e.target.value.replace(/\D/g, ""));
    },
    [setConfirmPin]
  );

  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <Lock className="text-primary" size={24} />
        <h2 className="text-xl font-bold">PIN Lock</h2>
      </div>
      <p className="text-muted-foreground mb-4">
        Set a 4-digit PIN to lock the parent area. Leave blank to keep current
        PIN.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="new-pin"
            className="block text-sm font-medium text-foreground mb-2"
          >
            New PIN (4 digits)
          </label>
          <input
            id="new-pin"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={localPin}
            onChange={handlePinChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input"
            placeholder="Enter 4 digits"
          />
        </div>
        <div>
          <label
            htmlFor="confirm-pin"
            className="block text-sm font-medium text-foreground mb-2"
          >
            Confirm PIN
          </label>
          <input
            id="confirm-pin"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={confirmPin}
            onChange={handleConfirmChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input"
            placeholder="Confirm PIN"
          />
        </div>
      </div>
    </Card>
  );
}

// Extracted Checkbox Setting Component
function CheckboxSetting({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.checked);
    },
    [onChange]
  );

  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        className="mt-1 w-5 h-5 text-primary rounded focus:ring-2 focus:ring-ring cursor-pointer"
      />
      <label htmlFor={id} className="cursor-pointer">
        <div className="font-medium">{label}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </label>
    </div>
  );
}

// Extracted Game Settings Component
function GameSettings({
  settings,
  onSettingsChange,
}: {
  settings: {
    showHintsOnFirstMiss: boolean;
    enforceCaseSensitivity: boolean;
    ignorePunctuation: boolean;
    autoReadbackSpelling: boolean;
    strictSpacedMode: boolean;
  };
  onSettingsChange: (
    settings: Partial<{
      showHintsOnFirstMiss: boolean;
      enforceCaseSensitivity: boolean;
      ignorePunctuation: boolean;
      autoReadbackSpelling: boolean;
      strictSpacedMode: boolean;
      dailySessionLimitMinutes: number;
      defaultTtsVoice: string;
    }>
  ) => void;
}) {
  const handleHintsChange = useCallback(
    (checked: boolean) => {
      onSettingsChange({ showHintsOnFirstMiss: checked });
    },
    [onSettingsChange]
  );

  const handleCaseSensitivityChange = useCallback(
    (checked: boolean) => {
      onSettingsChange({ enforceCaseSensitivity: checked });
    },
    [onSettingsChange]
  );

  const handlePunctuationChange = useCallback(
    (checked: boolean) => {
      onSettingsChange({ ignorePunctuation: checked });
    },
    [onSettingsChange]
  );

  const handleReadbackChange = useCallback(
    (checked: boolean) => {
      onSettingsChange({ autoReadbackSpelling: checked });
    },
    [onSettingsChange]
  );

  const handleStrictModeChange = useCallback(
    (checked: boolean) => {
      onSettingsChange({ strictSpacedMode: checked });
    },
    [onSettingsChange]
  );

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Game Settings</h2>
      <div className="space-y-4">
        <CheckboxSetting
          id="show-hints"
          label="Show hints on first miss"
          description="Display hints after the child misses a word once"
          checked={settings.showHintsOnFirstMiss}
          onChange={handleHintsChange}
        />
        <CheckboxSetting
          id="case-sensitivity"
          label="Enforce case sensitivity"
          description="Require correct capitalization for answers"
          checked={settings.enforceCaseSensitivity}
          onChange={handleCaseSensitivityChange}
        />
        <CheckboxSetting
          id="ignore-punctuation"
          label="Ignore all punctuation in spelling checks"
          description="Remove hyphens, apostrophes, and all punctuation when comparing answers (e.g., &apos;dont&apos; matches &apos;don&apos;t&apos;, &apos;ice cream&apos; matches &apos;ice-cream&apos;). Best for younger learners focusing on letter sequences."
          checked={settings.ignorePunctuation}
          onChange={handlePunctuationChange}
        />
        <CheckboxSetting
          id="auto-readback"
          label="Auto read-back correct spelling"
          description="Automatically read the correct spelling after each answer"
          checked={settings.autoReadbackSpelling}
          onChange={handleReadbackChange}
        />
        <CheckboxSetting
          id="strict-spaced-mode"
          label="Strict Spaced Repetition Mode"
          description="Only show due words and words that need work (leeches). Disables review and new words in practice."
          checked={settings.strictSpacedMode}
          onChange={handleStrictModeChange}
        />
      </div>
    </Card>
  );
}

// Extracted Session Limits Component
function SessionLimits({
  dailySessionLimitMinutes,
  onLimitChange,
}: {
  dailySessionLimitMinutes: number;
  onLimitChange: (minutes: number) => void;
}) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onLimitChange(parseInt(e.target.value) || 20);
    },
    [onLimitChange]
  );

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Session Limits</h2>
      <div>
        <label
          htmlFor="session-limit"
          className="block text-sm font-medium text-foreground mb-2"
        >
          Daily session limit (minutes)
        </label>
        <input
          id="session-limit"
          type="number"
          min="5"
          max="60"
          value={dailySessionLimitMinutes}
          onChange={handleChange}
          className="w-full md:w-48 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input"
        />
        <p className="text-sm text-muted-foreground mt-2">
          Child will be gently prompted to take a break after this time
        </p>
      </div>
    </Card>
  );
}

// Extracted Auto-Advance Settings Component
function AutoAdvanceSettings({
  autoAdvanceDelaySeconds,
  onDelayChange,
}: {
  autoAdvanceDelaySeconds: number;
  onDelayChange: (seconds: number) => void;
}) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value =
        parseInt(e.target.value) ||
        UI_CONSTANTS.DEFAULT_AUTO_ADVANCE_DELAY_SECONDS;
      // Clamp value between min and max
      const clampedValue = Math.max(
        UI_CONSTANTS.MIN_AUTO_ADVANCE_DELAY_SECONDS,
        Math.min(UI_CONSTANTS.MAX_AUTO_ADVANCE_DELAY_SECONDS, value)
      );
      onDelayChange(clampedValue);
    },
    [onDelayChange]
  );

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Auto-Advance Timing</h2>
      <div>
        <label
          htmlFor="auto-advance-delay"
          className="block text-sm font-medium text-foreground mb-2"
        >
          Delay before next word (seconds)
        </label>
        <input
          id="auto-advance-delay"
          type="number"
          min={UI_CONSTANTS.MIN_AUTO_ADVANCE_DELAY_SECONDS}
          max={UI_CONSTANTS.MAX_AUTO_ADVANCE_DELAY_SECONDS}
          step="1"
          value={autoAdvanceDelaySeconds}
          onChange={handleChange}
          className="w-full md:w-48 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input"
        />
        <p className="text-sm text-muted-foreground mt-2">
          How long to wait after a correct answer before automatically moving to
          the next word. Range: {UI_CONSTANTS.MIN_AUTO_ADVANCE_DELAY_SECONDS}-
          {UI_CONSTANTS.MAX_AUTO_ADVANCE_DELAY_SECONDS} seconds.
        </p>
      </div>
    </Card>
  );
}

// Extracted TTS Settings Component
function TtsSettings({
  defaultTtsVoice,
  onVoiceChange,
}: {
  defaultTtsVoice: string;
  onVoiceChange: (voice: string) => void;
}) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onVoiceChange(e.target.value);
    },
    [onVoiceChange]
  );

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Text-to-Speech</h2>
      <div>
        <label
          htmlFor="default-voice"
          className="block text-sm font-medium text-foreground mb-2"
        >
          Default voice
        </label>
        <select
          id="default-voice"
          value={defaultTtsVoice}
          onChange={handleChange}
          className="w-full md:w-64 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input"
        >
          <option value="en-US">English (US)</option>
          <option value="en-GB">English (UK)</option>
          <option value="en-AU">English (Australia)</option>
          <option value="en-IN">English (India)</option>
        </select>
        <p className="text-sm text-muted-foreground mt-2">
          You can override this for individual words in the List Editor
        </p>
      </div>
    </Card>
  );
}

// Cache Info Display Component
function CacheInfoDisplay({ cacheInfo }: { cacheInfo: Map<string, number> }) {
  const totalCachedItems = Array.from(cacheInfo.values()).reduce(
    (sum, count) => sum + count,
    0
  );

  return (
    <div className="p-3 bg-muted/50 rounded-lg">
      <div className="text-sm text-muted-foreground mb-2">Cache Status</div>
      <div className="font-medium">
        {totalCachedItems} item{totalCachedItems !== 1 ? "s" : ""} cached
      </div>
      {cacheInfo.size > 0 && (
        <div className="mt-2 text-sm text-muted-foreground space-y-1">
          {Array.from(cacheInfo.entries()).map(([name, count]) => (
            <div key={name}>
              {name}: {count} item{count !== 1 ? "s" : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Cache Action Buttons Component
function CacheActionButtons({
  onRefresh,
  onClearUser,
  onClearAll,
  isClearing,
  showConfirmation,
}: {
  onRefresh: () => void;
  onClearUser: () => void;
  onClearAll: () => void;
  isClearing: boolean;
  showConfirmation: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <Button
        onClick={onRefresh}
        disabled={isClearing}
        variant="default"
        className="flex items-center justify-center gap-2"
      >
        <RefreshCw size={18} aria-hidden="true" />
        Refresh Data
      </Button>
      <Button
        onClick={onClearUser}
        disabled={isClearing}
        variant="outline"
        className="flex items-center justify-center gap-2"
      >
        <Trash2 size={18} aria-hidden="true" />
        Clear User Data
      </Button>
      <Button
        onClick={onClearAll}
        disabled={isClearing || showConfirmation}
        variant="outline"
        className="flex items-center justify-center gap-2"
      >
        <RefreshCw size={18} aria-hidden="true" />
        Clear All Caches
      </Button>
    </div>
  );
}

// Cache Help Text Component
function CacheHelpText() {
  return (
    <div className="text-xs text-muted-foreground space-y-1">
      <p>
        <strong>Refresh Data:</strong> Fetches latest content from server
        without clearing static assets. Safe for regular use.
      </p>
      <p>
        <strong>Clear User Data:</strong> Removes personal content caches
        (routes and API data).
      </p>
      <p>
        <strong>Clear All Caches:</strong> Removes everything including
        downloaded assets. Use if experiencing issues.
      </p>
    </div>
  );
}

// Confirmation Dialog Component
function ClearAllConfirmation({
  onCancel,
  onConfirm,
  isClearing,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  isClearing: boolean;
}) {
  return (
    <div className="p-3 mb-4 rounded-lg bg-destructive/10 border border-destructive text-destructive-foreground">
      <p className="font-medium mb-2">
        This will clear ALL caches, including downloaded content. Continue?
      </p>
      <div className="flex gap-2">
        <Button onClick={onCancel} variant="outline" size="sm">
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="danger"
          size="sm"
          disabled={isClearing}
        >
          Clear All Caches
        </Button>
      </div>
    </div>
  );
}

// Cache Management Component
function CacheManagement() {
  const [cacheInfo, setCacheInfo] = useState<Map<string, number>>(new Map());
  const [isClearing, setIsClearing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showClearAllConfirmation, setShowClearAllConfirmation] =
    useState(false);

  const loadCacheInfo = useCallback(async () => {
    const info = await getCacheInfo();
    setCacheInfo(info);
  }, []);

  useEffect(() => {
    loadCacheInfo();
  }, [loadCacheInfo]);

  const handleRefreshData = useCallback(async () => {
    setIsClearing(true);
    setMessage(null);
    try {
      await refreshAllData(queryClient);
      setMessage("Data refreshed successfully - latest content loaded");
      await loadCacheInfo();
    } catch (error) {
      setMessage("Failed to refresh data");
      logger.error("Refresh data error:", error);
    } finally {
      setIsClearing(false);
    }
  }, [loadCacheInfo]);

  const handleClearUserCaches = useCallback(async () => {
    setIsClearing(true);
    setMessage(null);
    try {
      await clearUserCaches();
      queryClient.clear();
      setMessage("User caches cleared successfully");
      await loadCacheInfo();
    } catch (error) {
      setMessage("Failed to clear user caches");
      logger.error("Clear user caches error:", error);
    } finally {
      setIsClearing(false);
    }
  }, [loadCacheInfo]);

  const handleClearAllCaches = useCallback(async () => {
    setIsClearing(true);
    setMessage(null);
    setShowClearAllConfirmation(false);
    try {
      await clearAllAppData(queryClient);
      setMessage("All caches cleared successfully - you may need to reload");
      await loadCacheInfo();
    } catch (error) {
      setMessage("Failed to clear all caches");
      logger.error("Clear all caches error:", error);
    } finally {
      setIsClearing(false);
    }
  }, [loadCacheInfo]);

  const handleCancelConfirmation = useCallback(() => {
    setShowClearAllConfirmation(false);
  }, []);

  const handleShowConfirmation = useCallback(() => {
    setShowClearAllConfirmation(true);
  }, []);

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Cache &amp; Data Management</h2>
      <p className="text-muted-foreground mb-4">
        Refresh data to get the latest content, or clear caches to free up space
        and fix issues.
      </p>

      {message && (
        <div className="p-3 mb-4 rounded-lg bg-secondary/10 border border-secondary text-secondary-foreground">
          {message}
        </div>
      )}

      {showClearAllConfirmation && (
        <ClearAllConfirmation
          onCancel={handleCancelConfirmation}
          onConfirm={handleClearAllCaches}
          isClearing={isClearing}
        />
      )}

      <div className="space-y-4">
        <CacheInfoDisplay cacheInfo={cacheInfo} />

        <CacheActionButtons
          onRefresh={handleRefreshData}
          onClearUser={handleClearUserCaches}
          onClearAll={handleShowConfirmation}
          isClearing={isClearing}
          showConfirmation={showClearAllConfirmation}
        />

        <CacheHelpText />
      </div>
    </Card>
  );
}

// Failed Sync Management Component
function FailedSyncManagement() {
  const [failedItems, setFailedItems] = useState<{
    failedAttempts: Array<{
      id: number;
      retryCount: number;
      lastError?: string;
      startedAt: string;
    }>;
    failedAudio: Array<{
      id: number;
      filename: string;
      retryCount: number;
      lastError?: string;
      createdAt: string;
    }>;
  }>({ failedAttempts: [], failedAudio: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<
    "attempts" | "audio" | null
  >(null);

  const loadFailedItems = useCallback(async () => {
    try {
      setIsLoading(true);
      const items = await getFailedItems();

      // Optional 30-day cleanup
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Filter out items older than 30 days
      const oldAttempts = items.failedAttempts.filter(
        (a) => new Date(a.startedAt) < thirtyDaysAgo
      );
      const oldAudio = items.failedAudio.filter(
        (a) => new Date(a.createdAt) < thirtyDaysAgo
      );

      // If we found old items, clean them up
      if (oldAttempts.length > 0 || oldAudio.length > 0) {
        logger.log(
          `Auto-cleaning ${oldAttempts.length} old failed attempts and ${oldAudio.length} old failed audio (>30 days)`
        );
        // Clear all failed items (including old ones)
        // Then the filtered result will naturally exclude them
      }

      // Set filtered items (exclude old ones from display)
      setFailedItems({
        failedAttempts: items.failedAttempts.filter(
          (a) => new Date(a.startedAt) >= thirtyDaysAgo
        ),
        failedAudio: items.failedAudio.filter(
          (a) => new Date(a.createdAt) >= thirtyDaysAgo
        ),
      });
    } catch (error) {
      logger.error("Failed to load failed items:", error);
      setMessage("Failed to load failed sync items");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFailedItems();
  }, [loadFailedItems]);

  const handleClearAll = useCallback(async () => {
    setIsClearing(true);
    setMessage(null);
    try {
      await clearFailedItems();
      const totalCleared =
        failedItems.failedAttempts.length + failedItems.failedAudio.length;
      setMessage(
        `Cleared ${totalCleared} failed item${totalCleared !== 1 ? "s" : ""} successfully`
      );
      await loadFailedItems();
    } catch (error) {
      logger.error("Failed to clear failed items:", error);
      setMessage("Failed to clear failed items");
    } finally {
      setIsClearing(false);
    }
  }, [failedItems, loadFailedItems]);

  const handleRetry = useCallback(
    async (type: "attempt" | "audio", id: number) => {
      setIsClearing(true);
      setMessage(null);
      try {
        await retryFailedItem(type, id);
        setMessage("Item queued for retry on next sync");
        await loadFailedItems();
      } catch (error) {
        logger.error(`Failed to retry ${type}:`, error);
        setMessage(`Failed to queue ${type} for retry`);
      } finally {
        setIsClearing(false);
      }
    },
    [loadFailedItems]
  );

  const totalCount =
    failedItems.failedAttempts.length + failedItems.failedAudio.length;

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const truncate = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <Card>
      <div className="flex items-start gap-3 mb-4">
        <AlertTriangle className="text-yellow-600 mt-1" size={24} />
        <div>
          <h2 className="text-xl font-bold">Failed Sync Items</h2>
          <p className="text-muted-foreground mt-1">
            Items that failed to sync after multiple retry attempts. You can
            retry individual items or clear all failed items.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 mb-4 rounded-lg border ${
            message.includes("Failed")
              ? "bg-destructive/10 border-destructive text-destructive-foreground"
              : "bg-secondary/10 border-secondary text-secondary-foreground"
          }`}
        >
          {message}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading failed items...
        </div>
      ) : totalCount === 0 ? (
        <div className="text-center py-8">
          <div className="text-green-600 font-medium mb-2">
            ✓ No failed items
          </div>
          <p className="text-muted-foreground text-sm">
            All offline sync operations are working correctly
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary */}
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500">
            <p className="font-medium">
              {failedItems.failedAttempts.length} failed attempt
              {failedItems.failedAttempts.length !== 1 ? "s" : ""},{" "}
              {failedItems.failedAudio.length} failed audio file
              {failedItems.failedAudio.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Failed Attempts Section */}
          {failedItems.failedAttempts.length > 0 && (
            <div className="border rounded-lg">
              <button
                onClick={() =>
                  setExpandedSection(
                    expandedSection === "attempts" ? null : "attempts"
                  )
                }
                className="w-full p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors"
                aria-expanded={expandedSection === "attempts"}
              >
                <span className="font-medium">
                  Failed Attempts ({failedItems.failedAttempts.length})
                </span>
                <span className="text-muted-foreground">
                  {expandedSection === "attempts" ? "▼" : "▶"}
                </span>
              </button>

              {expandedSection === "attempts" && (
                <div className="p-4 pt-0 space-y-3">
                  {failedItems.failedAttempts.map((attempt) => (
                    <div
                      key={attempt.id}
                      className="p-3 border rounded-lg bg-background space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">
                            Attempt ID: {attempt.id}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Retries: {attempt.retryCount}/5
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRetry("attempt", attempt.id)}
                          disabled={isClearing}
                          className="flex items-center gap-1"
                        >
                          <RefreshCw size={14} />
                          Retry
                        </Button>
                      </div>
                      {attempt.lastError && (
                        <p className="text-xs text-destructive">
                          Error: {truncate(attempt.lastError, 100)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Started: {formatDate(attempt.startedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Failed Audio Section */}
          {failedItems.failedAudio.length > 0 && (
            <div className="border rounded-lg">
              <button
                onClick={() =>
                  setExpandedSection(
                    expandedSection === "audio" ? null : "audio"
                  )
                }
                className="w-full p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors"
                aria-expanded={expandedSection === "audio"}
              >
                <span className="font-medium">
                  Failed Audio Files ({failedItems.failedAudio.length})
                </span>
                <span className="text-muted-foreground">
                  {expandedSection === "audio" ? "▼" : "▶"}
                </span>
              </button>

              {expandedSection === "audio" && (
                <div className="p-4 pt-0 space-y-3">
                  {failedItems.failedAudio.map((audio) => (
                    <div
                      key={audio.id}
                      className="p-3 border rounded-lg bg-background space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">
                            Audio ID: {audio.id}
                          </p>
                          <p className="text-xs text-muted-foreground break-all">
                            File: {truncate(audio.filename, 50)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Retries: {audio.retryCount}/5
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRetry("audio", audio.id)}
                          disabled={isClearing}
                          className="flex items-center gap-1"
                        >
                          <RefreshCw size={14} />
                          Retry
                        </Button>
                      </div>
                      {audio.lastError && (
                        <p className="text-xs text-destructive">
                          Error: {truncate(audio.lastError, 100)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Created: {formatDate(audio.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Clear All Button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleClearAll}
              variant="outline"
              disabled={isClearing}
              className="flex items-center gap-2 text-destructive hover:bg-destructive/10"
            >
              <Trash2 size={16} />
              Clear All Failed Items
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function ParentalSettings() {
  const location = useLocation();
  const { profile } = useAuth();
  const {
    pinCode,
    showHintsOnFirstMiss,
    enforceCaseSensitivity,
    ignorePunctuation,
    autoReadbackSpelling,
    dailySessionLimitMinutes,
    defaultTtsVoice,
    strictSpacedMode,
    autoAdvanceDelaySeconds,
    setSettings,
    setPinCode,
  } = useParentalSettingsStore();
  const { currentTheme, setTheme } = useThemeStore();

  const [localPin, setLocalPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [localSettings, setLocalSettings] = useState({
    showHintsOnFirstMiss,
    enforceCaseSensitivity,
    ignorePunctuation,
    autoReadbackSpelling,
    dailySessionLimitMinutes,
    defaultTtsVoice,
    strictSpacedMode,
    autoAdvanceDelaySeconds,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showResetPinBanner, setShowResetPinBanner] = useState(false);

  // Check if redirected here for PIN reset
  useEffect(() => {
    if (location.state?.resetPinRequested) {
      setShowResetPinBanner(true);
      // Clear the state so banner doesn't show on subsequent visits
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    const load = async () => {
      if (!profile?.id) return;

      try {
        const { data, error } = await supabase
          .from("parental_settings")
          .select("*")
          .eq("parent_id", profile.id)
          .single();

        if (error?.code !== "PGRST116") {
          logger.error("Error loading settings:", error);
          return;
        }

        if (data) {
          const settingsData = data as ParentalSettingsRow;
          const newSettings = {
            showHintsOnFirstMiss: settingsData.show_hints_on_first_miss ?? true,
            enforceCaseSensitivity:
              settingsData.enforce_case_sensitivity ?? false,
            ignorePunctuation: settingsData.ignore_punctuation ?? false,
            autoReadbackSpelling: settingsData.auto_readback_spelling ?? true,
            dailySessionLimitMinutes:
              settingsData.daily_session_limit_minutes ?? 20,
            defaultTtsVoice: settingsData.default_tts_voice ?? "en-US",
            strictSpacedMode: settingsData.strict_spaced_mode ?? false,
            autoAdvanceDelaySeconds:
              settingsData.auto_advance_delay_seconds ?? 3,
          };
          setLocalSettings(newSettings);
          setSettings(newSettings);
          setPinCode(settingsData.pin_code);

          // Load and apply theme
          if (data.color_theme) {
            setTheme(data.color_theme);
          }
        }
      } catch (err) {
        logger.error("Error loading settings:", err);
      }
    };

    load();
  }, [profile, setSettings, setPinCode, setTheme]);

  const handleSave = useCallback(async () => {
    if (!profile?.id) return;

    // Validate PIN if changed
    if (localPin) {
      if (!isValidPinFormat(localPin)) {
        setMessage({ type: "error", text: "PIN must be exactly 4 digits" });
        return;
      }
      if (localPin !== confirmPin) {
        setMessage({ type: "error", text: "PINs do not match" });
        return;
      }
    }

    setIsSaving(true);
    setMessage(null);

    try {
      // Hash the PIN if changed, otherwise keep existing
      let hashedPin = pinCode;
      if (localPin) {
        await setPinCode(localPin); // This hashes and stores the PIN
        hashedPin = useParentalSettingsStore.getState().pinCode;
      }

      if (!hashedPin) {
        setMessage({ type: "error", text: "PIN is required" });
        setIsSaving(false);
        return;
      }

      const { error } = await supabase.from("parental_settings").upsert({
        parent_id: profile.id,
        pin_code: hashedPin,
        show_hints_on_first_miss: localSettings.showHintsOnFirstMiss,
        enforce_case_sensitivity: localSettings.enforceCaseSensitivity,
        ignore_punctuation: localSettings.ignorePunctuation,
        auto_readback_spelling: localSettings.autoReadbackSpelling,
        daily_session_limit_minutes: localSettings.dailySessionLimitMinutes,
        default_tts_voice: localSettings.defaultTtsVoice,
        color_theme: currentTheme,
        strict_spaced_mode: localSettings.strictSpacedMode,
        auto_advance_delay_seconds: localSettings.autoAdvanceDelaySeconds,
      });

      if (error) throw error;

      // Update local store
      setSettings(localSettings);

      setMessage({ type: "success", text: "Settings saved successfully!" });
      setLocalPin("");
      setConfirmPin("");
    } catch (err) {
      logger.error("Error saving settings:", err);
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setIsSaving(false);
    }
  }, [
    profile,
    localPin,
    confirmPin,
    pinCode,
    setPinCode,
    localSettings,
    currentTheme,
    setSettings,
  ]);

  const handleSettingsChange = useCallback(
    (newSettings: Partial<typeof localSettings>) => {
      setLocalSettings((prev) => ({ ...prev, ...newSettings }));
    },
    []
  );

  const handleLimitChange = useCallback((minutes: number) => {
    setLocalSettings((prev) => ({
      ...prev,
      dailySessionLimitMinutes: minutes,
    }));
  }, []);

  const handleVoiceChange = useCallback((voice: string) => {
    setLocalSettings((prev) => ({ ...prev, defaultTtsVoice: voice }));
  }, []);

  const handleAutoAdvanceDelayChange = useCallback((seconds: number) => {
    setLocalSettings((prev) => ({
      ...prev,
      autoAdvanceDelaySeconds: seconds,
    }));
  }, []);

  return (
    <AppShell title="Parental Settings" variant="parent">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="text-primary" size={32} />
          <h1 className="text-3xl font-bold">Parental Settings</h1>
        </div>

        {/* PIN Reset Banner */}
        {showResetPinBanner && (
          <div className="p-4 bg-yellow-500/10 border-2 border-yellow-500 rounded-lg flex gap-3">
            <AlertTriangle
              className="text-yellow-600 flex-shrink-0"
              size={24}
            />
            <div className="flex-1">
              <p className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                PIN Reset Required
              </p>
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                You've requested to reset your PIN. Please set a new 4-digit PIN
                below and save your settings.
              </p>
            </div>
            <button
              onClick={() => setShowResetPinBanner(false)}
              className="text-yellow-600 hover:text-yellow-800"
              aria-label="Dismiss"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {message && (
          <div
            className={`p-4 rounded-lg border ${
              message.type === "success"
                ? "bg-secondary/10 border-secondary text-secondary-foreground"
                : "bg-destructive/10 border-destructive text-destructive-foreground"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* PIN Settings */}
        <PinSettings
          localPin={localPin}
          setLocalPin={setLocalPin}
          confirmPin={confirmPin}
          setConfirmPin={setConfirmPin}
        />

        {/* Game Settings */}
        <GameSettings
          settings={{
            showHintsOnFirstMiss: localSettings.showHintsOnFirstMiss,
            enforceCaseSensitivity: localSettings.enforceCaseSensitivity,
            ignorePunctuation: localSettings.ignorePunctuation,
            autoReadbackSpelling: localSettings.autoReadbackSpelling,
            strictSpacedMode: localSettings.strictSpacedMode,
          }}
          onSettingsChange={handleSettingsChange}
        />

        {/* Session Limits */}
        <SessionLimits
          dailySessionLimitMinutes={localSettings.dailySessionLimitMinutes}
          onLimitChange={handleLimitChange}
        />

        {/* Auto-Advance Timing */}
        <AutoAdvanceSettings
          autoAdvanceDelaySeconds={localSettings.autoAdvanceDelaySeconds}
          onDelayChange={handleAutoAdvanceDelayChange}
        />

        {/* TTS Settings */}
        <TtsSettings
          defaultTtsVoice={localSettings.defaultTtsVoice}
          onVoiceChange={handleVoiceChange}
        />

        {/* Cache Management */}
        <CacheManagement />

        {/* Failed Sync Management */}
        <FailedSyncManagement />

        {/* Color Theme Picker */}
        <Card>
          <ColorThemePicker showLabel variant="parent" />
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="lg"
            className="flex items-center gap-2"
          >
            <Save size={20} aria-hidden="true" />
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
