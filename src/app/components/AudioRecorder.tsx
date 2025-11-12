import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import {
  Mic,
  Square,
  Pause,
  Play,
  Trash2,
  Info,
  AlertTriangle,
  Check,
} from "lucide-react";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { Button } from "./Button";
import { cn } from "@/lib/utils";
import { Card } from "./Card";

interface AudioRecorderProps {
  onRecordingComplete?: (blob: Blob, url: string) => void;
  className?: string;
  showInstructions?: boolean;
  instructions?: string;
}

export function AudioRecorder({
  onRecordingComplete,
  className,
  showInstructions = true,
  instructions = "Click 'Start Recording' and speak clearly. Recording will stop automatically after 3 seconds, or click 'Stop' to end early.",
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
        height: 100,
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
      {/* Instructions Section */}
      {showInstructions && (
        <Card className="border-2 border-muted bg-muted/50 p-4">
          <div className="flex items-start gap-3">
            <Info
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary"
              aria-hidden="true"
            />
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{instructions}</p>

              {/* Tips Section */}
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium hover:text-foreground">
                  Tips for best results
                </summary>
                <ul className="mt-2 ml-4 list-disc space-y-1">
                  <li>Speak at a normal pace</li>
                  <li>Avoid background noise</li>
                  <li>Hold device 6-12 inches from mouth</li>
                  <li>Pronounce clearly</li>
                </ul>
              </details>
            </div>
          </div>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border-2 border-destructive bg-destructive/10 p-4">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive"
            aria-hidden="true"
          />
          <div className="flex-1">
            <p className="text-base font-medium text-destructive">{error}</p>
            {error.includes("Permission") && (
              <p className="mt-1 text-sm text-destructive/90">
                Please allow microphone access in your browser settings
              </p>
            )}
            {error.includes("device") && error.includes("use") && (
              <p className="mt-1 text-sm text-destructive/90">
                Close other apps using your microphone
              </p>
            )}
            {error.includes("not found") && (
              <p className="mt-1 text-sm text-destructive/90">
                Please connect a microphone
              </p>
            )}
          </div>
        </div>
      )}

      {/* Success State */}
      {audioUrl && !isPlaying && !isRecording && (
        <div
          className="flex items-start gap-3 rounded-lg border-2 border-secondary bg-secondary/10 p-3"
          style={{
            animation: "fadeIn 0.3s ease-out",
          }}
        >
          <Check
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-secondary"
            aria-hidden="true"
          />
          <p className="text-sm text-secondary">
            Recording saved! You can play it back or record again.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        {!isRecording && !audioUrl && (
          <Button
            onClick={handleStartRecording}
            variant="default"
            size="default"
            className="flex items-center gap-2"
            aria-label="Start recording audio"
            style={{
              animation: !error ? "pulse 2s ease-in-out infinite" : "none",
            }}
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
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            {isRecording ? "Recording Preview" : "Playback"}
          </label>
          <div
            ref={waveformRef}
            className={cn(
              "w-full rounded-lg border-2 p-2",
              isRecording
                ? "border-destructive bg-destructive/10"
                : "border-border bg-muted"
            )}
            style={{ height: "100px" }}
            role="region"
            aria-label="Audio waveform visualization"
          />
        </div>
      )}

      {isRecording && (
        <div
          className="flex items-center gap-3 text-destructive"
          role="status"
          aria-live="polite"
        >
          <div className="relative">
            <div
              className="h-4 w-4 animate-pulse rounded-full bg-destructive"
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 h-4 w-4 animate-ping rounded-full bg-destructive"
              aria-hidden="true"
            />
          </div>
          <span className="text-base font-medium">Recording...</span>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.02);
          }
        }
      `}</style>
    </div>
  );
}
