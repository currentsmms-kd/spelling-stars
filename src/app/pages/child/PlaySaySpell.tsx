import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import { RewardStar } from "@/app/components/RewardStar";
import { VisuallyHidden } from "@/app/components/VisuallyHidden";
import { Volume2, Mic, CheckCircle, XCircle, Home } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/app/supabase";
import { useAuth } from "@/app/hooks/useAuth";
import { useOnline } from "@/app/hooks/useOnline";
import { useAudioRecorder } from "@/app/hooks/useAudioRecorder";
import { useTtsVoices } from "@/app/hooks/useTtsVoices";
import { useParentalSettingsStore } from "@/app/store/parentalSettings";
import { useSessionStore } from "@/app/store/session";
import { queueAttempt, queueAudio } from "@/lib/sync";
import { logger } from "@/lib/logger";
import { toast } from "react-hot-toast";
import { normalizeSpellingAnswer, getHintText } from "@/lib/utils";
import {
  TTS_CONSTANTS,
  UI_CONSTANTS,
  RECORDING_CONSTANTS,
  CACHE_CONSTANTS,
} from "@/lib/constants";
import {
  useUpdateSrs,
  useAwardStars,
  useUpdateDailyStreak,
  computeAttemptQuality,
} from "@/app/api/supa";
import { queueSrsUpdate, queueStarTransaction } from "@/lib/sync";
import type { Tables } from "@/types/database.types";

type Word = Tables<"words">;

interface ListWithWords {
  id: string;
  title: string;
  words: Word[];
}

/**
 * Recording step of Say & Spell game.
 * User hears the word and records themselves spelling it out loud.
 *
 * Features:
 * - Play word button (recorded audio or TTS)
 * - Start/Stop recording controls
 * - 3-second auto-stop timer
 * - Recording status display
 * - Error handling for microphone issues
 * - Redo recording option
 *
 * Recording Flow:
 * 1. User clicks "Start Recording"
 * 2. Browser requests microphone permission
 * 3. Recording starts (max 3 seconds)
 * 4. Recording stops automatically or manually
 * 5. Audio blob is created and saved
 * 6. Automatically advances to Type step
 *
 * Error Handling:
 * - Permission denied: Show instructions to enable microphone
 * - No microphone: Prompt to connect device
 * - Device in use: Suggest closing other apps
 */
function RecordStep({
  playWord,
  handleStartRecording,
  isRecording,
  audioBlob,
  audioUrl,
  error,
  clearRecording,
  stopRecording,
  onContinueToType,
  isProcessingAudio,
}: {
  playWord: () => void;
  handleStartRecording: () => Promise<void>;
  isRecording: boolean;
  audioBlob: Blob | null;
  audioUrl: string | null;
  error: string | null;
  clearRecording: () => void;
  stopRecording: () => void;
  onContinueToType: () => void;
  isProcessingAudio: boolean;
}) {
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const playRecording = () => {
    if (audioRef.current) {
      audioRef.current.play();
    }
  };
  return (
    <>
      <div>
        <p className="text-2xl text-muted-foreground mb-6">
          Listen to the word, then say the spelling out loud
        </p>

        {/* Display error message if recording fails */}
        {error && (
          <div
            className="mb-6 p-4 bg-destructive/10 border-2 border-destructive rounded-lg"
            role="alert"
            aria-live="assertive"
          >
            <p className="text-xl font-semibold text-destructive mb-2">
              Recording Error
            </p>
            <p className="text-lg text-destructive">{error}</p>
            <Button
              onClick={clearRecording}
              size="default"
              variant="outline"
              className="mt-4"
            >
              Try Again
            </Button>
          </div>
        )}

        <Button
          onClick={playWord}
          size="child"
          className="w-64 flex items-center justify-center gap-3 mb-6"
          aria-label="Play word to hear pronunciation"
        >
          <Volume2 size={32} />
          <span>Play Word</span>
        </Button>
      </div>

      <div className="space-y-6">
        <p className="text-2xl font-semibold">Record yourself spelling:</p>

        {!isRecording && !audioBlob && (
          <Button
            onClick={handleStartRecording}
            size="child"
            className="w-64 mx-auto flex items-center justify-center gap-3 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            aria-label="Start recording your spelling"
          >
            <Mic size={32} />
            <span>Start Recording</span>
          </Button>
        )}

        {isRecording && (
          <div className="space-y-4">
            <div className="animate-pulse text-destructive">
              <Mic size={64} className="mx-auto" aria-hidden="true" />
            </div>
            <p className="text-xl text-muted-foreground" aria-live="polite">
              Recording... (up to 15 seconds)
            </p>
            <Button
              onClick={stopRecording}
              size="child"
              className="w-64 mx-auto flex items-center justify-center gap-3"
              aria-label="Stop recording early"
            >
              Stop Recording
            </Button>
          </div>
        )}

        {audioBlob && (
          <div className="space-y-4">
            <CheckCircle
              size={48}
              className="mx-auto text-secondary"
              aria-hidden="true"
            />
            <p className="text-xl text-muted-foreground" aria-live="polite">
              Recording saved!
            </p>

            {/* Hidden audio element for playback */}
            {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}

            {/* Play recording button */}
            <Button
              onClick={playRecording}
              size="child"
              className="w-64 mx-auto flex items-center justify-center gap-3 bg-secondary hover:bg-secondary/90"
              aria-label="Listen to your recording"
            >
              <Volume2 size={32} />
              <span>Listen to Your Recording</span>
            </Button>

            {/* Show processing indicator when audio is being queued */}
            {isProcessingAudio && (
              <div
                className="text-center text-xl text-muted-foreground"
                aria-live="polite"
              >
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Processing recording...
                </span>
              </div>
            )}

            {/* Continue to type button */}
            <Button
              onClick={onContinueToType}
              size="child"
              className="w-64 mx-auto flex items-center justify-center gap-3"
              disabled={isProcessingAudio}
              aria-label="Continue to type your spelling"
            >
              {isProcessingAudio ? "Processing..." : "Continue to Type"}
            </Button>

            {/* Re-record button */}
            <Button
              onClick={clearRecording}
              size="default"
              variant="outline"
              className="w-64 mx-auto"
              aria-label="Record again"
            >
              Record Again
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Typing step of Say & Spell game.
 * User types the spelling they just recorded.
 *
 * Features:
 * - Text input with auto-focus
 * - Answer validation
 * - Progressive hints (first letter → full word)
 * - Retry and Next Word buttons
 * - Loading states during save
 * - Confetti animation on correct answer
 *
 * Hint System:
 * - Level 0: No hint
 * - Level 1: First letter shown
 * - Level 2: Full word shown
 *
 * Offline Handling:
 * - Disables submit if offline and audio not queued
 * - Shows offline indicator
 * - Queues attempts for later sync
 */
function TypeStep({
  answer,
  setAnswer,
  checkAnswer,
  feedback,
  showHint,
  currentWord,
  redoRecording,
  retry,
  nextWord,
  showConfetti,
  isOnline,
  audioBlobId,
  isSaving,
  isProcessingAudio,
  ignorePunctuation,
}: {
  answer: string;
  setAnswer: (value: string) => void;
  checkAnswer: () => void;
  feedback: "correct" | "wrong" | null;
  showHint: number;
  currentWord: Word | undefined;
  redoRecording: () => void;
  retry: () => void;
  nextWord: () => void;
  showConfetti: boolean;
  isOnline: boolean;
  audioBlobId: number | null;
  isSaving: boolean;
  isProcessingAudio: boolean;
  ignorePunctuation: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setAnswer(e.target.value);
    },
    [setAnswer]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (
        e.key === "Enter" &&
        answer.trim() &&
        feedback === null &&
        !isSaving &&
        !isProcessingAudio
      ) {
        checkAnswer();
      }
    },
    [answer, feedback, checkAnswer, isSaving, isProcessingAudio]
  );

  // Auto-focus input when step changes to 'type'
  useEffect(() => {
    if (feedback === null && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentWord, feedback]);

  return (
    <div className="space-y-4">
      <p className="text-2xl text-muted-foreground">Now type the spelling:</p>

      <VisuallyHidden as="label" htmlFor="spelling-input-say">
        Type the spelling you just recorded
      </VisuallyHidden>

      <input
        ref={inputRef}
        id="spelling-input-say"
        type="text"
        value={answer}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        className={`w-full text-4xl text-center px-6 py-4 border-4 border-primary rounded-2xl focus:ring-4 focus:ring-ring focus:border-primary font-bold bg-input ${isSaving ? "opacity-50" : ""}`}
        placeholder="Type here..."
        disabled={feedback === "correct" || isSaving}
        aria-describedby={showHint > 0 ? "hint-text-say" : undefined}
      />

      {showHint > 0 && feedback === "wrong" && (
        <div className="text-center" id="hint-text-say">
          {showHint === 1 && (
            <p className="text-2xl text-secondary">
              Hint: &quot;
              {getHintText(currentWord?.text || "", ignorePunctuation)}
              &quot;
            </p>
          )}
          {showHint === 2 && (
            <p className="text-2xl text-secondary">
              The correct spelling is: <strong>{currentWord?.text}</strong>
            </p>
          )}
        </div>
      )}

      {feedback === null && (
        <div className="space-y-3">
          {/* Show processing indicator when audio is being queued */}
          {isProcessingAudio && (
            <div
              className="text-center text-xl text-muted-foreground"
              aria-live="polite"
            >
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span>
                Processing recording...
              </span>
            </div>
          )}

          <Button
            onClick={checkAnswer}
            size="child"
            className="w-full"
            disabled={
              !answer.trim() ||
              (!isOnline && !audioBlobId) ||
              isSaving ||
              isProcessingAudio
            }
          >
            {isProcessingAudio ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span>
                Processing Recording...
              </span>
            ) : isSaving ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span>
                Saving...
              </span>
            ) : (
              "Check Answer"
            )}
          </Button>
          <Button
            onClick={redoRecording}
            size="child"
            className="w-full bg-muted hover:bg-muted/90 text-muted-foreground"
          >
            Re-record
          </Button>
        </div>
      )}

      {feedback === "correct" && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3 text-secondary">
            <CheckCircle size={48} />
            <p className="text-4xl font-bold">Correct! 🎉</p>
          </div>
          {showConfetti && <div className="text-6xl animate-bounce">⭐</div>}
        </div>
      )}

      {feedback === "wrong" && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3 text-accent">
            <XCircle size={48} />
            <p className="text-4xl font-bold">Try Again!</p>
          </div>
          {showHint < 2 ? (
            <Button onClick={retry} size="child" className="w-full">
              Retry
            </Button>
          ) : (
            <Button onClick={nextWord} size="child" className="w-full">
              Next Word
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function GameHeader({ starsEarned }: { starsEarned: number }) {
  // Generate stable keys for star components
  const stars = Array.from({ length: 5 }, (_, i) => ({
    id: `star-${i}`,
    filled: i < starsEarned,
  }));

  return (
    <div className="flex items-center justify-between">
      <Link to="/child/home">
        <Button size="child" className="flex items-center gap-2">
          <Home size={24} />
          <span>Home</span>
        </Button>
      </Link>
      <div className="flex gap-2" aria-live="polite" aria-atomic="true">
        <VisuallyHidden>Stars earned: {starsEarned} out of 5</VisuallyHidden>
        <div className="flex gap-2" aria-hidden="true">
          {stars.map((star) => (
            <RewardStar key={star.id} filled={star.filled} size="lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

function GameProgress({
  listTitle,
  currentIndex,
  total,
}: {
  listTitle: string;
  currentIndex: number;
  total: number;
}) {
  return (
    <div className="text-center" aria-live="polite" aria-atomic="true">
      <p className="text-2xl font-bold">{listTitle}</p>
      <p className="text-xl text-muted-foreground mt-2">
        Word {currentIndex + 1} of {total}
      </p>
    </div>
  );
}

function GameContent({
  listData,
  currentWordIndex,
  starsEarned,
  step,
  playWord,
  handleStartRecording,
  isRecording,
  audioBlob,
  audioUrl,
  error,
  answer,
  setAnswer,
  checkAnswer,
  feedback,
  showHint,
  currentWord,
  redoRecording,
  retry,
  nextWord,
  showConfetti,
  isOnline,
  audioBlobId,
  clearRecording,
  isSaving,
  isProcessingAudio,
  stopRecording,
  onContinueToType,
  ignorePunctuation,
}: {
  listData: ListWithWords;
  currentWordIndex: number;
  starsEarned: number;
  step: "record" | "type";
  playWord: () => void;
  handleStartRecording: () => Promise<void>;
  isRecording: boolean;
  audioBlob: Blob | null;
  audioUrl: string | null;
  error: string | null;
  answer: string;
  setAnswer: (value: string) => void;
  checkAnswer: () => void;
  feedback: "correct" | "wrong" | null;
  showHint: number;
  currentWord: Word | undefined;
  redoRecording: () => void;
  retry: () => void;
  nextWord: () => void;
  showConfetti: boolean;
  isOnline: boolean;
  audioBlobId: number | null;
  clearRecording: () => void;
  isSaving: boolean;
  isProcessingAudio: boolean;
  stopRecording: () => void;
  onContinueToType: () => void;
  ignorePunctuation: boolean;
}) {
  const { profile } = useAuth();

  return (
    <div className="max-w-3xl mx-auto space-y-8 relative">
      {/* Equipped avatar and streak display in corner */}
      <div className="absolute top-4 right-4 flex items-center gap-3">
        {profile?.equipped_avatar && (
          <div className="text-5xl">{profile.equipped_avatar}</div>
        )}
        {(profile?.streak_days || 0) > 0 && (
          <div className="flex items-center gap-1 bg-primary/20 px-3 py-2 rounded-full">
            <span className="text-3xl">🔥</span>
            <span className="text-2xl font-bold">{profile?.streak_days}</span>
          </div>
        )}
      </div>

      <GameHeader starsEarned={starsEarned} />

      <GameProgress
        listTitle={listData.title}
        currentIndex={currentWordIndex}
        total={listData.words.length}
      />

      {/* Announce step transitions for screen readers */}
      <VisuallyHidden aria-live="polite">
        {step === "record"
          ? "Now recording your spelling"
          : "Now type your spelling"}
      </VisuallyHidden>

      <Card variant="child">
        <div className="text-center space-y-8">
          {step === "record" && (
            <RecordStep
              playWord={playWord}
              handleStartRecording={handleStartRecording}
              isRecording={isRecording}
              audioBlob={audioBlob}
              audioUrl={audioUrl}
              error={error}
              clearRecording={clearRecording}
              stopRecording={stopRecording}
              onContinueToType={onContinueToType}
              isProcessingAudio={isProcessingAudio}
            />
          )}

          {step === "type" && (
            <TypeStep
              answer={answer}
              setAnswer={setAnswer}
              checkAnswer={checkAnswer}
              feedback={feedback}
              showHint={showHint}
              currentWord={currentWord}
              redoRecording={redoRecording}
              retry={retry}
              nextWord={nextWord}
              showConfetti={showConfetti}
              isOnline={isOnline}
              audioBlobId={audioBlobId}
              isSaving={isSaving}
              isProcessingAudio={isProcessingAudio}
              ignorePunctuation={ignorePunctuation}
            />
          )}
        </div>
      </Card>
    </div>
  );
}

function NoListSelected() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const lastErrorRef = useRef<string | null>(null);

  const handleGoHome = useCallback(() => {
    navigate("/child/home");
  }, [navigate]);

  const handleSelectList = useCallback(
    (listId: string) => {
      navigate(`?listId=${listId}`);
    },
    [navigate]
  );

  // Fetch all word lists - children have read access via RLS
  // Use list_words(count) pattern to get counts consistently
  const {
    data: lists,
    isLoading: listsLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["word_lists_for_child", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("word_lists")
        .select("*, list_words(count)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Transform to include word count
      // Supabase returns count as [{ count: N }], extract the count value
      return (data || []).map((list) => {
        const listWords = list.list_words as unknown;
        let wordCount = 0;

        if (Array.isArray(listWords) && listWords.length > 0) {
          // Supabase count aggregation returns [{ count: N }]
          const countObj = listWords[0] as { count?: number };
          wordCount = countObj?.count || 0;
        }

        return {
          ...list,
          word_count: wordCount,
        };
      });
    },
    enabled: Boolean(profile?.id),
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes to reduce flicker
  });

  // Move telemetry to useEffect to avoid duplicate emissions on re-renders
  useEffect(() => {
    if (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to load spelling lists";

      // Only emit telemetry if this is a new/different error
      if (lastErrorRef.current !== errorMessage) {
        lastErrorRef.current = errorMessage;
        logger.metrics.errorCaptured({
          context: "PlaySaySpell.loadLists",
          message: errorMessage,
          severity: "warning",
        });
      }
    } else {
      // Clear the error ref when error is resolved
      lastErrorRef.current = null;
    }
  }, [error]);

  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  if (error) {
    return (
      <AppShell title="Say & Spell" variant="child">
        <Card
          variant="child"
          role="alert"
          aria-live="assertive"
          className="max-w-3xl mx-auto"
        >
          <div className="text-center space-y-6">
            <h3 className="text-3xl font-bold text-destructive">
              Error Loading Lists
            </h3>
            <p className="text-xl text-muted-foreground">
              {error instanceof Error
                ? error.message
                : "Failed to load spelling lists. Please try again."}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="child" onClick={handleRetry}>
                Retry
              </Button>
              <Button size="child" variant="outline" onClick={handleGoHome}>
                Go to Home
              </Button>
            </div>
          </div>
        </Card>
      </AppShell>
    );
  }

  if (listsLoading) {
    return (
      <AppShell title="Say & Spell" variant="child">
        <Card variant="child" className="max-w-3xl mx-auto">
          <div className="text-center" aria-live="polite">
            <p className="text-2xl">Loading lists...</p>
          </div>
        </Card>
      </AppShell>
    );
  }

  if (!lists || lists.length === 0) {
    return (
      <AppShell title="Say & Spell" variant="child">
        <Card variant="child" className="max-w-3xl mx-auto">
          <div className="text-center space-y-6">
            <h3 className="text-3xl font-bold">No Lists Available</h3>
            <p className="text-xl text-muted-foreground">
              Ask your parent to create some spelling lists first!
            </p>
            <Button size="child" onClick={handleGoHome}>
              Go to Home
            </Button>
          </div>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Say & Spell" variant="child">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h3 className="text-3xl font-bold mb-4">Choose a list to practice</h3>
          <p className="text-xl text-muted-foreground">
            Pick a list to start practicing!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {lists.map((list) => {
            return (
              <ListCard key={list.id} list={list} onSelect={handleSelectList} />
            );
          })}
        </div>

        <div className="text-center">
          <Button size="child" variant="outline" onClick={handleGoHome}>
            Back to Home
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

// Separate component to avoid inline arrow functions
function ListCard({
  list,
  onSelect,
}: {
  list: { id: string; title: string; word_count: number };
  onSelect: (id: string) => void;
}) {
  const handleClick = useCallback(() => {
    onSelect(list.id);
  }, [list.id, onSelect]);

  return (
    <Card
      variant="child"
      role="button"
      tabIndex={0}
      aria-label={`Practice ${list.title}, ${list.word_count} words`}
      onClick={handleClick}
    >
      <div className="text-center space-y-4">
        <h4 className="text-2xl font-bold">{list.title}</h4>
        <p className="text-xl text-muted-foreground">
          {list.word_count} {list.word_count === 1 ? "word" : "words"}
        </p>
        <Button size="child" className="w-full">
          Practice This List
        </Button>
      </div>
    </Card>
  );
}

function LoadingState() {
  return (
    <AppShell title="Say & Spell" variant="child">
      <Card variant="child" className="max-w-3xl mx-auto">
        <p className="text-2xl text-center">Loading...</p>
      </Card>
    </AppShell>
  );
}

/**
 * TWO-STEP GAME FLOW:
 *
 * STEP 1: RECORD
 * - User hears the word (audio or TTS)
 * - User clicks "Start Recording"
 * - User says the spelling out loud (e.g., "C-A-T")
 * - Recording stops after 3 seconds (or manual stop)
 * - Audio is saved to Supabase Storage (or queued if offline)
 * - Automatically advances to Step 2
 *
 * STEP 2: TYPE
 * - User types the spelling they just said
 * - Answer is validated
 * - Feedback provided (correct/wrong with hints)
 * - On correct: auto-advance to next word after 5s
 * - On wrong: show hints and allow retry
 *
 * STATE MANAGEMENT:
 * - step: 'record' | 'type' - controls which UI to show
 * - audioBlob: recorded audio data
 * - audioBlobId: queued audio ID for offline mode
 * - answer: typed spelling
 * - feedback: validation result
 *
 * OFFLINE HANDLING:
 * - Audio recordings queued in IndexedDB
 * - Attempts queued with audio blob ID reference
 * - Background sync uploads audio when online
 * - Attempts link to uploaded audio via blob ID
 */

/**
 * Say & Spell Game Mode
 *
 * Two-step game where children:
 * 1. RECORD: Say the spelling out loud (e.g., "C-A-T")
 * 2. TYPE: Type the spelling they just recorded
 *
 * This mode reinforces spelling through multi-modal learning:
 * - Auditory: hearing the word
 * - Verbal: saying the spelling
 * - Visual: seeing their typed answer
 * - Kinesthetic: typing the letters
 *
 * Game Flow:
 * 1. User selects a spelling list
 * 2. Step 1 (Record): User hears word and records spelling
 * 3. Audio is saved (or queued if offline)
 * 4. Step 2 (Type): User types the spelling
 * 5. Answer is checked and feedback provided
 * 6. Correct: auto-advance after 5s
 * 7. Incorrect: show hints and allow retry
 * 8. After all words: navigate to rewards page
 *
 * Offline Support:
 * - Audio recordings queued in IndexedDB
 * - Attempts queued for sync
 * - SRS updates queued for sync
 * - Game continues seamlessly offline
 *
 * Accessibility:
 * - Recording status announced to screen readers
 * - Auto-focus on input in type step
 * - Live regions announce feedback
 * - Keyboard navigation throughout
 */
export function PlaySaySpell() {
  const [searchParams] = useSearchParams();
  const listId = searchParams.get("listId"); // Fixed: was "list", should be "listId"
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isOnline = useOnline();
  const { getVoiceWithFallback, isLoading: voicesLoading } = useTtsVoices();
  const { enforceCaseSensitivity, ignorePunctuation, autoAdvanceDelaySeconds } =
    useParentalSettingsStore();

  // Calculate auto-advance delay in milliseconds from parental setting
  const autoAdvanceDelayMs =
    (autoAdvanceDelaySeconds ||
      UI_CONSTANTS.DEFAULT_AUTO_ADVANCE_DELAY_SECONDS) * 1000;

  const [currentWordIndex, setCurrentWordIndex] = useState(0); // Index in words array
  const [step, setStep] = useState<"record" | "type">("record"); // Current game step
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioBlobId, setAudioBlobId] = useState<number | null>(null); // Queued audio ID for offline
  const [isProcessingAudio, setIsProcessingAudio] = useState(false); // Tracks audio queueing operation
  const [answer, setAnswer] = useState(""); // User's typed spelling
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null); // Validation result
  const [showHint, setShowHint] = useState(0); // Hint level: 0=none, 1=first letter, 2=full word
  const [starsEarned, setStarsEarned] = useState(0); // Stars earned this session
  const [isFirstAttempt, setIsFirstAttempt] = useState(true); // True until first wrong answer
  const [showConfetti, setShowConfetti] = useState(false); // Confetti animation trigger

  // Refs for timeout cleanup
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const confettiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const ttsRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const ttsRetryCountRef = useRef<number>(0);

  // Ref to track last played word - prevents duplicate TTS playback
  const lastPlayedWordIdRef = useRef<string | null>(null);

  // Hooks for D3/D4 features
  const updateSrs = useUpdateSrs();
  const awardStars = useAwardStars();

  // Get shared session state for streak tracking
  const { hasUpdatedStreak, setHasUpdatedStreak } = useSessionStore();

  const updateStreak = useUpdateDailyStreak();

  // Update streak when component mounts (first practice of session)
  useEffect(() => {
    if (profile?.id && !hasUpdatedStreak) {
      updateStreak.mutate(profile.id, {
        onSuccess: () => {
          setHasUpdatedStreak(true);
        },
        onError: (error) => {
          logger.warn("Failed to update daily streak", error);
          // Leave hasUpdatedStreak as false to allow retry
        },
      });
    }
  }, [profile?.id, hasUpdatedStreak, setHasUpdatedStreak, updateStreak]);

  const {
    isRecording,
    startRecording,
    stopRecording,
    audioBlob: recordedBlob,
    audioUrl: recordedAudioUrl,
    mimeType,
    clearRecording,
    error,
  } = useAudioRecorder();

  // Fetch the selected list
  const { data: listData, isLoading } = useQuery<ListWithWords>({
    queryKey: ["list-with-words", listId],
    queryFn: async () => {
      if (!listId) throw new Error("No list selected");

      const { data: list, error: listError } = await supabase
        .from("word_lists")
        .select("id, title")
        .eq("id", listId)
        .single();

      if (listError) throw listError;

      const { data: listWords, error: wordsError } = await supabase
        .from("list_words")
        .select("sort_index, words (*)")
        .eq("list_id", listId)
        .order("sort_index", { ascending: true });

      if (wordsError) throw wordsError;

      const words = listWords?.map((lw) => lw.words as Word) || [];

      return {
        ...list,
        words,
      };
    },
    enabled: Boolean(listId),
  });

  /**
   * Mutation to save spelling attempt with audio recording (online or offline).
   *
   * Error Handling Strategy:
   * - Errors are handled centrally via onError handler
   * - User-facing toast notification shown on failure
   * - Game flow continues even if save fails (non-blocking)
   * - No try/catch needed at call sites
   *
   * @see onError handler for error logging and user feedback
   */
  const saveAttemptMutation = useMutation({
    mutationFn: async ({
      wordId,
      correct,
      typedAnswer,
      quality,
      audioBlobId,
    }: {
      wordId: string;
      correct: boolean;
      typedAnswer: string;
      quality: number;
      audioBlobId?: number;
    }) => {
      if (!profile?.id || !listId) return;

      if (isOnline) {
        // Upload audio if it exists
        let audioPath: string | undefined;
        if (audioBlob && profile?.id) {
          const timestamp = Date.now();
          // CRITICAL: Path format must be {child_id}/{list_id}/{word_id}_{timestamp}.webm
          // This format is required by RLS policies: (storage.foldername(name))[1] = child_id
          const fileName = `${profile.id}/${listId}/${wordId}_${timestamp}.webm`;

          const { data, error } = await supabase.storage
            .from("audio-recordings")
            .upload(fileName, audioBlob, {
              contentType: mimeType || "audio/webm", // Use detected MIME type
              cacheControl: String(
                CACHE_CONSTANTS.SIGNED_URL_CACHE_CONTROL_SECONDS
              ),
            });

          if (!error && data) {
            // Store the path, not a URL
            // Signed URLs will be generated on-demand when audio needs to be played
            // Use getSignedAudioUrl() from supa.ts or useAttempts() hook for playback
            audioPath = data.path;
          }
        }

        // Required columns for attempts table:
        // - child_id (uuid, FK to profiles)
        // - word_id (uuid, FK to words)
        // - list_id (uuid, FK to word_lists)
        // - mode (text: 'listen-type' | 'say-spell' | 'flash')
        // - correct (boolean)
        // - quality (integer, 0-5, nullable)
        // - typed_answer (text, nullable)
        // - audio_url (text storage path, nullable)
        // - duration_ms (integer, nullable)
        // - started_at (timestamp)

        // Verify we have an active auth session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          logger.error("No active session for insert:", { sessionError });
          throw new Error(
            "Authentication session expired. Please sign in again."
          );
        }

        // Debug: Log attempt data and auth state
        logger.log("Attempting to save (online):", {
          mode: "say-spell",
          authUser: session.user.id,
          profileId: profile.id,
          match: session.user.id === profile.id,
          wordId,
          listId,
          hasSession: !!session,
        });

        const { error } = await supabase.from("attempts").insert({
          child_id: profile.id,
          word_id: wordId,
          list_id: listId,
          mode: "say-spell",
          correct,
          quality, // Quality score (0-5) based on correctness, first-try, hints
          typed_answer: typedAnswer,
          audio_url: audioPath, // Store path instead of URL
          started_at: new Date().toISOString(),
        });

        if (error) {
          logger.error("INSERT error details:", {
            error,
            authUserId: session.user.id,
            profileId: profile.id,
            wordId,
            listId,
          });
          throw error;
        }

        // Award stars if first-try correct
        if (correct && isFirstAttempt) {
          await awardStars.mutateAsync({
            userId: profile.id,
            amount: 1,
            reason: "correct_word",
          });
        }
      } else {
        // Queue for later sync
        await queueAttempt(
          profile.id,
          wordId,
          listId,
          "say-spell",
          correct,
          typedAnswer,
          audioBlobId
        );

        // Queue star transaction
        if (correct && isFirstAttempt) {
          await queueStarTransaction(profile.id, 1, "correct_word");
        }
      }
    },
    onError: (error) => {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save attempt";

      logger.error("Error saving attempt:", error);
      logger.metrics.errorCaptured({
        context: "PlaySaySpell.saveAttempt",
        message: errorMessage,
        severity: "error",
      });

      // Show user-facing error
      toast.error(
        `Failed to save your answer. Don't worry, you can continue playing!`,
        {
          duration: 6000,
        }
      );
    },
  });

  const isSaving = saveAttemptMutation.isPending;

  const currentWord = listData?.words[currentWordIndex];

  const playWord = useCallback(() => {
    if (!currentWord) return;

    // Cancel any ongoing TTS speech before playing new word
    speechSynthesis.cancel();

    // Wait for voices to load before using TTS
    if (voicesLoading) {
      // Cap retries at TTS_CONSTANTS.MAX_RETRY_COUNT attempts
      if (ttsRetryCountRef.current >= TTS_CONSTANTS.MAX_RETRY_COUNT) {
        logger.warn(
          "TTS voices failed to load after 50 retries, proceeding with default voice"
        );
        // Proceed with default speechSynthesis without explicit voice
        const utterance = new SpeechSynthesisUtterance(currentWord.text);
        speechSynthesis.speak(utterance);
        // Reset retry counter for next word
        ttsRetryCountRef.current = 0;
        return;
      }

      logger.warn(
        `TTS voices still loading, retry ${ttsRetryCountRef.current + 1}/${TTS_CONSTANTS.MAX_RETRY_COUNT}`
      );
      ttsRetryCountRef.current += 1;

      // Track timeout for cleanup
      if (ttsRetryTimeoutRef.current) {
        clearTimeout(ttsRetryTimeoutRef.current);
      }
      ttsRetryTimeoutRef.current = setTimeout(
        () => playWord(),
        TTS_CONSTANTS.RETRY_INTERVAL_MS
      );
      return;
    }

    // Reset retry counter when voices finish loading
    ttsRetryCountRef.current = 0;

    const utterance = new SpeechSynthesisUtterance(currentWord.text);

    // Get voice with fallback - ensures we always have a voice when loaded
    const voice = getVoiceWithFallback(currentWord.tts_voice || undefined);
    if (voice) {
      utterance.voice = voice;
    }
    // If voice is null, browser will use default voice

    speechSynthesis.speak(utterance);
  }, [currentWord, getVoiceWithFallback, voicesLoading]);

  // Auto-play ONCE on word change - only when word ID actually changes
  useEffect(() => {
    if (
      currentWord &&
      step === "record" &&
      currentWord.id !== lastPlayedWordIdRef.current
    ) {
      lastPlayedWordIdRef.current = currentWord.id;
      const timer = setTimeout(() => playWord(), 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [currentWord, step, playWord]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    // Comment 2: Directly check and clear current timeout refs at cleanup time
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
      }
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
      if (ttsRetryTimeoutRef.current) {
        clearTimeout(ttsRetryTimeoutRef.current);
      }
      // Cancel any ongoing TTS
      speechSynthesis.cancel();
    };
  }, []);

  // Handle recording completion
  useEffect(() => {
    // Guard clause: only process when we have a recording blob and we're in record step
    if (!recordedBlob || step !== "record") return;

    logger.debug("[PlaySaySpell] Recording blob received, processing...");
    setAudioBlob(recordedBlob);

    // Queue audio offline
    if (!isOnline) {
      logger.debug("[PlaySaySpell] Queuing audio offline");

      // Comment 3: Guard against undefined IDs when queueing audio offline
      if (!profile?.id || !listId || !currentWord?.id) {
        logger.error("Cannot queue audio: missing required IDs", {
          hasProfileId: !!profile?.id,
          hasListId: !!listId,
          hasWordId: !!currentWord?.id,
        });
        setIsProcessingAudio(false);
        return;
      }

      const timestamp = Date.now();
      // CRITICAL: Path format must match online format for RLS policy compliance
      // Format: {child_id}/{list_id}/{word_id}_{timestamp}.webm
      const fileName = `${profile.id}/${listId}/${currentWord.id}_${timestamp}.webm`;

      // Set processing state before starting queue operation
      setIsProcessingAudio(true);

      // Comment 1: Await queueAudio to ensure audioBlobId is set before transitioning
      queueAudio(recordedBlob, fileName)
        .then((id) => {
          setAudioBlobId(id);
          logger.debug("[PlaySaySpell] Audio queued with ID:", id);
          setIsProcessingAudio(false);
          // Stay on record step - let user listen to recording before typing
          logger.debug("[PlaySaySpell] Audio queued, ready for playback");
        })
        .catch((error) => {
          logger.error("Failed to queue audio", error);
          setIsProcessingAudio(false);
          // Show error toast and stay on record step
          toast.error(
            "Failed to save your recording. Please try recording again.",
            { duration: 5000 }
          );
          // Do NOT transition to type step - user must retry recording
          logger.debug(
            "[PlaySaySpell] Staying on record step due to queue error"
          );
        });
    }
    // Note: We no longer auto-advance to type step - user must click "Continue to Type" button
    // This allows them to listen to their recording first
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordedBlob]);

  /**
   * Initiates audio recording for spelling attempt.
   * Starts recording and sets 15-second auto-stop timer.
   *
   * @remarks
   * - Clears any existing recording timeout
   * - Stores timeout ID in ref for cleanup
   * - Recording stops automatically after 15 seconds
   * - User can also click "Stop Recording" to end early
   */
  const handleStartRecording = useCallback(async () => {
    // Clear any existing recording timeout
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }

    logger.debug(
      `[PlaySaySpell] Starting recording, will auto-stop in ${RECORDING_CONSTANTS.AUTO_STOP_DURATION_MS / 1000} seconds`
    );
    await startRecording();

    // Store timeout ID for cleanup
    recordingTimeoutRef.current = setTimeout(() => {
      logger.debug(
        `[PlaySaySpell] Auto-stopping recording after ${RECORDING_CONSTANTS.AUTO_STOP_DURATION_MS / 1000} seconds`
      );
      stopRecording();
    }, RECORDING_CONSTANTS.AUTO_STOP_DURATION_MS);
  }, [startRecording, stopRecording]);

  /**
   * Normalizes user input for comparison with correct answer.
   * Uses centralized normalization from utils.ts to ensure consistency across game modes.
   *
   * @see {@link normalizeSpellingAnswer} in src/lib/utils.ts for full documentation
   */
  const normalizeAnswer = useCallback(
    (text: string) => {
      // Normalizes answer per parental settings, preserving hyphens/apostrophes for compound words by default
      return normalizeSpellingAnswer(text, {
        enforceCaseSensitivity,
        ignorePunctuation,
      });
    },
    [enforceCaseSensitivity, ignorePunctuation]
  );

  /**
   * Advances to next word or completes session.
   * Resets both recording and typing state.
   *
   * @remarks
   * State Reset:
   * - Clears recording (audio blob, recording status)
   * - Resets to record step
   * - Clears answer input
   * - Resets feedback and hints
   * - Resets first attempt flag
   * - Clears all timeouts
   *
   * Two-Step Reset:
   * Unlike Listen & Type, this mode must reset both:
   * 1. Recording step state (audio, recording status)
   * 2. Typing step state (answer, feedback, hints)
   */
  const nextWord = useCallback(() => {
    if (!listData) return;

    // Clear any pending timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (confettiTimeoutRef.current) {
      clearTimeout(confettiTimeoutRef.current);
      confettiTimeoutRef.current = null;
    }
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }

    // Cancel any ongoing TTS
    speechSynthesis.cancel();

    // Reset last played word ID so new word will auto-play
    lastPlayedWordIdRef.current = null;

    // Compute next index
    const nextIndex = currentWordIndex + 1;
    logger.debug(
      `[PlaySaySpell] Advancing from word ${currentWordIndex} to ${nextIndex} of ${listData.words.length}`
    );

    if (nextIndex >= listData.words.length) {
      // Completed all words - navigate without updating state
      logger.debug("[PlaySaySpell] All words complete, navigating to rewards");
      navigate("/child/rewards");
      return;
    }

    // Always start at record step for new word
    // Move to next word - update index and reset local state
    logger.debug("[PlaySaySpell] Clearing recording state for next word");
    setCurrentWordIndex((prev) => prev + 1);
    setStep("record");
    setAnswer("");
    setFeedback(null);
    setShowHint(0);
    setIsFirstAttempt(true);
    setAudioBlob(null);
    setAudioBlobId(null);
    clearRecording();
  }, [listData, currentWordIndex, navigate, clearRecording]);

  /**
   * Validates user's typed spelling and updates game state.
   * Similar to Listen & Type mode but includes audio recording.
   *
   * @remarks
   * Correct Answer Flow:
   * 1. Set feedback to "correct"
   * 2. Show confetti animation
   * 3. Award star if first attempt
   * 4. Save attempt with audio blob ID
   * 5. Update SRS with success
   * 6. Schedule auto-advance (configured delay, default 3 seconds)
   *
   * Incorrect Answer Flow:
   * 1. Set feedback to "wrong"
   * 2. Mark as not first attempt
   * 3. Save attempt with audio blob ID
   * 4. Update SRS with miss (first miss only)
   * 5. Show progressive hints
   *
   * Audio Handling:
   * - Includes audioBlobId in attempt record
   * - Links typed answer to recorded audio
   * - Enables playback review in parent dashboard
   */
  const checkAnswer = useCallback(async () => {
    if (!currentWord || !profile?.id) return;

    // Ensure we have audio blob ID to link with attempt
    // Comment 1: Guard when offline - ensure audioBlobId is set before checking
    if (!isOnline && !audioBlobId) {
      logger.error("Cannot check answer offline: audio not yet queued");
      toast.error("Please wait for recording to finish processing", {
        duration: 4000,
      });
      return;
    }

    const normalizedAnswer = normalizeAnswer(answer);
    const normalizedCorrect = normalizeAnswer(currentWord.text);
    const correct = normalizedAnswer === normalizedCorrect;

    // Calculate quality score: correctness + first attempt + hint usage
    // Calculate quality score (0-5)
    const usedHint = showHint > 0;
    const quality = computeAttemptQuality(correct, isFirstAttempt, usedHint);

    if (correct) {
      setFeedback("correct");
      setShowConfetti(true);

      // Clear any existing confetti timeout before setting a new one
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
      }
      confettiTimeoutRef.current = setTimeout(
        () => setShowConfetti(false),
        UI_CONSTANTS.CONFETTI_DURATION_MS
      );

      if (isFirstAttempt) {
        setStarsEarned((prev) => prev + 1);
      }

      // Save attempt with quality (errors handled by mutation's onError)
      await saveAttemptMutation.mutateAsync({
        wordId: currentWord.id,
        correct: true,
        typedAnswer: answer,
        quality,
        audioBlobId: audioBlobId || undefined,
      });

      // Update spaced repetition algorithm based on performance
      // Update SRS: first-try correct
      if (isOnline) {
        updateSrs.mutate({
          childId: profile.id,
          wordId: currentWord.id,
          isCorrectFirstTry: isFirstAttempt,
        });
      } else {
        await queueSrsUpdate(profile.id, currentWord.id, isFirstAttempt);
      }

      // Move to next word after configured delay (default 3 seconds, configurable in parental settings)
      logger.debug(
        `[PlaySaySpell] Answer correct, scheduling nextWord in ${autoAdvanceDelaySeconds}s`
      );
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        nextWord();
      }, autoAdvanceDelayMs);
    } else {
      setFeedback("wrong");
      setIsFirstAttempt(false);

      // Save incorrect attempt with quality (errors handled by mutation's onError)
      await saveAttemptMutation.mutateAsync({
        wordId: currentWord.id,
        correct: false,
        typedAnswer: answer,
        quality,
        audioBlobId: audioBlobId || undefined,
      });

      // Update SRS: not first-try correct (miss)
      if (isOnline && isFirstAttempt) {
        // Only update SRS on first miss, not subsequent retries
        updateSrs.mutate({
          childId: profile.id,
          wordId: currentWord.id,
          isCorrectFirstTry: false,
        });
      } else if (!isOnline && isFirstAttempt) {
        await queueSrsUpdate(profile.id, currentWord.id, false);
      }

      // Show hint progressively
      if (showHint === 0) {
        setShowHint(1);
      } else {
        setShowHint(2);
      }
    }
  }, [
    currentWord,
    profile,
    answer,
    isFirstAttempt,
    showHint,
    audioBlobId,
    saveAttemptMutation,
    isOnline,
    updateSrs,
    nextWord,
    normalizeAnswer,
    autoAdvanceDelayMs,
    autoAdvanceDelaySeconds,
  ]);

  const retry = useCallback(() => {
    setAnswer("");
    setFeedback(null);
  }, []);

  const handleContinueToType = useCallback(() => {
    logger.debug("[PlaySaySpell] User clicked continue to type");
    setStep("type");
  }, []);

  const redoRecording = useCallback(() => {
    logger.debug("[PlaySaySpell] User requested re-record");
    // Clear any pending recording timeout
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    setStep("record");
    setAudioBlob(null);
    setAudioBlobId(null);
    clearRecording();
  }, [clearRecording]);

  if (!listId) {
    return <NoListSelected />;
  }

  if (isLoading || !listData) {
    return <LoadingState />;
  }

  return (
    <AppShell title="Say & Spell" variant="child">
      <GameContent
        listData={listData}
        currentWordIndex={currentWordIndex}
        starsEarned={starsEarned}
        step={step}
        playWord={playWord}
        handleStartRecording={handleStartRecording}
        isRecording={isRecording}
        audioBlob={audioBlob}
        audioUrl={recordedAudioUrl}
        error={error}
        answer={answer}
        setAnswer={setAnswer}
        checkAnswer={checkAnswer}
        feedback={feedback}
        showHint={showHint}
        currentWord={currentWord}
        redoRecording={redoRecording}
        retry={retry}
        nextWord={nextWord}
        showConfetti={showConfetti}
        isOnline={isOnline}
        audioBlobId={audioBlobId}
        clearRecording={clearRecording}
        isSaving={isSaving}
        isProcessingAudio={isProcessingAudio}
        stopRecording={stopRecording}
        onContinueToType={handleContinueToType}
        ignorePunctuation={ignorePunctuation}
      />
    </AppShell>
  );
}
