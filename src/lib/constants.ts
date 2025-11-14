/**
 * Application Constants
 *
 * This file centralizes magic numbers used throughout the application.
 * Import and use these constants instead of hardcoding values to ensure
 * consistency and make future updates easier.
 */

/**
 * Text-to-Speech (TTS) Constants
 */
export const TTS_CONSTANTS = {
  /**
   * Maximum number of retry attempts when loading TTS voices
   * Used when waiting for browser speech synthesis voices to become available
   */
  MAX_RETRY_COUNT: 50,

  /**
   * Interval in milliseconds between TTS voice loading retry attempts
   * 100ms allows checking every tenth of a second for available voices
   */
  RETRY_INTERVAL_MS: 100,
} as const;

/**
 * User Interface (UI) Constants
 */
export const UI_CONSTANTS = {
  /**
   * Duration in milliseconds for confetti animation display
   * Used after correct answers to celebrate success
   */
  CONFETTI_DURATION_MS: 2000,

  /**
   * Default auto-advance delay in seconds
   * Used as fallback when parental setting is not configured
   * This is the delay before automatically advancing to the next word after a correct answer
   */
  DEFAULT_AUTO_ADVANCE_DELAY_SECONDS: 3,

  /**
   * Minimum allowed auto-advance delay in seconds
   * Ensures users don't set the delay too short
   */
  MIN_AUTO_ADVANCE_DELAY_SECONDS: 2,

  /**
   * Maximum allowed auto-advance delay in seconds
   * Ensures users don't set the delay too long
   */
  MAX_AUTO_ADVANCE_DELAY_SECONDS: 8,
} as const;

/**
 * Audio Recording Constants
 */
export const RECORDING_CONSTANTS = {
  /**
   * Automatic recording stop timeout in milliseconds
   * Prevents accidentally leaving the microphone recording indefinitely
   * Stops recording after 15 seconds to conserve resources
   */
  AUTO_STOP_DURATION_MS: 15000,
} as const;

/**
 * Cache Control Constants
 */
export const CACHE_CONSTANTS = {
  /**
   * Cache control header value in seconds for signed URLs
   * Signed URLs from Supabase Storage expire after 1 hour (3600 seconds)
   * This ensures cached responses don't outlive the URL validity period
   */
  SIGNED_URL_CACHE_CONTROL_SECONDS: 3600,
} as const;
