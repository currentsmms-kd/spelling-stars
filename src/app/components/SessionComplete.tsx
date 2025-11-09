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
    <div className="fixed inset-0 bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center z-50 p-4">
      <Card className="max-w-2xl w-full text-center">
        <div className="space-y-6">
          {/* Trophy Icon */}
          <div className="flex justify-center">
            <div className="w-32 h-32 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
              <Trophy className="text-white" size={64} />
            </div>
          </div>

          {/* Title */}
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Great Job!
            </h1>
            <p className="text-xl text-gray-600">
              You've practiced enough for today
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 py-6">
            <div className="p-4 bg-primary-50 rounded-xl">
              <div className="text-3xl font-bold text-primary-700">
                {durationMinutes}
              </div>
              <div className="text-sm text-gray-600 mt-1">Minutes</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl">
              <div className="text-3xl font-bold text-blue-700">
                {wordsPracticed}
              </div>
              <div className="text-sm text-gray-600 mt-1">Words</div>
            </div>
            <div className="p-4 bg-secondary-50 rounded-xl">
              <div className="text-3xl font-bold text-secondary-700 flex items-center justify-center gap-1">
                <Star className="fill-current" size={24} />
                {starsEarned}
              </div>
              <div className="text-sm text-gray-600 mt-1">Stars</div>
            </div>
          </div>

          {/* Message */}
          <div className="p-6 bg-gradient-to-r from-primary-50 to-secondary-50 rounded-2xl">
            <p className="text-2xl font-semibold text-gray-800 mb-2">
              🌟 Come back tomorrow! 🌟
            </p>
            <p className="text-gray-600">
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
