/* eslint-disable no-console */
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
    // eslint-disable-next-line no-console
    console.error("[PRODUCTION ERROR]", errorData);
  }
}

export const logger = {
  /**
   * Debug logs - only in development
   */
  debug: (...args: unknown[]) => {
    if (LOG_LEVELS.debug >= currentLevelValue && shouldSample()) {
      // eslint-disable-next-line no-console
      console.log("[DEBUG]", ...formatArgs(...args));
    }
  },

  /**
   * Info logs - development only by default
   */
  info: (...args: unknown[]) => {
    if (LOG_LEVELS.info >= currentLevelValue && shouldSample()) {
      // eslint-disable-next-line no-console
      console.info("[INFO]", ...formatArgs(...args));
    }
  },

  /**
   * Warning logs - shown in dev and production
   */
  warn: (...args: unknown[]) => {
    if (LOG_LEVELS.warn >= currentLevelValue) {
      // eslint-disable-next-line no-console
      console.warn("[WARN]", ...formatArgs(...args));
    }
  },

  /**
   * Error logs - always shown, captured in production
   */
  error: (...args: unknown[]) => {
    const formattedArgs = formatArgs(...args);
    if (LOG_LEVELS.error >= currentLevelValue) {
      // eslint-disable-next-line no-console
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
      // eslint-disable-next-line no-console
      console.log("[LOG]", ...formatArgs(...args));
    }
  },
};
