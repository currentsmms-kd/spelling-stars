import { AppShell } from "src/app/components/AppShell";
import { Card } from "src/app/components/Card";
import { RewardStar } from "src/app/components/RewardStar";
import { Trophy, Target, Zap } from "lucide-react";

export function Rewards() {
  const totalStars = 47;
  const streak = 5;
  const perfectWords = 23;

  return (
    <AppShell title="My Rewards" variant="child">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-primary-700 mb-4">
            You're doing great! 🎉
          </h2>
          <p className="text-2xl text-gray-600">
            Keep practicing to earn more stars!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card variant="child">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-secondary-100 rounded-full flex items-center justify-center mx-auto">
                <Trophy className="text-secondary-700" size={40} />
              </div>
              <div>
                <p className="text-5xl font-bold text-gray-900">{totalStars}</p>
                <p className="text-xl text-gray-600">Total Stars</p>
              </div>
            </div>
          </Card>

          <Card variant="child">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                <Zap className="text-orange-600" size={40} />
              </div>
              <div>
                <p className="text-5xl font-bold text-gray-900">{streak}</p>
                <p className="text-xl text-gray-600">Day Streak</p>
              </div>
            </div>
          </Card>

          <Card variant="child">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Target className="text-green-600" size={40} />
              </div>
              <div>
                <p className="text-5xl font-bold text-gray-900">
                  {perfectWords}
                </p>
                <p className="text-xl text-gray-600">Perfect Words</p>
              </div>
            </div>
          </Card>
        </div>

        <Card variant="child">
          <h3 className="text-3xl font-bold mb-6 text-center">Your Stars</h3>
          <div className="grid grid-cols-8 gap-4 justify-items-center">
            {[...Array(50)].map((_, i) => (
              <RewardStar key={i} filled={i < totalStars} size="xl" />
            ))}
          </div>
        </Card>

        <Card variant="child">
          <h3 className="text-3xl font-bold mb-6 text-center">
            Recent Achievements
          </h3>
          <div className="space-y-4">
            <div className="p-6 bg-primary-50 rounded-2xl border-2 border-primary-200">
              <p className="text-2xl font-semibold text-primary-700">
                🏆 5 Day Streak!
              </p>
              <p className="text-lg text-gray-600 mt-1">
                You've practiced 5 days in a row!
              </p>
            </div>
            <div className="p-6 bg-secondary-50 rounded-2xl border-2 border-secondary-200">
              <p className="text-2xl font-semibold text-secondary-700">
                ⭐ 25 Stars Earned!
              </p>
              <p className="text-lg text-gray-600 mt-1">
                You've collected 25 stars total!
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
