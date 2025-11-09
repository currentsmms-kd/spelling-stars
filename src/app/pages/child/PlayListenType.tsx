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
import { queueAttempt } from "@/lib/sync";
import { addStars, useUpdateSrs } from "@/app/api/supa";
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
  return (
    <Card variant="child">
      <div className="text-center space-y-6">
        <h3 className="text-3xl font-bold">Choose a list to practice</h3>
        <Link to="/child/home">
          <Button size="child">Go to Home</Button>
        </Link>
      </div>
    </Card>
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
  return (
    <div className="flex items-center justify-between">
      <Link to="/child/home">
        <Button size="child" className="flex items-center gap-2">
          <Home size={24} />
          <span>Home</span>
        </Button>
      </Link>
      <div className="flex gap-2">
        {[...Array(5)].map((_, i) => (
          <RewardStar key={i} filled={i < starsEarned} size="lg" />
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
  return (
    <div className="max-w-3xl mx-auto space-y-8">
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
  const listId = searchParams.get("list");
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isOnline = useOnline();

  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [showHint, setShowHint] = useState(0); // 0: no hint, 1: first letter, 2: full word
  const [starsEarned, setStarsEarned] = useState(0);
  const [hasTriedOnce, setHasTriedOnce] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // SRS mutation
  const updateSrs = useUpdateSrs();

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
        .select(
          `
          sort_index,
          words (*)
        `
        )
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
    }: {
      wordId: string;
      correct: boolean;
      typedAnswer: string;
    }) => {
      if (!profile?.id || !listId) return;

      const attemptData = {
        child_id: profile.id,
        word_id: wordId,
        mode: "listen-type",
        correct,
        typed_answer: typedAnswer,
        started_at: new Date().toISOString(),
      };

      if (isOnline) {
        const { error } = await supabase.from("attempts").insert(attemptData);
        if (error) throw error;

        // Add stars if first-try correct
        if (correct && !hasTriedOnce) {
          await addStars(profile.id, 1);
        }
      } else {
        // Queue for later sync
        await queueAttempt(
          profile.id,
          wordId,
          listId,
          "listen-type",
          correct,
          typedAnswer
        );
      }
    },
  });

  const currentWord = listData?.words[currentWordIndex];

  const playAudio = useCallback(() => {
    if (!currentWord) {
      return undefined;
    }

    if (currentWord.prompt_audio_url) {
      const audio = new Audio(currentWord.prompt_audio_url);
      audio.play();
    } else {
      // Use speech synthesis
      const utterance = new SpeechSynthesisUtterance(currentWord.text);
      if (currentWord.tts_voice) {
        utterance.voice =
          speechSynthesis
            .getVoices()
            .find((v) => v.name === currentWord.tts_voice) || null;
      }
      speechSynthesis.speak(utterance);
    }
    return undefined;
  }, [currentWord]);

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
      return undefined;
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
    return undefined;
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

    if (correct) {
      setFeedback("correct");
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);

      if (!hasTriedOnce) {
        setStarsEarned((prev) => prev + 1);
      }

      // Save attempt
      await saveAttemptMutation.mutateAsync({
        wordId: currentWord.id,
        correct: true,
        typedAnswer: answer,
      });

      // Update SRS: first-try correct
      if (isOnline) {
        updateSrs.mutate({
          childId: profile.id,
          wordId: currentWord.id,
          isCorrectFirstTry: !hasTriedOnce,
        });
      }

      // Move to next word after delay
      setTimeout(() => {
        nextWord();
      }, 2000);
    } else {
      setFeedback("wrong");
      setHasTriedOnce(true);

      // Save incorrect attempt
      await saveAttemptMutation.mutateAsync({
        wordId: currentWord.id,
        correct: false,
        typedAnswer: answer,
      });

      // Update SRS: not first-try correct (miss)
      if (isOnline && !hasTriedOnce) {
        // Only update SRS on first miss, not subsequent retries
        updateSrs.mutate({
          childId: profile.id,
          wordId: currentWord.id,
          isCorrectFirstTry: false,
        });
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
