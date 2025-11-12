/**
 * Logger utility with environment-based level control and sampling for PWA
 * Features:
 * - Environment-based level control (disables debug logs in production)
 * - Sensitive data redaction (emails, pins, tokens)
 * - Sampling support for high-frequency logs
 * - Production error capture for critical issues
 *
 * Note: This file intentionally uses console.* methods as the centralized logging abstraction.
 * All other files should use this logger instead of console directly.
 */

const isDev = import.meta.env.DEV;
const isProd = import.meta.env.PROD;

// Log level configuration
type LogLevel = "debug" | "info" | "warn" | "error";
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Current log level based on environment
const CURRENT_LOG_LEVEL: LogLevel = isDev ? "debug" : "error";
const currentLevelValue = LOG_LEVELS[CURRENT_LOG_LEVEL];

// Sampling rate for high-frequency logs (1 = 100%, 0.1 = 10%)
const SAMPLE_RATE = isDev ? 1 : 0.01;

// Sensitive patterns to redact
const SENSITIVE_PATTERNS = [
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: "[EMAIL_REDACTED]",
  },
  {
    pattern: /\bpin[_-]?code["']?\s*[:=]\s*["']?[\d]+["']?/gi,
    replacement: "pin_code: [REDACTED]",
  },
  {
    pattern: /\bpassword["']?\s*[:=]\s*["'][^"']+["']?/gi,
    replacement: "password: [REDACTED]",
  },
  {
    pattern: /\btoken["']?\s*[:=]\s*["'][^"']+["']?/gi,
    replacement: "token: [REDACTED]",
  },
  {
    pattern: /\bapi[_-]?key["']?\s*[:=]\s*["'][^"']+["']?/gi,
    replacement: "api_key: [REDACTED]",
  },
  {
    pattern: /\baccess[_-]?token["']?\s*[:=]\s*["'][^"']+["']?/gi,
    replacement: "access_token: [REDACTED]",
  },
];

/**
 * Redacts sensitive information from log messages
 */
function redactSensitiveData(data: unknown): unknown {
  if (typeof data === "string") {
    let redacted = data;
    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
      redacted = redacted.replace(pattern, replacement);
    }
    return redacted;
  }

  if (Array.isArray(data)) {
    return data.map(redactSensitiveData);
  }

  if (data && typeof data === "object") {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // Redact sensitive keys
      if (/^(password|pin|token|secret|key|credential)$/i.test(key)) {
        redacted[key] = "[REDACTED]";
      } else {
        redacted[key] = redactSensitiveData(value);
      }
    }
    return redacted;
  }

  return data;
}

/**
 * Checks if a log should be sampled based on sampling rate
 */
function shouldSample(): boolean {
  return Math.random() < SAMPLE_RATE;
}

/**
 * Formats log arguments for output
 */
function formatArgs(...args: unknown[]): unknown[] {
  return args.map(redactSensitiveData);
}

/**
 * Sends error to production monitoring (placeholder for future integration)
 */
function captureProductionError(message: string, ...args: unknown[]): void {
  // In production, could integrate with Sentry, LogRocket, etc.
  if (isProd) {
    // Placeholder: Store in IndexedDB for later analysis or send to monitoring service
    const errorData = {
      timestamp: new Date().toISOString(),
      message,
      args: formatArgs(...args),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Could store in IndexedDB or send to monitoring endpoint
    // For now, we'll just use console.error as fallback
    console.error("[PRODUCTION ERROR]", errorData);
  }
}

/**
 * Error telemetry for tracking errors across the app
 */
export interface ErrorTelemetry {
  context: string;
  message: string;
  stack?: string;
  severity: "error" | "warning" | "critical";
  timestamp: string;
  userAgent?: string;
  url?: string;
}

/**
 * Telemetry metrics for sync operations
 */
interface SyncMetrics {
  attemptsQueued: number;
  attemptsSynced: number;
  attemptsFailed: number;
  audioQueued: number;
  audioUploaded: number;
  audioFailed: number;
  lastSyncTimestamp?: string;
  lastSyncDurationMs?: number;
  syncInProgress: boolean;
}

/**
 * In-memory metrics storage (reset on app reload)
 */
let syncMetrics: SyncMetrics = {
  attemptsQueued: 0,
  attemptsSynced: 0,
  attemptsFailed: 0,
  audioQueued: 0,
  audioUploaded: 0,
  audioFailed: 0,
  syncInProgress: false,
};

/**
 * Error log storage (circular buffer, max 50 errors)
 */
const MAX_ERROR_LOG_SIZE = 50;
let errorLog: ErrorTelemetry[] = [];

/**
 * Event listeners for metrics updates (for UI components)
 */
type MetricsListener = (metrics: SyncMetrics) => void;
const metricsListeners = new Set<MetricsListener>();

/**
 * Event listeners for error updates
 */
export type ErrorListener = (error: ErrorTelemetry) => void;
const errorListeners = new Set<ErrorListener>();

/**
 * Subscribe to metrics updates
 */
function subscribeToMetrics(listener: MetricsListener): () => void {
  metricsListeners.add(listener);
  // Immediately notify with current metrics
  listener({ ...syncMetrics });

  // Return unsubscribe function
  return () => {
    metricsListeners.delete(listener);
  };
}

/**
 * Notify all listeners of metrics update
 */
function notifyMetricsListeners(): void {
  const snapshot = { ...syncMetrics };
  metricsListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.error("[METRICS] Listener error:", error);
    }
  });
}

/**
 * Subscribe to error updates
 */
function subscribeToErrors(listener: ErrorListener): () => void {
  errorListeners.add(listener);
  // Return unsubscribe function
  return () => {
    errorListeners.delete(listener);
  };
}

/**
 * Notify all error listeners
 */
function notifyErrorListeners(error: ErrorTelemetry): void {
  errorListeners.forEach((listener) => {
    try {
      listener(error);
    } catch (err) {
      console.error("[ERROR_TELEMETRY] Listener error:", err);
    }
  });
}

/**
 * Add error to circular buffer log
 */
function addErrorToLog(error: ErrorTelemetry): void {
  errorLog.push(error);
  // Maintain circular buffer by removing oldest errors
  if (errorLog.length > MAX_ERROR_LOG_SIZE) {
    errorLog = errorLog.slice(-MAX_ERROR_LOG_SIZE);
  }
}

/**
 * Increment a metrics counter
 */
function incrementMetric(
  metric: keyof Omit<
    SyncMetrics,
    "lastSyncTimestamp" | "lastSyncDurationMs" | "syncInProgress"
  >
): void {
  syncMetrics[metric]++;
  notifyMetricsListeners();
}

/**
 * Update sync status
 */
function updateSyncStatus(inProgress: boolean, durationMs?: number): void {
  syncMetrics.syncInProgress = inProgress;

  if (!inProgress && durationMs !== undefined) {
    syncMetrics.lastSyncTimestamp = new Date().toISOString();
    syncMetrics.lastSyncDurationMs = durationMs;
  }

  notifyMetricsListeners();
}

/**
 * Get current metrics snapshot
 */
function getMetrics(): SyncMetrics {
  return { ...syncMetrics };
}

/**
 * Reset all metrics (for testing or manual reset)
 */
function resetMetrics(): void {
  syncMetrics = {
    attemptsQueued: 0,
    attemptsSynced: 0,
    attemptsFailed: 0,
    audioQueued: 0,
    audioUploaded: 0,
    audioFailed: 0,
    syncInProgress: false,
  };
  notifyMetricsListeners();
}

export const logger = {
  /**
   * Debug logs - only in development
   */
  debug: (...args: unknown[]) => {
    if (LOG_LEVELS.debug >= currentLevelValue && shouldSample()) {
      console.log("[DEBUG]", ...formatArgs(...args));
    }
  },

  /**
   * Info logs - development only by default
   */
  info: (...args: unknown[]) => {
    if (LOG_LEVELS.info >= currentLevelValue && shouldSample()) {
      console.info("[INFO]", ...formatArgs(...args));
    }
  },

  /**
   * Warning logs - shown in dev and production
   */
  warn: (...args: unknown[]) => {
    if (LOG_LEVELS.warn >= currentLevelValue) {
      console.warn("[WARN]", ...formatArgs(...args));
    }
  },

  /**
   * Error logs - always shown, captured in production
   */
  error: (...args: unknown[]) => {
    const formattedArgs = formatArgs(...args);
    if (LOG_LEVELS.error >= currentLevelValue) {
      console.error("[ERROR]", ...formattedArgs);
    }

    // Capture critical errors in production
    if (isProd && args.length > 0) {
      const message = typeof args[0] === "string" ? args[0] : "Unknown error";
      captureProductionError(message, ...args.slice(1));
    }
  },

  /**
   * Alias for debug (backward compatibility)
   */
  log: (...args: unknown[]) => {
    if (LOG_LEVELS.debug >= currentLevelValue && shouldSample()) {
      console.log("[LOG]", ...formatArgs(...args));
    }
  },

  /**
   * Telemetry: Track sync metrics
   */
  metrics: {
    attemptQueued: () => incrementMetric("attemptsQueued"),
    attemptSynced: () => incrementMetric("attemptsSynced"),
    attemptFailed: () => incrementMetric("attemptsFailed"),
    audioQueued: () => incrementMetric("audioQueued"),
    audioUploaded: () => incrementMetric("audioUploaded"),
    audioFailed: () => incrementMetric("audioFailed"),
    syncStarted: () => updateSyncStatus(true),
    syncCompleted: (durationMs: number) => updateSyncStatus(false, durationMs),
    getMetrics: () => getMetrics(),
    resetMetrics: () => resetMetrics(),
    subscribe: (listener: MetricsListener) => subscribeToMetrics(listener),

    // Error telemetry
    errorCaptured: (params: {
      context: string;
      message: string;
      stack?: string;
      severity?: "error" | "warning" | "critical";
    }) => {
      const error: ErrorTelemetry = {
        context: params.context,
        message: params.message,
        stack: params.stack,
        severity: params.severity || "error",
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      // Add to error log (circular buffer)
      addErrorToLog(error);

      // Notify listeners
      notifyErrorListeners(error);

      // Log to console in development
      if (isDev) {
        console.error(
          `[ERROR_TELEMETRY] ${error.severity.toUpperCase()} in ${error.context}:`,
          error.message
        );
      }

      // In production, could send to monitoring service
      if (isProd) {
        captureProductionError(error.message, error);
      }
    },
    getErrors: () => [...errorLog],
    clearErrors: () => {
      errorLog = [];
    },
    getErrorCount: () => errorLog.length,
    subscribeToErrors: (listener: ErrorListener) => subscribeToErrors(listener),
  },
};

/**
 * Export types for external use
 */
export type { SyncMetrics, MetricsListener };
