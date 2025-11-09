import { useState } from "react";
import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import { RewardStar } from "@/app/components/RewardStar";
import { Volume2, CheckCircle, XCircle } from "lucide-react";

export function PlayListenType() {
  const [currentWord] = useState("example");
  const [answer, setAnswer] = useState("");
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);

  const playAudio = () => {
    // Placeholder for audio playback
    const utterance = new SpeechSynthesisUtterance(currentWord);
    window.speechSynthesis.speak(utterance);
  };

  const checkAnswer = () => {
    const correct = answer.toLowerCase().trim() === currentWord.toLowerCase();
    setIsCorrect(correct);
    if (correct) {
      setScore(score + 1);
    }
  };

  const nextWord = () => {
    setAnswer("");
    setIsCorrect(null);
    // Load next word logic here
  };

  return (
    <AppShell title="Listen & Type" variant="child">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {[...Array(5)].map((_, i) => (
              <RewardStar key={i} filled={i < score} size="lg" />
            ))}
          </div>
          <p className="text-3xl font-bold text-primary-700">Score: {score}</p>
        </div>

        <Card variant="child">
          <div className="text-center space-y-8">
            <div>
              <p className="text-2xl text-gray-600 mb-6">
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

            <div className="space-y-4">
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="w-full text-4xl text-center px-6 py-4 border-4 border-primary-300 rounded-2xl focus:ring-4 focus:ring-primary-500 focus:border-primary-500 font-bold"
                placeholder="Type here..."
                disabled={isCorrect !== null}
              />

              {isCorrect === null && (
                <Button
                  onClick={checkAnswer}
                  size="child"
                  className="w-full"
                  disabled={!answer.trim()}
                >
                  Check Answer
                </Button>
              )}

              {isCorrect === true && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-3 text-green-600">
                    <CheckCircle size={48} />
                    <p className="text-4xl font-bold">Correct! 🎉</p>
                  </div>
                  <Button onClick={nextWord} size="child" className="w-full">
                    Next Word
                  </Button>
                </div>
              )}

              {isCorrect === false && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-3 text-red-600">
                    <XCircle size={48} />
                    <p className="text-4xl font-bold">Try Again!</p>
                  </div>
                  <p className="text-2xl text-gray-600">
                    The correct spelling is: <strong>{currentWord}</strong>
                  </p>
                  <Button onClick={nextWord} size="child" className="w-full">
                    Next Word
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
