import { useState, useRef, useCallback } from "react";
import { logger } from "@/lib/logger";

interface UseAudioRecorderResult {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioUrl: string | null;
  audioBlob: Blob | null;
  error: string | null;
  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
  clearRecording: () => void;
}

export function useAudioRecorder(): UseAudioRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // Check if MediaRecorder is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "Audio recording is not supported in this browser. Please use Chrome, Firefox, or Edge."
        );
      }

      if (typeof MediaRecorder === "undefined") {
        throw new Error("MediaRecorder API is not available in this browser.");
      }

      logger.info("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      logger.info("Microphone access granted");

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          logger.debug("Audio chunk received:", event.data.size, "bytes");
        }
      };

      mediaRecorder.onstop = () => {
        logger.info("Recording stopped, creating audio blob");
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setAudioBlob(blob);
        logger.info("Audio blob created:", blob.size, "bytes");

        // Stop all tracks
        stream.getTracks().forEach((track) => {
          track.stop();
          logger.debug("Stopped audio track");
        });

        // Clear timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      mediaRecorder.onerror = (event) => {
        logger.error("MediaRecorder error:", event);
        setError("Recording error occurred. Please try again.");
      };

      mediaRecorder.start();
      logger.info("Recording started");
      setIsRecording(true);
      setIsPaused(false);
      startTimeRef.current = Date.now();
      pausedDurationRef.current = 0;

      // Update duration every 100ms
      timerRef.current = window.setInterval(() => {
        setDuration(
          (Date.now() - startTimeRef.current - pausedDurationRef.current) / 1000
        );
      }, 100);
    } catch (err) {
      let errorMessage = "Failed to start recording";

      if (err instanceof Error) {
        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError"
        ) {
          errorMessage =
            "Microphone permission denied. Please allow microphone access in your browser settings.";
        } else if (
          err.name === "NotFoundError" ||
          err.name === "DevicesNotFoundError"
        ) {
          errorMessage =
            "No microphone found. Please connect a microphone and try again.";
        } else if (
          err.name === "NotReadableError" ||
          err.name === "TrackStartError"
        ) {
          errorMessage =
            "Microphone is already in use by another application. Please close other apps using the microphone.";
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      logger.error("Error starting recording:", err);
    }
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);

      // Clear timer but save current duration
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);

      const pausedTime = Date.now() - startTimeRef.current - duration * 1000;
      pausedDurationRef.current += pausedTime;

      // Restart timer
      timerRef.current = window.setInterval(() => {
        setDuration(
          (Date.now() - startTimeRef.current - pausedDurationRef.current) / 1000
        );
      }, 100);
    }
  }, [isRecording, isPaused, duration]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
    }
  }, [isRecording]);

  const clearRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setAudioBlob(null);
    setDuration(0);
    setError(null);
  }, [audioUrl]);

  return {
    isRecording,
    isPaused,
    duration,
    audioUrl,
    audioBlob,
    error,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    clearRecording,
  };
}
