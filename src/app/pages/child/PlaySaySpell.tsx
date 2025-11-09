import { useState, useEffect, useCallback } from "react";
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
import { queueAttempt, queueAudio } from "@/lib/sync";
import { addStars, useUpdateSrs } from "@/app/api/supa";
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
}: {
  playWord: () => void;
  handleStartRecording: () => Promise<void>;
  isRecording: boolean;
  audioBlob: Blob | null;
}) {
  return (
    <>
      <div>
        <p className="text-2xl text-muted-foreground mb-6">
          Listen to the word, then say the spelling out loud
        </p>
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
}) {
  return (
    <div className="space-y-4">
      <p className="text-2xl text-muted-foreground">Now type the spelling:</p>

      <input
        type="text"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && answer.trim() && feedback === null) {
            checkAnswer();
          }
        }}
        className="w-full text-4xl text-center px-6 py-4 border-4 border-primary rounded-2xl focus:ring-4 focus:ring-ring focus:border-primary font-bold bg-input"
        placeholder="Type here..."
        disabled={feedback === "correct"}
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
            disabled={!answer.trim()}
          >
            Check Answer
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
}: {
  listData: ListWithWords;
  currentWordIndex: number;
  starsEarned: number;
  step: "record" | "type";
  playWord: () => void;
  handleStartRecording: () => Promise<void>;
  isRecording: boolean;
  audioBlob: Blob | null;
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
}) {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
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
            />
          )}
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

function NoListSelected() {
  const navigate = useNavigate();
  return (
    <AppShell title="Say & Spell" variant="child">
      <div className="max-w-3xl mx-auto bg-card text-card-foreground border border-border child-card text-center space-y-6">
        <h3 className="text-3xl font-bold">Choose a list to practice</h3>
        <button
          onClick={() => navigate("/child/home")}
          className="inline-flex items-center justify-center rounded-md font-medium transition-colors child-button bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Go to Home
        </button>
      </div>
    </AppShell>
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
  const listId = searchParams.get("list");
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isOnline = useOnline();

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

  // SRS mutation
  const updateSrs = useUpdateSrs();

  const {
    isRecording,
    startRecording,
    stopRecording,
    audioBlob: recordedBlob,
    clearRecording,
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
      audioBlobId,
    }: {
      wordId: string;
      correct: boolean;
      typedAnswer: string;
      audioBlobId?: number;
    }) => {
      if (!profile?.id || !listId) return;

      if (isOnline) {
        // Upload audio if it exists
        let audioPath: string | undefined;
        if (audioBlob && profile?.id) {
          const timestamp = Date.now();
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
            audioPath = data.path;
          }
        }

        const { error } = await supabase.from("attempts").insert({
          child_id: profile.id,
          word_id: wordId,
          mode: "say-spell",
          correct,
          typed_answer: typedAnswer,
          audio_url: audioPath, // Store path instead of URL
          started_at: new Date().toISOString(),
        });

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
          "say-spell",
          correct,
          typedAnswer,
          audioBlobId
        );
      }
    },
  });

  const currentWord = listData?.words[currentWordIndex];

  const playWord = useCallback(() => {
    if (!currentWord) return;

    const utterance = new SpeechSynthesisUtterance(currentWord.text);
    if (currentWord.tts_voice) {
      utterance.voice =
        speechSynthesis
          .getVoices()
          .find((v) => v.name === currentWord.tts_voice) || null;
    }
    speechSynthesis.speak(utterance);
  }, [currentWord]);

  // Auto-play on word change
  useEffect(() => {
    if (currentWord && step === "record") {
      const timer = setTimeout(() => playWord(), 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [currentWord, step, playWord]);

  // Handle recording completion
  useEffect(() => {
    if (recordedBlob && step === "record") {
      setAudioBlob(recordedBlob);

      // Queue audio offline
      if (!isOnline) {
        const timestamp = Date.now();
        const fileName = `${profile?.id}/${listId}/${currentWord?.id}_${timestamp}.webm`;
        queueAudio(recordedBlob, fileName).then((id) => {
          setAudioBlobId(id);
        });
      }

      // Move to typing step
      setStep("type");
    }
  }, [recordedBlob, step, isOnline, profile?.id, listId, currentWord?.id]);

  const handleStartRecording = async () => {
    await startRecording();
    // Auto-stop after 3 seconds
    setTimeout(() => {
      stopRecording();
    }, 3000);
  };

  const normalizeAnswer = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[.,!?;:'"]/g, "");
  };

  const nextWord = useCallback(() => {
    if (!listData) return;

    if (currentWordIndex < listData.words.length - 1) {
      setCurrentWordIndex((prev) => prev + 1);
      setStep("record");
      setAnswer("");
      setFeedback(null);
      setShowHint(0);
      setHasTriedOnce(false);
      setAudioBlob(null);
      setAudioBlobId(null);
      clearRecording();
    } else {
      // Completed all words
      navigate("/child/rewards");
    }
  }, [listData, currentWordIndex, navigate, clearRecording]);

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
        audioBlobId: audioBlobId || undefined,
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

  const retry = () => {
    setAnswer("");
    setFeedback(null);
  };

  const redoRecording = () => {
    setStep("record");
    setAudioBlob(null);
    setAudioBlobId(null);
    clearRecording();
  };

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
      />
    </AppShell>
  );
}
