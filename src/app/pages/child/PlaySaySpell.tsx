import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import { RewardStar } from "@/app/components/RewardStar";
import { Volume2, Mic, CheckCircle, XCircle, Home } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/app/supabase";
import { useAuth } from "@/app/hooks/useAuth";
import { useOnline } from "@/app/hooks/useOnline";
import { useAudioRecorder } from "@/app/hooks/useAudioRecorder";
import { useTtsVoices } from "@/app/hooks/useTtsVoices";
import { queueAttempt, queueAudio } from "@/lib/sync";
import { logger } from "@/lib/logger";
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

function RecordStep({
  playWord,
  handleStartRecording,
  isRecording,
  audioBlob,
  error,
  clearRecording,
}: {
  playWord: () => void;
  handleStartRecording: () => Promise<void>;
  isRecording: boolean;
  audioBlob: Blob | null;
  error: string | null;
  clearRecording: () => void;
}) {
  return (
    <>
      <div>
        <p className="text-2xl text-muted-foreground mb-6">
          Listen to the word, then say the spelling out loud
        </p>

        {/* Display error message if recording fails */}
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border-2 border-destructive rounded-lg">
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
          >
            <Mic size={32} />
            <span>Start Recording</span>
          </Button>
        )}

        {isRecording && (
          <div className="space-y-4">
            <div className="animate-pulse text-destructive">
              <Mic size={64} className="mx-auto" />
            </div>
            <p className="text-xl text-muted-foreground">
              Recording... (3 seconds)
            </p>
          </div>
        )}

        {audioBlob && (
          <div className="space-y-4">
            <CheckCircle size={48} className="mx-auto text-secondary" />
            <p className="text-xl text-muted-foreground">Recording saved!</p>
          </div>
        )}
      </div>
    </>
  );
}

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
}) {
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
        !isSaving
      ) {
        checkAnswer();
      }
    },
    [answer, feedback, checkAnswer, isSaving]
  );

  return (
    <div className="space-y-4">
      <p className="text-2xl text-muted-foreground">Now type the spelling:</p>

      <input
        type="text"
        value={answer}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        className={`w-full text-4xl text-center px-6 py-4 border-4 border-primary rounded-2xl focus:ring-4 focus:ring-ring focus:border-primary font-bold bg-input ${isSaving ? "opacity-50" : ""}`}
        placeholder="Type here..."
        disabled={feedback === "correct" || isSaving}
      />

      {showHint > 0 && feedback === "wrong" && (
        <div className="text-center">
          {showHint === 1 && (
            <p className="text-2xl text-secondary">
              Hint: It starts with &quot;{currentWord?.text[0].toUpperCase()}
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
          <Button
            onClick={checkAnswer}
            size="child"
            className="w-full"
            disabled={!answer.trim() || (!isOnline && !audioBlobId) || isSaving}
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
      <div className="flex gap-2">
        {stars.map((star) => (
          <RewardStar key={star.id} filled={star.filled} size="lg" />
        ))}
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
    <div className="text-center">
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
}: {
  listData: ListWithWords;
  currentWordIndex: number;
  starsEarned: number;
  step: "record" | "type";
  playWord: () => void;
  handleStartRecording: () => Promise<void>;
  isRecording: boolean;
  audioBlob: Blob | null;
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

      <Card variant="child">
        <div className="text-center space-y-8">
          {step === "record" && (
            <RecordStep
              playWord={playWord}
              handleStartRecording={handleStartRecording}
              isRecording={isRecording}
              audioBlob={audioBlob}
              error={error}
              clearRecording={clearRecording}
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
    queryKey: ["word_lists_for_child"],
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

  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  if (error) {
    // Add error telemetry
    logger.metrics.errorCaptured({
      context: "PlaySaySpell.loadLists",
      message:
        error instanceof Error
          ? error.message
          : "Failed to load spelling lists",
      severity: "warning",
    });

    return (
      <AppShell title="Say & Spell" variant="child">
        <Card variant="child" className="max-w-3xl mx-auto">
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
          <div className="text-center">
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
      className="cursor-pointer hover:shadow-lg transition-shadow"
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

export function PlaySaySpell() {
  const [searchParams] = useSearchParams();
  const listId = searchParams.get("listId"); // Fixed: was "list", should be "listId"
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isOnline = useOnline();
  const { getVoiceWithFallback, isLoading: voicesLoading } = useTtsVoices();

  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [step, setStep] = useState<"record" | "type">("record");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioBlobId, setAudioBlobId] = useState<number | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [showHint, setShowHint] = useState(0);
  const [starsEarned, setStarsEarned] = useState(0);
  const [hasTriedOnce, setHasTriedOnce] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [hasUpdatedStreak, setHasUpdatedStreak] = useState(false);

  // Refs for timeout cleanup
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const confettiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hooks for D3/D4 features
  const updateSrs = useUpdateSrs();
  const awardStars = useAwardStars();
  const updateStreak = useUpdateDailyStreak();

  // Update streak when component mounts (first practice of session)
  useEffect(() => {
    if (profile?.id && !hasUpdatedStreak) {
      updateStreak.mutate(profile.id);
      setHasUpdatedStreak(true);
    }
  }, [profile?.id, hasUpdatedStreak, updateStreak]);

  const {
    isRecording,
    startRecording,
    stopRecording,
    audioBlob: recordedBlob,
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

  // Save attempt mutation
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
              contentType: "audio/webm",
              cacheControl: "3600",
            });

          if (!error && data) {
            // Store the path, not a URL
            // Signed URLs will be generated on-demand when audio needs to be played
            // Use getSignedAudioUrl() from supa.ts or useAttempts() hook for playback
            audioPath = data.path;
          }
        }

        const { error } = await supabase.from("attempts").insert({
          child_id: profile.id,
          word_id: wordId,
          list_id: listId,
          mode: "say-spell",
          correct,
          quality, // Add quality field
          typed_answer: typedAnswer,
          audio_url: audioPath, // Store path instead of URL
          started_at: new Date().toISOString(),
        });

        if (error) throw error;

        // Award stars if first-try correct
        if (correct && !hasTriedOnce) {
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
        if (correct && !hasTriedOnce) {
          await queueStarTransaction(profile.id, 1, "correct_word");
        }
      }
    },
    onError: (error) => {
      logger.error("Error saving attempt:", error);
      logger.metrics.errorCaptured({
        context: "PlaySaySpell.saveAttempt",
        message: error instanceof Error ? error.message : "Unknown error",
        severity: "error",
      });
    },
  });

  const isSaving = saveAttemptMutation.isPending;

  const currentWord = listData?.words[currentWordIndex];

  const playWord = useCallback(() => {
    if (!currentWord) return;

    // Wait for voices to load before using TTS
    if (voicesLoading) {
      logger.warn("TTS voices still loading, will retry after delay");
      // Retry after a short delay when voices are loading
      setTimeout(() => playWord(), 100);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(currentWord.text);

    // Get voice with fallback - ensures we always have a voice when loaded
    const voice = getVoiceWithFallback(currentWord.tts_voice || undefined);
    if (voice) {
      utterance.voice = voice;
    }
    // If voice is null, browser will use default voice

    speechSynthesis.speak(utterance);
  }, [currentWord, getVoiceWithFallback, voicesLoading]);

  // Auto-play on word change
  useEffect(() => {
    if (currentWord && step === "record") {
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
    };
  }, []);

  // Handle recording completion
  useEffect(() => {
    // Guard clause: only process when we have a recording blob and we're in record step
    if (!recordedBlob || step !== "record") return;

    console.log("[PlaySaySpell] Recording blob received, processing...");
    setAudioBlob(recordedBlob);

    // Queue audio offline
    if (!isOnline) {
      console.log("[PlaySaySpell] Queuing audio offline");

      // Comment 3: Guard against undefined IDs when queueing audio offline
      if (!profile?.id || !listId || !currentWord?.id) {
        logger.error("Cannot queue audio: missing required IDs", {
          hasProfileId: !!profile?.id,
          hasListId: !!listId,
          hasWordId: !!currentWord?.id,
        });
        return;
      }

      const timestamp = Date.now();
      // CRITICAL: Path format must match online format for RLS policy compliance
      // Format: {child_id}/{list_id}/{word_id}_{timestamp}.webm
      const fileName = `${profile.id}/${listId}/${currentWord.id}_${timestamp}.webm`;

      // Comment 1: Await queueAudio to ensure audioBlobId is set before transitioning
      queueAudio(recordedBlob, fileName)
        .then((id) => {
          setAudioBlobId(id);
          console.log("[PlaySaySpell] Audio queued with ID:", id);
          // Move to typing step only after audio is queued
          console.log("[PlaySaySpell] Moving to type step");
          setStep("type");
        })
        .catch((error) => {
          logger.error("Failed to queue audio", error);
          // Still allow transition to type step even if queueing fails
          console.log("[PlaySaySpell] Moving to type step despite queue error");
          setStep("type");
        });
    } else {
      // Move to typing step immediately when online
      console.log("[PlaySaySpell] Moving to type step");
      setStep("type");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordedBlob]);

  const handleStartRecording = useCallback(async () => {
    // Clear any existing recording timeout
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }

    console.log(
      "[PlaySaySpell] Starting recording, will auto-stop in 3 seconds"
    );
    await startRecording();

    // Store timeout ID for cleanup
    recordingTimeoutRef.current = setTimeout(() => {
      console.log("[PlaySaySpell] Auto-stopping recording after 3 seconds");
      stopRecording();
    }, 3000);
  }, [startRecording, stopRecording]);

  const normalizeAnswer = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[.,!?;:'"]/g, "");
  };

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

    // Compute next index
    const nextIndex = currentWordIndex + 1;
    console.log(
      `[PlaySaySpell] Advancing from word ${currentWordIndex} to ${nextIndex} of ${listData.words.length}`
    );

    if (nextIndex >= listData.words.length) {
      // Completed all words - navigate without updating state
      console.log("[PlaySaySpell] All words complete, navigating to rewards");
      navigate("/child/rewards");
      return;
    }

    // Move to next word - update index and reset local state
    console.log("[PlaySaySpell] Clearing recording state for next word");
    setCurrentWordIndex((prev) => prev + 1);
    setStep("record");
    setAnswer("");
    setFeedback(null);
    setShowHint(0);
    setHasTriedOnce(false);
    setAudioBlob(null);
    setAudioBlobId(null);
    clearRecording();
  }, [listData, currentWordIndex, navigate, clearRecording]);

  const checkAnswer = useCallback(async () => {
    if (!currentWord || !profile?.id) return;

    // Comment 1: Guard when offline - ensure audioBlobId is set before checking
    if (!isOnline && !audioBlobId) {
      logger.warn("Cannot check answer offline: audio not yet queued");
      return;
    }

    const normalizedAnswer = normalizeAnswer(answer);
    const normalizedCorrect = normalizeAnswer(currentWord.text);
    const correct = normalizedAnswer === normalizedCorrect;

    // Calculate quality score (0-5)
    const usedHint = showHint > 0;
    const quality = computeAttemptQuality(correct, !hasTriedOnce, usedHint);

    if (correct) {
      setFeedback("correct");
      setShowConfetti(true);

      // Clear any existing confetti timeout before setting a new one
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
      }
      confettiTimeoutRef.current = setTimeout(
        () => setShowConfetti(false),
        2000
      );

      if (!hasTriedOnce) {
        setStarsEarned((prev) => prev + 1);
      }

      // Save attempt with quality
      await saveAttemptMutation.mutateAsync({
        wordId: currentWord.id,
        correct: true,
        typedAnswer: answer,
        quality,
        audioBlobId: audioBlobId || undefined,
      });

      // Update SRS: first-try correct
      if (isOnline) {
        updateSrs.mutate({
          childId: profile.id,
          wordId: currentWord.id,
          isCorrectFirstTry: !hasTriedOnce,
        });
      } else {
        await queueSrsUpdate(profile.id, currentWord.id, !hasTriedOnce);
      }

      // Move to next word after delay
      console.log("[PlaySaySpell] Answer correct, scheduling nextWord in 2s");
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        nextWord();
      }, 2000);
    } else {
      setFeedback("wrong");
      setHasTriedOnce(true);

      // Save incorrect attempt with quality
      await saveAttemptMutation.mutateAsync({
        wordId: currentWord.id,
        correct: false,
        typedAnswer: answer,
        quality,
        audioBlobId: audioBlobId || undefined,
      });

      // Update SRS: not first-try correct (miss)
      if (isOnline && !hasTriedOnce) {
        // Only update SRS on first miss, not subsequent retries
        updateSrs.mutate({
          childId: profile.id,
          wordId: currentWord.id,
          isCorrectFirstTry: false,
        });
      } else if (!isOnline && !hasTriedOnce) {
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
    hasTriedOnce,
    showHint,
    audioBlobId,
    saveAttemptMutation,
    isOnline,
    updateSrs,
    nextWord,
  ]);

  const retry = useCallback(() => {
    setAnswer("");
    setFeedback(null);
  }, []);

  const redoRecording = useCallback(() => {
    console.log("[PlaySaySpell] User requested re-record");
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
      />
    </AppShell>
  );
}
