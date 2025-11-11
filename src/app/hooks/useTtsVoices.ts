import { useState, useEffect } from "react";

/**
 * Hook to resolve and cache available TTS voices.
 *
 * The Web Speech API may not immediately return voices on first call to
 * speechSynthesis.getVoices(). This hook listens for the 'voiceschanged'
 * event to ensure voices are loaded before caching them.
 *
 * @returns {Object} Object containing:
 *   - voices: Array of available SpeechSynthesisVoice objects
 *   - isLoading: Boolean indicating if voices are still loading
 *   - getVoiceByName: Function to find a voice by name
 */
export function useTtsVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Function to load and cache voices
    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices();

      if (availableVoices.length > 0) {
        setVoices(availableVoices);
        setIsLoading(false);
      }
    };

    // Initial load attempt
    loadVoices();

    // Listen for voiceschanged event (fires when voices become available)
    const handleVoicesChanged = () => {
      loadVoices();
    };

    speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);

    // Cleanup
    return () => {
      speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
    };
  }, []);

  /**
   * Find a voice by its name from the cached list.
   *
   * @param name - The voice name to search for (e.g., "Microsoft David - English (United States)")
   * @returns The matching SpeechSynthesisVoice or null if not found
   */
  const getVoiceByName = (name: string): SpeechSynthesisVoice | null => {
    return voices.find((v) => v.name === name) || null;
  };

  /**
   * Get a fallback en-US voice if the requested voice is unavailable.
   * Prioritizes Google US English voices, then any en-US voice, then any voice.
   *
   * @returns A suitable fallback voice or null if no voices are available
   */
  const getFallbackVoice = (): SpeechSynthesisVoice | null => {
    if (voices.length === 0) return null;

    // Prefer Google US English voices (usually highest quality)
    const googleUsVoice = voices.find(
      (v) =>
        v.lang.startsWith("en-US") && v.name.toLowerCase().includes("google")
    );
    if (googleUsVoice) return googleUsVoice;

    // Fall back to any en-US voice
    const enUsVoice = voices.find((v) => v.lang.startsWith("en-US"));
    if (enUsVoice) return enUsVoice;

    // Fall back to any English voice
    const enVoice = voices.find((v) => v.lang.startsWith("en"));
    if (enVoice) return enVoice;

    // Last resort: return the first available voice
    return voices[0];
  };

  /**
   * Get a voice by name with fallback to a sensible default.
   * Ensures that a voice is always returned when voices are loaded.
   *
   * @param name - The preferred voice name
   * @returns The requested voice, or a fallback voice if not found
   */
  const getVoiceWithFallback = (name?: string): SpeechSynthesisVoice | null => {
    if (isLoading) return null;

    if (name) {
      const requestedVoice = getVoiceByName(name);
      if (requestedVoice) return requestedVoice;
    }

    return getFallbackVoice();
  };

  return {
    voices,
    isLoading,
    getVoiceByName,
    getFallbackVoice,
    getVoiceWithFallback,
  };
}
