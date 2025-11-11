import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import { RewardStar } from "@/app/components/RewardStar";
import { Volume2, CheckCircle, XCircle, Home } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/app/supabase";
import { useAuth } from "@/app/hooks/useAuth";
import { useOnline } from "@/app/hooks/useOnline";
import { useTtsVoices } from "@/app/hooks/useTtsVoices";
import { queueAttempt } from "@/lib/sync";
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
  isOnline: boolean;
}

interface PlayWordButtonProps {
  playAudio: () => void;
}

function PlayWordButton({ playAudio }: PlayWordButtonProps) {
  return (
    <div>
      <p className="text-2xl text-muted-foreground mb-6">
        Listen to the word and type it below
      </p>
      <Button
        onClick={playAudio}
        size="child"
        className="w-64 flex items-center justify-center gap-3"
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

  if (error) {
    return (
      <Card variant="child">
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
            <Button size="child" onClick={() => refetch()}>
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
        <div className="text-center">
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
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate(`?listId=${list.id}`)}
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
      <div className="flex gap-2">
        {stars.map((star) => (
          <RewardStar key={star.id} filled={star.filled} size="lg" />
        ))}
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
    <div className="text-center">
      <p className="text-2xl font-bold">{listTitle}</p>
      <p className="text-xl text-muted-foreground mt-2">
        Word {currentWordIndex + 1} of {totalWords}
      </p>
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
  isOnline,
}: GameContentProps) {
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

      <ProgressDisplay
        listTitle={listTitle}
        currentWordIndex={currentWordIndex}
        totalWords={totalWords}
      />

      <Card variant="child">
        <div className="text-center space-y-8">
          <PlayWordButton playAudio={playAudio} />

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
          />
        </div>
      </Card>

      {!isOnline && (
        <div className="text-center text-accent-foreground text-lg">
          📡 Offline mode - progress will sync when online
        </div>
      )}
    </div>
  );
}

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
}: AnswerSectionProps) {
  return (
    <div className="space-y-4">
      <input
        type="text"
        value={answer}
        onChange={(e) => onAnswerChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && answer.trim() && feedback === null) {
            onCheckAnswer();
          }
        }}
        className="w-full text-4xl text-center px-6 py-4 border-4 border-primary rounded-2xl focus:ring-4 focus:ring-ring focus:border-primary font-bold bg-input"
        placeholder="Type here..."
        disabled={feedback === "correct"}
      />

      {/* Hints */}
      {showHint > 0 && feedback === "wrong" && (
        <div className="text-center">
          {showHint === 1 && (
            <p className="text-2xl text-secondary">
              Hint: It starts with &quot;
              {currentWord?.text[0].toUpperCase()}&quot;
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
          disabled={!answer.trim()}
        >
          Check Answer
        </Button>
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

export function PlayListenType() {
  const [searchParams] = useSearchParams();
  const listId = searchParams.get("listId"); // Fixed: was "list", should be "listId"
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isOnline = useOnline();
  const { getVoiceWithFallback, isLoading: voicesLoading } = useTtsVoices();

  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [showHint, setShowHint] = useState(0); // 0: no hint, 1: first letter, 2: full word
  const [starsEarned, setStarsEarned] = useState(0);
  const [hasTriedOnce, setHasTriedOnce] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [hasUpdatedStreak, setHasUpdatedStreak] = useState(false);

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

  // Fetch the selected list or show list selector
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
    }: {
      wordId: string;
      correct: boolean;
      typedAnswer: string;
      quality: number;
    }) => {
      if (!profile?.id || !listId) return;

      const attemptData = {
        child_id: profile.id,
        word_id: wordId,
        mode: "listen-type",
        correct,
        quality, // Add quality field
        typed_answer: typedAnswer,
        started_at: new Date().toISOString(),
      };

      if (isOnline) {
        const { error } = await supabase.from("attempts").insert(attemptData);
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
          "listen-type",
          correct,
          typedAnswer
        );

        // Queue star transaction
        if (correct && !hasTriedOnce) {
          await queueStarTransaction(profile.id, 1, "correct_word");
        }
      }
    },
  });

  const currentWord = listData?.words[currentWordIndex];

  const playAudio = useCallback(() => {
    if (!currentWord) {
      return;
    }

    if (currentWord.prompt_audio_url) {
      const audio = new Audio(currentWord.prompt_audio_url);
      audio.play();
    } else {
      // Wait for voices to load before using TTS
      if (voicesLoading) {
        logger.warn("TTS voices still loading, will retry after delay");
        // Retry after a short delay when voices are loading
        setTimeout(() => playAudio(), 100);
        return;
      }

      // Use speech synthesis with fallback voice selection
      const utterance = new SpeechSynthesisUtterance(currentWord.text);

      // Get voice with fallback - ensures we always have a voice when loaded
      const voice = getVoiceWithFallback(currentWord.tts_voice || undefined);
      if (voice) {
        utterance.voice = voice;
      }
      // If voice is null, browser will use default voice

      speechSynthesis.speak(utterance);
    }
  }, [currentWord, getVoiceWithFallback, voicesLoading]);

  // Auto-play on word change
  useEffect(() => {
    if (currentWord) {
      const timer = setTimeout(() => playAudio(), 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [currentWord, playAudio]);

  const normalizeAnswer = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[.,!?;:'"]/g, "");
  };

  const nextWord = useCallback(() => {
    if (!listData) {
      return;
    }

    if (currentWordIndex < listData.words.length - 1) {
      setCurrentWordIndex((prev) => prev + 1);
      setAnswer("");
      setFeedback(null);
      setShowHint(0);
      setHasTriedOnce(false);
    } else {
      // Completed all words
      navigate("/child/rewards");
    }
  }, [listData, currentWordIndex, navigate]);

  const retry = () => {
    setAnswer("");
    setFeedback(null);
  };

  const checkAnswer = useCallback(async () => {
    if (!currentWord || !profile?.id) return;

    const normalizedAnswer = normalizeAnswer(answer);
    const normalizedCorrect = normalizeAnswer(currentWord.text);
    const correct = normalizedAnswer === normalizedCorrect;

    // Calculate quality score (0-5)
    const usedHint = showHint > 0;
    const quality = computeAttemptQuality(correct, !hasTriedOnce, usedHint);

    if (correct) {
      setFeedback("correct");
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);

      if (!hasTriedOnce) {
        setStarsEarned((prev) => prev + 1);
      }

      // Save attempt with quality
      await saveAttemptMutation.mutateAsync({
        wordId: currentWord.id,
        correct: true,
        typedAnswer: answer,
        quality,
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
      setTimeout(() => {
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
    saveAttemptMutation,
    isOnline,
    updateSrs,
    nextWord,
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
        isOnline={isOnline}
      />
    </AppShell>
  );
}
