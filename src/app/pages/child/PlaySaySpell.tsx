import { useState } from "react";
import { AppShell } from "src/app/components/AppShell";
import { Card } from "src/app/components/Card";
import { Button } from "src/app/components/Button";
import { AudioRecorder } from "src/app/components/AudioRecorder";
import { RewardStar } from "src/app/components/RewardStar";
import { Volume2 } from "lucide-react";

export function PlaySaySpell() {
  const [currentWord] = useState("example");
  const [hasRecording, setHasRecording] = useState(false);
  const [score, setScore] = useState(0);

  const playWord = () => {
    const utterance = new SpeechSynthesisUtterance(currentWord);
    window.speechSynthesis.speak(utterance);
  };

  const handleRecordingComplete = (blob: Blob, url: string) => {
    setHasRecording(true);
    console.log("Recording complete:", blob, url);
    // Here you would upload to Supabase Storage and queue if offline
  };

  const submitAnswer = () => {
    // Process the recorded answer
    setScore(score + 1);
    setHasRecording(false);
  };

  return (
    <AppShell title="Say & Spell" variant="child">
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
                Listen to the word, then spell it out loud
              </p>
              <Button
                onClick={playWord}
                size="child"
                className="w-64 flex items-center justify-center gap-3"
              >
                <Volume2 size={32} />
                <span>Play Word</span>
              </Button>
            </div>

            <div className="space-y-6">
              <p className="text-2xl font-semibold text-gray-700">
                Record yourself spelling:
              </p>

              <AudioRecorder onRecordingComplete={handleRecordingComplete} />

              {hasRecording && (
                <Button onClick={submitAnswer} size="child" className="w-full">
                  Submit Answer
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
