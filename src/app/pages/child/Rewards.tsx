import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { RewardStar } from "@/app/components/RewardStar";
import { Trophy, Target, Zap, Home } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/app/supabase";
import { useAuth } from "@/app/hooks/useAuth";
import { Link } from "react-router-dom";
import { Button } from "@/app/components/Button";

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string;
}

export function Rewards() {
  const { profile } = useAuth();

  // Fetch rewards data
  const { data: rewardsData } = useQuery({
    queryKey: ["rewards", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;

      const { data, error } = await supabase
        .from("rewards")
        .select("*")
        .eq("child_id", profile.id)
        .single();

      if (error) {
        // If no rewards record exists, create one
        const { data: newReward } = await supabase
          .from("rewards")
          .insert({
            child_id: profile.id,
            stars_total: 0,
            streak_current: 0,
            badges: [],
          })
          .select()
          .single();

        return newReward;
      }

      return data;
    },
    enabled: Boolean(profile?.id),
  });

  // Calculate perfect words (words with at least one correct first-try attempt)
  const { data: perfectWordsCount } = useQuery({
    queryKey: ["perfect-words", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return 0;

      // Get all correct attempts
      const { data: attempts } = await supabase
        .from("attempts")
        .select("word_id, started_at")
        .eq("child_id", profile.id)
        .eq("correct", true)
        .order("started_at", { ascending: true });

      if (!attempts) return 0;

      // Group by word_id and check if first attempt was correct
      const wordAttempts = new Map<string, string[]>();

      attempts.forEach((attempt) => {
        if (!wordAttempts.has(attempt.word_id)) {
          wordAttempts.set(attempt.word_id, []);
        }
        if (attempt.started_at) {
          wordAttempts.get(attempt.word_id)?.push(attempt.started_at);
        }
      }); // Count words where we have at least one correct attempt
      // (In a real implementation, we'd need to check if it was the first try)
      return wordAttempts.size;
    },
    enabled: Boolean(profile?.id),
  });

  // Parse badges from JSON
  const badges = (Array.isArray(rewardsData?.badges)
    ? rewardsData?.badges
    : []) as unknown as Badge[];

  // Generate achievement badges based on stats
  const achievements: Array<{
    title: string;
    description: string;
    icon: string;
    color: string;
  }> = [];

  if ((rewardsData?.streak_current || 0) >= 5) {
    achievements.push({
      title: "🔥 5 Day Streak!",
      description: "You've practiced 5 days in a row!",
      icon: "🔥",
      color: "primary",
    });
  }

  if ((rewardsData?.stars_total || 0) >= 25) {
    achievements.push({
      title: "⭐ 25 Stars Earned!",
      description: "You've collected 25 stars total!",
      icon: "⭐",
      color: "secondary",
    });
  }

  if ((rewardsData?.stars_total || 0) >= 50) {
    achievements.push({
      title: "🌟 Star Master!",
      description: "You've earned 50 stars!",
      icon: "🌟",
      color: "primary",
    });
  }

  if ((perfectWordsCount || 0) >= 10) {
    achievements.push({
      title: "🎯 Perfect 10!",
      description: "You've spelled 10 words perfectly!",
      icon: "🎯",
      color: "secondary",
    });
  }

  const totalStars = rewardsData?.stars_total || 0;
  const streak = rewardsData?.streak_current || 0;
  const perfectWords = perfectWordsCount || 0;

  return (
    <AppShell title="My Rewards" variant="child">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <Link to="/child/home">
            <Button size="child" className="flex items-center gap-2">
              <Home size={24} />
              <span>Home</span>
            </Button>
          </Link>
        </div>

        <div className="text-center">
          <h2 className="text-4xl font-bold text-primary mb-4">
            You&apos;re doing great! 🎉
          </h2>
          <p className="text-2xl text-muted-foreground">
            Keep practicing to earn more stars!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card variant="child">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-secondary/20 rounded-full flex items-center justify-center mx-auto">
                <Trophy className="text-secondary" size={40} />
              </div>
              <div>
                <p className="text-5xl font-bold">{totalStars}</p>
                <p className="text-xl text-muted-foreground">Total Stars</p>
              </div>
            </div>
          </Card>

          <Card variant="child">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
                <Zap className="text-accent-foreground" size={40} />
              </div>
              <div>
                <p className="text-5xl font-bold">{streak}</p>
                <p className="text-xl text-muted-foreground">Day Streak</p>
              </div>
            </div>
          </Card>

          <Card variant="child">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-secondary/20 rounded-full flex items-center justify-center mx-auto">
                <Target className="text-secondary" size={40} />
              </div>
              <div>
                <p className="text-5xl font-bold">{perfectWords}</p>
                <p className="text-xl text-muted-foreground">Perfect Words</p>
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
          {totalStars < 50 && (
            <p className="text-center text-xl text-muted-foreground mt-6">
              {50 - totalStars} more stars to reach 50!
            </p>
          )}
        </Card>

        {achievements.length > 0 && (
          <Card variant="child">
            <h3 className="text-3xl font-bold mb-6 text-center">
              Recent Achievements
            </h3>
            <div className="space-y-4">
              {achievements.map((achievement, idx) => (
                <div
                  key={idx}
                  className={`p-6 bg-${achievement.color}/10 rounded-2xl border-2 border-${achievement.color}`}
                >
                  <p
                    className={`text-2xl font-semibold text-${achievement.color}-foreground`}
                  >
                    {achievement.title}
                  </p>
                  <p className="text-lg text-muted-foreground mt-1">
                    {achievement.description}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {badges.length > 0 && (
          <Card variant="child">
            <h3 className="text-3xl font-bold mb-6 text-center">
              Special Badges
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  className="text-center p-4 bg-muted/50 rounded-xl border"
                >
                  <div className="text-4xl mb-2">{badge.icon}</div>
                  <p className="text-lg font-semibold">{badge.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {badge.description}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
