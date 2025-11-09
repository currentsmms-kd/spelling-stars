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

  return {
    voices,
    isLoading,
    getVoiceByName,
  };
}
