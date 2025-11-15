import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import { RewardStar } from "@/app/components/RewardStar";
import { VisuallyHidden } from "@/app/components/VisuallyHidden";
import { Volume2, CheckCircle, XCircle, Home } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/app/supabase";
import { useAuth } from "@/app/hooks/useAuth";
import { useOnline } from "@/app/hooks/useOnline";
import { useTtsVoices } from "@/app/hooks/useTtsVoices";
import { useParentalSettingsStore } from "@/app/store/parentalSettings";
import { useSessionStore } from "@/app/store/session";
import { queueAttempt } from "@/lib/sync";
import { logger } from "@/lib/logger";
import { toast } from "react-hot-toast";
import { normalizeSpellingAnswer, getHintText } from "@/lib/utils";
import { TTS_CONSTANTS, UI_CONSTANTS } from "@/lib/constants";
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

interface AnswerSectionProps {
  answer: string;
  feedback: "correct" | "wrong" | null;
  showHint: number;
  currentWord: Word | undefined;
  showConfetti: boolean;
  onAnswerChange: (value: string) => void;
  onCheckAnswer: () => void;
  onRetry: () => void;
  onNextWord: () => void;
  isSaving: boolean;
  ignorePunctuation: boolean;
}

interface GameHeaderProps {
  starsEarned: number;
}

interface ProgressDisplayProps {
  listTitle: string;
  currentWordIndex: number;
  totalWords: number;
}

interface GameContentProps {
  starsEarned: number;
  listTitle: string;
  currentWordIndex: number;
  totalWords: number;
  playAudio: () => void;
  answer: string;
  feedback: "correct" | "wrong" | null;
  showHint: number;
  currentWord: Word | undefined;
  showConfetti: boolean;
  onAnswerChange: (value: string) => void;
  onCheckAnswer: () => void;
  onRetry: () => void;
  onNextWord: () => void;
  isSaving: boolean;
  ignorePunctuation: boolean;
}

interface PlayWordButtonProps {
  playAudio: () => void;
  currentWord?: Word;
}

function PlayWordButton({ playAudio, currentWord }: PlayWordButtonProps) {
  return (
    <div>
      <p className="text-2xl text-muted-foreground mb-6">
        Listen to the word and type it below
      </p>
      <Button
        onClick={playAudio}
        size="child"
        className="w-64 flex items-center justify-center gap-3"
        aria-label={
          currentWord ? `Play word: ${currentWord.text}` : "Play word"
        }
      >
        <Volume2 size={32} />
        <span>Play Word</span>
      </Button>
    </div>
  );
}

function ListSelector() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const lastErrorRef = useRef<string | null>(null);

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
          context: "PlayListenType.loadLists",
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

  const handleSelectList = useCallback(
    (listId: string) => {
      navigate(`?listId=${listId}`);
    },
    [navigate],
  );

  if (error) {
    return (
      <Card variant="child" role="alert" aria-live="assertive">
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
            <Link to="/child/home">
              <Button size="child" variant="outline">
                Go to Home
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  if (listsLoading) {
    return (
      <Card variant="child">
        <div className="text-center" aria-live="polite">
          <p className="text-2xl">Loading lists...</p>
        </div>
      </Card>
    );
  }

  if (!lists || lists.length === 0) {
    return (
      <Card variant="child">
        <div className="text-center space-y-6">
          <h3 className="text-3xl font-bold">No Lists Available</h3>
          <p className="text-xl text-muted-foreground">
            Ask your parent to create some spelling lists first!
          </p>
          <Link to="/child/home">
            <Button size="child">Go to Home</Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-3xl font-bold mb-4">Choose a list to practice</h3>
        <p className="text-xl text-muted-foreground">
          Pick a list to start practicing!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {lists.map((list) => (
          <Card
            key={list.id}
            variant="child"
            role="button"
            tabIndex={0}
            aria-label={`Practice ${list.title}, ${list.word_count} words`}
            onClick={() => handleSelectList(list.id)}
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
        ))}
      </div>

      <div className="text-center">
        <Link to="/child/home">
          <Button size="child" variant="outline">
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}

function LoadingDisplay() {
  return (
    <div className="max-w-3xl mx-auto">
      <Card variant="child">
        <p className="text-2xl text-center">Loading...</p>
      </Card>
    </div>
  );
}

function GameHeader({ starsEarned }: GameHeaderProps) {
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

function ProgressDisplay({
  listTitle,
  currentWordIndex,
  totalWords,
}: ProgressDisplayProps) {
  return (
    <div className="text-center" aria-live="polite" aria-atomic="true">
      <p className="text-2xl font-bold">{listTitle}</p>
      <p className="text-xl text-muted-foreground mt-2">
        Word {currentWordIndex + 1} of {totalWords}
      </p>
    </div>
  );
}

/**
 * Answer input and feedback section for Listen & Type game.
 * Handles user input, hint display, and action buttons (Check/Retry/Next).
 *
 * Features:
 * - Auto-focus on input when ready
 * - Enter key to submit answer
 * - Progressive hints (first letter → full word)
 * - Loading states during save operations
 * - Confetti animation on correct answer
 */
function AnswerSection({
  answer,
  feedback,
  showHint,
  currentWord,
  showConfetti,
  onAnswerChange,
  onCheckAnswer,
  onRetry,
  onNextWord,
  isSaving,
  ignorePunctuation,
}: AnswerSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onAnswerChange(e.target.value);
    },
    [onAnswerChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (
        e.key === "Enter" &&
        answer.trim() &&
        feedback === null &&
        !isSaving
      ) {
        onCheckAnswer();
      }
    },
    [answer, feedback, onCheckAnswer, isSaving],
  );

  // Auto-focus input on mount and when feedback resets
  useEffect(() => {
    if (feedback === null && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentWord, feedback]);

  return (
    <div className="space-y-4">
      <VisuallyHidden as="label" htmlFor="spelling-input">
        Type the spelling of the word you heard
      </VisuallyHidden>
      <input
        ref={inputRef}
        id="spelling-input"
        type="text"
        value={answer}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={`w-full text-4xl text-center px-6 py-4 border-4 border-primary rounded-2xl focus:ring-4 focus:ring-ring focus:border-primary font-bold bg-input ${isSaving ? "opacity-50" : ""}`}
        placeholder="Type here..."
        disabled={feedback === "correct" || isSaving}
        aria-describedby={showHint > 0 ? "hint-text" : undefined}
      />

      {/* Hints */}
      {showHint > 0 && feedback === "wrong" && (
        <div className="text-center" id="hint-text">
          {showHint === 1 && (
            <p className="text-2xl text-secondary">
              Hint: &quot;
              {getHintText(currentWord?.text || "", ignorePunctuation)}&quot;
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
        <Button
          onClick={onCheckAnswer}
          size="child"
          className="w-full"
          disabled={!answer.trim() || isSaving}
        >
          {isSaving ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              Saving...
            </span>
          ) : (
            "Check Answer"
          )}
        </Button>
      )}

      {feedback === "correct" && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3 text-secondary">
            <CheckCircle size={48} />
            <p className="text-4xl font-bold">Correct! 🎉</p>
          </div>
          {showConfetti && <div className="text-6xl animate-bounce">⭐</div>}
          <Button
            onClick={onNextWord}
            size="child"
            className="w-full"
            disabled={isSaving}
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span>
                Saving...
              </span>
            ) : (
              "Next Word →"
            )}
          </Button>
        </div>
      )}

      {feedback === "wrong" && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3 text-accent">
            <XCircle size={48} />
            <p className="text-4xl font-bold">Try Again!</p>
          </div>
          {showHint < 2 ? (
            <Button onClick={onRetry} size="child" className="w-full">
              Retry
            </Button>
          ) : (
            <Button onClick={onNextWord} size="child" className="w-full">
              Next Word
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function GameContent({
  starsEarned,
  listTitle,
  currentWordIndex,
  totalWords,
  playAudio,
  answer,
  feedback,
  showHint,
  currentWord,
  showConfetti,
  onAnswerChange,
  onCheckAnswer,
  onRetry,
  onNextWord,
  isSaving,
  ignorePunctuation,
}: GameContentProps) {
  const { profile } = useAuth();

  return (
    <div className="max-w-3xl mx-auto space-y-8 relative">
      {/* Live region for feedback announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {feedback === "correct" && "Correct! Well done!"}
        {feedback === "wrong" && showHint === 0 && "Incorrect. Try again."}
        {feedback === "wrong" &&
          showHint === 1 &&
          `Hint: ${getHintText(currentWord?.text || "", ignorePunctuation)}`}
        {feedback === "wrong" &&
          showHint === 2 &&
          `The correct spelling is ${currentWord?.text}`}
      </div>

      {/* Equipped avatar and streak display in corner */}
      <div className="absolute top-4 right-4 flex items-center gap-3">
        {profile?.equipped_avatar && (
          <div className="text-5xl" aria-hidden="true">
            {profile.equipped_avatar}
          </div>
        )}
        {(profile?.streak_days || 0) > 0 && (
          <div
            className="flex items-center gap-1 bg-primary/20 px-3 py-2 rounded-full"
            aria-hidden="true"
          >
            <span className="text-3xl">🔥</span>
            <span className="text-2xl font-bold">{profile?.streak_days}</span>
          </div>
        )}
      </div>

      <GameHeader starsEarned={starsEarned} />

      <ProgressDisplay
        listTitle={listTitle}
        currentWordIndex={currentWordIndex}
        totalWords={totalWords}
      />

      <Card variant="child">
        <div className="text-center space-y-8">
          <PlayWordButton playAudio={playAudio} currentWord={currentWord} />

          <AnswerSection
            answer={answer}
            feedback={feedback}
            showHint={showHint}
            currentWord={currentWord}
            showConfetti={showConfetti}
            onAnswerChange={onAnswerChange}
            onCheckAnswer={onCheckAnswer}
            onRetry={onRetry}
            onNextWord={onNextWord}
            isSaving={isSaving}
            ignorePunctuation={ignorePunctuation}
          />
        </div>
      </Card>
    </div>
  );
}

/**
 * Listen & Type Game Mode
 *
 * Children hear a word (via recorded audio or TTS) and type the spelling.
 * Features progressive hints, star rewards, and spaced repetition tracking.
 *
 * Game Flow:
 * 1. User selects a spelling list (or continues from URL param)
 * 2. Word is played automatically on load
 * 3. User types their answer
 * 4. Answer is checked and feedback provided
 * 5. Correct: auto-advance after 5s (or click Next)
 * 6. Incorrect: show hints and allow retry
 * 7. After all words: navigate to rewards page
 *
 * Offline Support:
 * - Attempts queued in IndexedDB
 * - SRS updates queued for sync
 * - Star awards queued for sync
 * - Game continues seamlessly offline
 *
 * Accessibility:
 * - Auto-focus on input field
 * - Live regions announce feedback
 * - Keyboard navigation (Enter to submit)
 * - Screen reader labels on all controls
 */
export function PlayListenType() {
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

  const [currentWordIndex, setCurrentWordIndex] = useState(0); // Index in words array (0-based)
  const [answer, setAnswer] = useState(""); // User's typed input
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null); // Answer validation result
  const [showHint, setShowHint] = useState(0); // Hint level: 0=none, 1=first letter, 2=full word
  const [starsEarned, setStarsEarned] = useState(0); // Stars earned this session (max 5 per session)
  const [isFirstAttempt, setIsFirstAttempt] = useState(true); // True until first wrong answer
  const [showConfetti, setShowConfetti] = useState(false); // Confetti animation trigger
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null); // Audio URL for controlled audio element

  // Refs for timeout cleanup
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const confettiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const ttsRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const ttsRetryCountRef = useRef<number>(0);

  // Refs for audio cleanup - prevents multiple simultaneous audio playback
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedWordIdRef = useRef<string | null>(null);
  const isMountedRef = useRef<boolean>(true);

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

  // Fetch the selected list or show list selector
  const {
    data: listData,
    isLoading,
    error: listError,
  } = useQuery<ListWithWords>({
    queryKey: ["list-with-words", listId],
    queryFn: async () => {
      if (!listId) throw new Error("No list selected");

      logger.debug("[PlayListenType] Fetching list:", { listId });

      const { data: list, error: listError } = await supabase
        .from("word_lists")
        .select("id, title")
        .eq("id", listId)
        .single();

      if (listError) {
        logger.error("[PlayListenType] Error fetching word list:", listError);
        throw listError;
      }

      logger.debug("[PlayListenType] List fetched:", { list });

      const { data: listWords, error: wordsError } = await supabase
        .from("list_words")
        .select("sort_index, words (*)")
        .eq("list_id", listId)
        .order("sort_index", { ascending: true });

      if (wordsError) {
        logger.error("[PlayListenType] Error fetching list words:", wordsError);
        throw wordsError;
      }

      logger.debug("[PlayListenType] List words fetched:", {
        count: listWords?.length,
      });

      const words = listWords?.map((lw) => lw.words as Word) || [];

      // CRITICAL FIX: Generate signed URLs for prompt audio (private bucket)
      // Import getSignedPromptAudioUrls from supa.ts for batch signed URL generation
      const { getSignedPromptAudioUrls } = await import("@/app/api/supa");

      const pathsToSign = words
        .filter((w): w is typeof w & { prompt_audio_path: string } =>
          Boolean(w.prompt_audio_path),
        )
        .map((w) => w.prompt_audio_path);

      const signedUrlMap =
        pathsToSign.length > 0
          ? await getSignedPromptAudioUrls(pathsToSign)
          : {};

      // Add signed URLs to words
      const wordsWithSignedUrls = words.map((word) => {
        if (word.prompt_audio_path && signedUrlMap[word.prompt_audio_path]) {
          return {
            ...word,
            prompt_audio_url: signedUrlMap[word.prompt_audio_path],
          };
        }
        return word;
      });

      return {
        ...list,
        words: wordsWithSignedUrls,
      };
    },
    enabled: Boolean(listId),
    retry: 2,
    retryDelay: 1000,
    staleTime: 1000 * 60 * 5,
  });

  /**
   * Mutation to save spelling attempt (online or offline).
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
    }: {
      wordId: string;
      correct: boolean;
      typedAnswer: string;
      quality: number;
    }) => {
      if (!profile?.id || !listId) {
        logger.warn("Cannot save attempt: missing profile or listId", {
          hasProfile: Boolean(profile?.id),
          hasListId: Boolean(listId),
        });
        return;
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

      if (isOnline) {
        // Online: save directly to Supabase
        // Verify we have an active auth session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          logger.error("No active session for insert:", { sessionError });
          throw new Error(
            "Authentication session expired. Please sign in again.",
          );
        }

        // CRITICAL: Use session.user.id (not profile.id) to match auth.uid() in RLS policy
        const attemptData = {
          child_id: session.user.id, // Must match auth.uid() in RLS policy
          word_id: wordId,
          list_id: listId,
          mode: "listen-type" as const,
          correct,
          quality, // Quality score (0-5) based on correctness, first-try, hints
          typed_answer: typedAnswer,
          started_at: new Date().toISOString(),
        };

        // Debug: Log attempt data and auth state
        logger.debug("Attempting to save (online):", {
          attemptData,
          authUser: session.user.id,
          profileId: profile.id,
          match: session.user.id === profile.id,
          hasSession: Boolean(session),
        });

        const { data, error } = await supabase
          .from("attempts")
          .insert(attemptData)
          .select();
        if (error) {
          logger.error("INSERT error details:", {
            error,
            errorCode: error.code,
            errorMessage: error.message,
            errorDetails: error.details,
            attemptData,
            authUserId: session.user.id,
            profileId: profile.id,
          });
          throw error;
        }

        logger.debug("Attempt saved successfully:", {
          insertedId: data?.[0]?.id,
        });

        // Award stars if first-try correct
        if (correct && isFirstAttempt) {
          try {
            await awardStars.mutateAsync({
              userId: profile.id,
              amount: 1,
              reason: "correct_word",
            });
          } catch (starError) {
            // Log but don't block on star award failure
            logger.warn("Failed to award stars, continuing:", starError);
          }
        }

        return data;
      } else {
        // Offline: queue in IndexedDB for background sync when connection restored
        logger.debug("Queueing attempt offline:", { wordId, listId });

        // CRITICAL FIX: Always use profile.id for consistency
        // During offline mode, we must use the profile ID that was loaded during authentication
        // This ensures the queued attempt uses the same ID that will match auth.uid() when synced
        // The profile.id is set from auth.uid() during initial authentication (see useAuth.ts)
        const userId = profile.id;

        await queueAttempt(
          userId, // Use profile.id which matches auth.uid() from initial auth
          wordId,
          listId,
          "listen-type",
          correct,
          typedAnswer,
        );

        // Queue star transaction
        if (correct && isFirstAttempt) {
          await queueStarTransaction(userId, 1, "correct_word");
        }
      }
    },
    onSuccess: (data) => {
      logger.debug("SaveAttemptMutation completed successfully", { data });
    },
    onError: (error) => {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save attempt";

      logger.error("Error saving attempt:", error);
      logger.metrics.errorCaptured({
        context: "PlayListenType.saveAttempt",
        message: errorMessage,
        severity: "error",
      });

      // Show user-facing error
      toast.error(
        "Failed to save your answer. Don't worry, you can continue playing!",
        {
          duration: 6000,
        },
      );
    },
    onSettled: () => {
      logger.debug("SaveAttemptMutation settled (completed or errored)");
    },
  });

  const isSaving = saveAttemptMutation.isPending;

  const currentWord = listData?.words[currentWordIndex];

  /**
   * Plays audio pronunciation for the current word.
   * Uses recorded audio if available, otherwise falls back to text-to-speech.
   * Handles voice loading delays, provides fallback voice selection, and handles autoplay blocking.
   *
   * @remarks
   * - Checks for prompt_audio_url first (recorded pronunciation)
   * - Falls back to browser TTS with voice selection
   * - Retries up to 50 times (5 seconds) if voices are loading
   * - Uses getVoiceWithFallback to ensure a voice is always available
   * - Falls back to default speechSynthesis without explicit voice if cap reached
   * - Handles autoplay blocking by prompting user to tap Play button
   * - Stops any previous audio before playing new audio
   */
  const playAudio = useCallback(() => {
    if (!currentWord) {
      return;
    }

    // Stop any previous audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Cancel any ongoing TTS speech
    speechSynthesis.cancel();

    if (currentWord.prompt_audio_url) {
      // Update state to trigger audio element src change
      setCurrentAudioUrl(currentWord.prompt_audio_url);

      // Wait for audio element to be ready, then play
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().catch((error) => {
            // Autoplay was blocked by the browser
            logger.warn("Audio autoplay blocked by browser", error);

            // Show a friendly toast prompting the user to tap Play
            toast("👆 Tap the Play button to hear the word", {
              duration: 3000,
              icon: "🔊",
            });
          });
        }
      }, 100);

      // Reset retry counter when successfully playing audio
      ttsRetryCountRef.current = 0;
    } else {
      // Wait for voices to load before using TTS
      if (voicesLoading) {
        // Cap retries at TTS_CONSTANTS.MAX_RETRY_COUNT attempts
        if (ttsRetryCountRef.current >= TTS_CONSTANTS.MAX_RETRY_COUNT) {
          logger.warn(
            "TTS voices failed to load after 50 retries, proceeding with default voice",
          );
          // Proceed with default speechSynthesis without explicit voice
          const utterance = new SpeechSynthesisUtterance(currentWord.text);

          // Add error handler for TTS failures
          utterance.onerror = (event) => {
            logger.warn("TTS error on default voice fallback", event);
            toast("👆 Tap the Play button to hear the word", {
              duration: 3000,
              icon: "🔊",
            });
          };

          speechSynthesis.speak(utterance);
          // Reset retry counter for next word
          ttsRetryCountRef.current = 0;
          return;
        }

        logger.warn(
          `TTS voices still loading, retry ${ttsRetryCountRef.current + 1}/${TTS_CONSTANTS.MAX_RETRY_COUNT}`,
        );
        ttsRetryCountRef.current += 1;

        // Check if component is still mounted before scheduling retry
        if (!isMountedRef.current) {
          logger.debug("TTS retry cancelled: component unmounted");
          return;
        }

        // Track timeout for cleanup
        if (ttsRetryTimeoutRef.current) {
          clearTimeout(ttsRetryTimeoutRef.current);
        }
        ttsRetryTimeoutRef.current = setTimeout(
          () => playAudio(),
          TTS_CONSTANTS.RETRY_INTERVAL_MS,
        );
        return;
      }

      // Reset retry counter when voices finish loading
      ttsRetryCountRef.current = 0;

      // Use speech synthesis with fallback voice selection
      const utterance = new SpeechSynthesisUtterance(currentWord.text);

      // Get voice with fallback - ensures we always have a voice when loaded
      const voice = getVoiceWithFallback(currentWord.tts_voice || undefined);
      if (voice) {
        utterance.voice = voice;
      }
      // If voice is null, browser will use default voice

      // Add error handler for TTS failures
      utterance.onerror = (event) => {
        logger.warn("TTS error on selected voice", event);
        toast("👆 Tap the Play button to hear the word", {
          duration: 3000,
          icon: "🔊",
        });
      };

      speechSynthesis.speak(utterance);
    }
  }, [currentWord, getVoiceWithFallback, voicesLoading]);

  // Auto-play ONCE on word change - only when word ID changes
  useEffect(() => {
    if (currentWord && currentWord.id !== lastPlayedWordIdRef.current) {
      lastPlayedWordIdRef.current = currentWord.id;
      const timer = setTimeout(() => playAudio(), 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [currentWord, playAudio]);

  // Cleanup timeouts and audio on unmount
  useEffect(() => {
    return () => {
      // Mark component as unmounted to prevent state updates
      isMountedRef.current = false;

      // Clear audio URL
      setCurrentAudioUrl(null);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
        confettiTimeoutRef.current = null;
      }
      if (ttsRetryTimeoutRef.current) {
        clearTimeout(ttsRetryTimeoutRef.current);
        ttsRetryTimeoutRef.current = null;
      }
      // Stop any playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      // Cancel any ongoing TTS
      speechSynthesis.cancel();
    };
  }, []);

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
    [enforceCaseSensitivity, ignorePunctuation],
  );

  /**
   * Advances to the next word in the list or completes the session.
   * Cleans up timeouts, updates word index, and resets answer state.
   *
   * @remarks
   * Game Flow:
   * 1. Clear any pending timeouts (auto-advance, confetti)
   * 2. Check if more words remain
   * 3. If complete: navigate to rewards page
   * 4. If not complete: increment index and reset state
   *
   * State Reset:
   * - Clears answer input
   * - Resets feedback to null
   * - Resets hint level to 0
   * - Resets first attempt flag
   */
  const nextWord = useCallback(() => {
    if (!listData) {
      return;
    }

    // Clear any pending timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (confettiTimeoutRef.current) {
      clearTimeout(confettiTimeoutRef.current);
      confettiTimeoutRef.current = null;
    }

    // Stop any playing audio before moving to next word
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Cancel any ongoing TTS
    speechSynthesis.cancel();

    // Reset last played word ID so new word will auto-play
    lastPlayedWordIdRef.current = null;

    // Use functional state update to avoid stale closure issues
    // Compute next index
    const nextIndex = currentWordIndex + 1;
    logger.debug(
      `[PlayListenType] Advancing from word ${currentWordIndex} to ${nextIndex} of ${listData.words.length}`,
    );

    // Check completion before updating state to avoid unnecessary renders
    if (nextIndex >= listData.words.length) {
      // Completed all words - navigate without updating state
      logger.debug(
        "[PlayListenType] All words complete, navigating to rewards",
      );
      navigate("/child/rewards");
      return;
    }

    // Move to next word - update index and reset local state
    setCurrentWordIndex((prev) => prev + 1);
    setAnswer("");
    setFeedback(null);
    setShowHint(0);
    setIsFirstAttempt(true);
  }, [listData, currentWordIndex, navigate]);

  const retry = () => {
    setAnswer("");
    setFeedback(null);
  };

  /**
   * Validates user's spelling attempt and updates game state accordingly.
   * Handles scoring, SRS updates, star awards, and progression logic.
   *
   * @remarks
   * Correct Answer Flow:
   * 1. Set feedback to "correct"
   * 2. Show confetti animation (2 seconds)
   * 3. Award star if first attempt
   * 4. Save attempt to database (async, non-blocking)
   * 5. Update SRS with success (async, non-blocking)
   * 6. Schedule auto-advance to next word (configured delay, default 3 seconds)
   *
   * Incorrect Answer Flow:
   * 1. Set feedback to "wrong"
   * 2. Mark as not first attempt
   * 3. Save attempt to database (async, non-blocking)
   * 4. Update SRS with miss (async, non-blocking, first miss only)
   * 5. Show progressive hints (first letter → full word)
   *
   * Quality Scoring:
   * - Perfect (5): Correct on first try, no hints
   * - Good (4): Correct on first try with hint
   * - Fair (3): Correct on retry, no hints
   * - Poor (2): Correct on retry with hint
   * - Fail (0-1): Incorrect
   *
   * Offline Handling:
   * - Attempts queued in IndexedDB when offline
   * - SRS updates queued for later sync
   * - Star transactions queued for later sync
   */
  const checkAnswer = useCallback(() => {
    if (!currentWord || !profile?.id) return;

    const normalizedAnswer = normalizeAnswer(answer);
    const normalizedCorrect = normalizeAnswer(currentWord.text);
    const correct = normalizedAnswer === normalizedCorrect;

    // Calculate quality score based on correctness, first attempt, and hint usage
    const usedHint = showHint > 0;
    const quality = computeAttemptQuality(correct, isFirstAttempt, usedHint);

    if (correct) {
      // Correct answer path: award stars, save attempt, update SRS, auto-advance
      setFeedback("correct");
      setShowConfetti(true);

      // Clear any existing confetti timeout before setting a new one
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
      }
      confettiTimeoutRef.current = setTimeout(
        () => setShowConfetti(false),
        UI_CONSTANTS.CONFETTI_DURATION_MS,
      );

      if (isFirstAttempt) {
        setStarsEarned((prev) => prev + 1);
      }

      // Save attempt with quality (errors handled by mutation's onError)
      // Use mutate instead of mutateAsync - game continues even if save fails
      saveAttemptMutation.mutate({
        wordId: currentWord.id,
        correct: true,
        typedAnswer: answer,
        quality,
      });

      // Update SRS algorithm: correct first-try improves retention, retries don't
      // Update SRS: first-try correct (async, don't block UI)
      if (isOnline) {
        updateSrs.mutate({
          childId: profile.id,
          wordId: currentWord.id,
          isCorrectFirstTry: isFirstAttempt,
        });
      } else {
        queueSrsUpdate(profile.id, currentWord.id, isFirstAttempt);
      }

      // Auto-advance after configured delay (default 3 seconds, configurable in parental settings)
      // User can also click "Next Word" button to proceed immediately
      logger.debug(
        `[PlayListenType] Answer correct, scheduling auto-advance in ${autoAdvanceDelaySeconds}s`,
      );
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        nextWord();
      }, autoAdvanceDelayMs);
    } else {
      // Incorrect answer path: save attempt, update SRS on first miss, show hints
      setFeedback("wrong");
      setIsFirstAttempt(false);

      // Save incorrect attempt with quality (errors handled by mutation's onError)
      // Use mutate instead of mutateAsync - game continues even if save fails
      saveAttemptMutation.mutate({
        wordId: currentWord.id,
        correct: false,
        typedAnswer: answer,
        quality,
      });

      // Only update SRS on first miss to avoid over-penalizing retries
      // Update SRS: not first-try correct (miss) (async, don't block UI)
      if (isOnline && isFirstAttempt) {
        // Only update SRS on first miss, not subsequent retries
        updateSrs.mutate({
          childId: profile.id,
          wordId: currentWord.id,
          isCorrectFirstTry: false,
        });
      } else if (!isOnline && isFirstAttempt) {
        queueSrsUpdate(profile.id, currentWord.id, false);
      }

      // Progressive hint system: first letter → full word
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
    saveAttemptMutation,
    isOnline,
    updateSrs,
    nextWord,
    normalizeAnswer,
    autoAdvanceDelayMs,
    autoAdvanceDelaySeconds,
  ]);

  if (!listId) {
    return (
      <AppShell title="Listen & Type" variant="child">
        <div className="max-w-3xl mx-auto space-y-8">
          <ListSelector />
        </div>
      </AppShell>
    );
  }

  if (listError) {
    return (
      <AppShell title="Listen & Type" variant="child">
        <div className="max-w-3xl mx-auto">
          <Card variant="child">
            <div className="text-center space-y-6">
              <h3 className="text-3xl font-bold text-destructive">
                Error Loading List
              </h3>
              <p className="text-xl text-muted-foreground">
                {listError instanceof Error
                  ? listError.message
                  : "Failed to load the word list"}
              </p>
              <div className="flex flex-col gap-4">
                <Button size="child" onClick={() => window.location.reload()}>
                  Try Again
                </Button>
                <Link to="/child/home">
                  <Button size="child" variant="outline">
                    Go to Home
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  if (isLoading || !listData) {
    return (
      <AppShell title="Listen & Type" variant="child">
        <div className="max-w-3xl mx-auto">
          <LoadingDisplay />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Listen & Type" variant="child">
      {/* Hidden audio element with track for accessibility (JS-0754) */}
      <audio
        ref={audioRef}
        src={currentAudioUrl || ""}
        onEnded={() => {
          audioRef.current = null;
          setCurrentAudioUrl(null);
        }}
        aria-label="Word pronunciation audio"
        style={{ display: "none" }}
      >
        <track kind="captions" srcLang="en" label="English captions" />
      </audio>

      <GameContent
        starsEarned={starsEarned}
        listTitle={listData.title}
        currentWordIndex={currentWordIndex}
        totalWords={listData.words.length}
        playAudio={playAudio}
        answer={answer}
        feedback={feedback}
        showHint={showHint}
        currentWord={currentWord}
        showConfetti={showConfetti}
        onAnswerChange={setAnswer}
        onCheckAnswer={checkAnswer}
        onRetry={retry}
        onNextWord={nextWord}
        isSaving={isSaving}
        ignorePunctuation={ignorePunctuation}
      />
    </AppShell>
  );
}
