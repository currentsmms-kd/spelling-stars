import { Card } from "./Card";
import { Button } from "./Button";
import { Trophy, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SessionCompleteProps {
  durationMinutes: number;
  wordsPracticed: number;
  starsEarned: number;
}

export function SessionComplete({
  durationMinutes,
  wordsPracticed,
  starsEarned,
}: SessionCompleteProps) {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center z-50 p-4">
      <Card className="max-w-2xl w-full text-center">
        <div className="space-y-6">
          {/* Trophy Icon */}
          <div className="flex justify-center">
            <div className="w-32 h-32 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
              <Trophy className="text-primary-foreground" size={64} />
            </div>
          </div>

          {/* Title */}
          <div>
            <h1 className="text-4xl font-bold mb-2">Great Job!</h1>
            <p className="text-xl text-muted-foreground">
              You've practiced enough for today
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 py-6">
            <div className="p-4 bg-primary/10 rounded-xl">
              <div className="text-3xl font-bold text-primary">
                {durationMinutes}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Minutes</div>
            </div>
            <div className="p-4 bg-secondary/10 rounded-xl">
              <div className="text-3xl font-bold text-secondary">
                {wordsPracticed}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Words</div>
            </div>
            <div className="p-4 bg-accent/10 rounded-xl">
              <div className="text-3xl font-bold text-accent flex items-center justify-center gap-1">
                <Star className="fill-current" size={24} />
                {starsEarned}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Stars</div>
            </div>
          </div>

          {/* Message */}
          <div className="p-6 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl">
            <p className="text-2xl font-semibold mb-2">
              🌟 Come back tomorrow! 🌟
            </p>
            <p className="text-muted-foreground">
              Your brain needs rest to remember what you learned today
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => navigate("/child/rewards")}
              size="lg"
              variant="secondary"
            >
              View Rewards
            </Button>
            <Button onClick={() => navigate("/child/home")} size="lg">
              Go Home
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
