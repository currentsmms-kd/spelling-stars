import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Mic, Square, Pause, Play, Trash2 } from "lucide-react";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

interface AudioRecorderProps {
  onRecordingComplete?: (blob: Blob, url: string) => void;
  className?: string;
}

export function AudioRecorder({
  onRecordingComplete,
  className,
}: AudioRecorderProps) {
  const {
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
  } = useAudioRecorder();

  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Initialize wavesurfer when audio is available
  useEffect(() => {
    if (audioUrl && waveformRef.current && !wavesurferRef.current) {
      wavesurferRef.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "#a855f7",
        progressColor: "#7c3aed",
        cursorColor: "#7c3aed",
        barWidth: 2,
        barRadius: 3,
        height: 80,
      });

      wavesurferRef.current.load(audioUrl);

      wavesurferRef.current.on("finish", () => {
        setIsPlaying(false);
      });
    }

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [audioUrl]);

  const handleStartRecording = async () => {
    if (audioUrl) {
      clearRecording();
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    }
    await startRecording();
  };

  const handleStopRecording = () => {
    stopRecording();
    if (audioBlob && audioUrl && onRecordingComplete) {
      onRecordingComplete(audioBlob, audioUrl);
    }
  };

  const handlePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
      setIsPlaying(!isPlaying);
    }
  };

  const handleClear = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
    }
    clearRecording();
    setIsPlaying(false);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        {!isRecording && !audioUrl && (
          <Button
            onClick={handleStartRecording}
            variant="default"
            className="flex items-center gap-2"
            aria-label="Start recording audio"
          >
            <Mic size={20} aria-hidden="true" />
            Start Recording
          </Button>
        )}

        {isRecording && (
          <>
            {isPaused ? (
              <Button
                onClick={resumeRecording}
                variant="secondary"
                aria-label="Resume recording"
              >
                <Play size={20} aria-hidden="true" />
              </Button>
            ) : (
              <Button
                onClick={pauseRecording}
                variant="secondary"
                aria-label="Pause recording"
              >
                <Pause size={20} aria-hidden="true" />
              </Button>
            )}
            <Button
              onClick={handleStopRecording}
              variant="danger"
              aria-label="Stop recording"
            >
              <Square size={20} aria-hidden="true" />
            </Button>
            <span
              className="text-lg font-mono"
              aria-live="polite"
              aria-label={`Recording duration: ${formatDuration(duration)}`}
            >
              {formatDuration(duration)}
            </span>
          </>
        )}

        {audioUrl && !isRecording && (
          <>
            <Button
              onClick={handlePlayPause}
              variant="secondary"
              aria-label={
                isPlaying ? "Pause audio playback" : "Play audio recording"
              }
            >
              {isPlaying ? (
                <Pause size={20} aria-hidden="true" />
              ) : (
                <Play size={20} aria-hidden="true" />
              )}
            </Button>
            <Button
              onClick={handleClear}
              variant="ghost"
              aria-label="Delete recording"
            >
              <Trash2 size={20} aria-hidden="true" />
            </Button>
            <span
              className="text-lg font-mono"
              aria-label={`Recording duration: ${formatDuration(duration)}`}
            >
              {formatDuration(duration)}
            </span>
          </>
        )}
      </div>

      {(audioUrl || isRecording) && (
        <div
          ref={waveformRef}
          className={cn(
            "w-full rounded-lg border",
            isRecording
              ? "bg-red-50 border-red-200"
              : "bg-gray-50 border-gray-200"
          )}
          role="region"
          aria-label="Audio waveform visualization"
        />
      )}

      {isRecording && (
        <div
          className="flex items-center gap-2 text-red-600"
          role="status"
          aria-live="polite"
        >
          <div
            className="w-3 h-3 bg-red-600 rounded-full animate-pulse"
            aria-hidden="true"
          />
          <span className="text-sm font-medium">Recording...</span>
        </div>
      )}
    </div>
  );
}
