import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { RewardStar } from "@/app/components/RewardStar";
import { Trophy, Target, Zap, Home, type LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/app/supabase";
import { useAuth } from "@/app/hooks/useAuth";
import { Link } from "react-router-dom";
import { Button } from "@/app/components/Button";
import { cn } from "@/lib/utils";

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string;
}

// Color mapping to avoid dynamic class construction (which Tailwind purges)
type AchievementColor = "primary" | "secondary" | "accent";

interface ColorClasses {
  background: string;
  border: string;
  text: string;
}

const ACHIEVEMENT_COLOR_MAP: Record<AchievementColor, ColorClasses> = {
  primary: {
    background: "bg-primary/10",
    border: "border-primary",
    text: "text-primary-foreground",
  },
  secondary: {
    background: "bg-secondary/10",
    border: "border-secondary",
    text: "text-secondary-foreground",
  },
  accent: {
    background: "bg-accent/10",
    border: "border-accent",
    text: "text-accent-foreground",
  },
} as const;

// Stats card color mapping
type StatsColor = "primary" | "secondary" | "accent";

interface StatsColorClasses {
  background: string;
  icon: string;
}

const STATS_COLOR_MAP: Record<StatsColor, StatsColorClasses> = {
  primary: {
    background: "bg-primary/20",
    icon: "text-primary",
  },
  secondary: {
    background: "bg-secondary/20",
    icon: "text-secondary",
  },
  accent: {
    background: "bg-accent/20",
    icon: "text-accent",
  },
} as const;

// Extracted Stats Card Component
function StatsCard({
  value,
  label,
  icon: Icon,
  color,
}: {
  value: number;
  label: string;
  icon: LucideIcon;
  color: StatsColor;
}) {
  const colorClasses = STATS_COLOR_MAP[color];

  return (
    <Card variant="child">
      <div className="text-center space-y-4">
        <div
          className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center mx-auto",
            colorClasses.background
          )}
        >
          <Icon className={cn(colorClasses.icon)} size={40} />
        </div>
        <div>
          <p className="text-5xl font-bold">{value}</p>
          <p className="text-xl text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  );
}

// Extracted Achievement Card Component
function AchievementCard({
  achievement,
}: {
  achievement: {
    title: string;
    description: string;
    icon: string;
    color: string;
  };
}) {
  // Get the color classes, defaulting to primary if color is not recognized
  const colorKey = (
    ["primary", "secondary", "accent"].includes(achievement.color)
      ? achievement.color
      : "primary"
  ) as AchievementColor;
  const colorClasses = ACHIEVEMENT_COLOR_MAP[colorKey];

  return (
    <div
      className={cn(
        "p-6 rounded-2xl border-2",
        colorClasses.background,
        colorClasses.border
      )}
    >
      <p className={cn("text-2xl font-semibold", colorClasses.text)}>
        {achievement.title}
      </p>
      <p className="text-lg text-muted-foreground mt-1">
        {achievement.description}
      </p>
    </div>
  );
}

// Extracted Badge Card Component
function BadgeCard({ badge }: { badge: Badge }) {
  return (
    <div className="text-center p-4 bg-muted/50 rounded-xl border">
      <div className="text-4xl mb-2">{badge.icon}</div>
      <p className="text-lg font-semibold">{badge.name}</p>
      <p className="text-sm text-muted-foreground">{badge.description}</p>
    </div>
  );
}

// Extracted Stars Grid Component
function StarsGrid({ totalStars }: { totalStars: number }) {
  return (
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
  );
}

// Extracted Achievements Section Component
function AchievementsSection({
  achievements,
}: {
  achievements: Array<{
    title: string;
    description: string;
    icon: string;
    color: string;
  }>;
}) {
  if (achievements.length === 0) return null;

  return (
    <Card variant="child">
      <h3 className="text-3xl font-bold mb-6 text-center">
        Recent Achievements
      </h3>
      <div className="space-y-4">
        {achievements.map((achievement, idx) => (
          <AchievementCard key={idx} achievement={achievement} />
        ))}
      </div>
    </Card>
  );
}

// Extracted Badges Section Component
function BadgesSection({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) return null;

  return (
    <Card variant="child">
      <h3 className="text-3xl font-bold mb-6 text-center">Special Badges</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {badges.map((badge) => (
          <BadgeCard key={badge.id} badge={badge} />
        ))}
      </div>
    </Card>
  );
}

// Extracted Header Section Component
function RewardsHeader() {
  return (
    <div className="space-y-8">
      <Link to="/child/home">
        <Button size="child" className="flex items-center gap-2">
          <Home size={24} />
          <span>Home</span>
        </Button>
      </Link>

      <div className="text-center">
        <h2 className="text-4xl font-bold text-primary mb-4">
          You&apos;re doing great! 🎉
        </h2>
        <p className="text-2xl text-muted-foreground">
          Keep practicing to earn more stars!
        </p>
      </div>
    </div>
  );
}

// Extracted Stats Grid Component
function StatsGrid({
  totalStars,
  streak,
  perfectWords,
}: {
  totalStars: number;
  streak: number;
  perfectWords: number;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatsCard
        value={totalStars}
        label="Total Stars"
        icon={Trophy}
        color="secondary"
      />
      <StatsCard value={streak} label="Day Streak" icon={Zap} color="accent" />
      <StatsCard
        value={perfectWords}
        label="Perfect Words"
        icon={Target}
        color="secondary"
      />
    </div>
  );
}

// Extracted Rewards Content Component
function RewardsContent({
  totalStars,
  streak,
  perfectWords,
  achievements,
  badges,
}: {
  totalStars: number;
  streak: number;
  perfectWords: number;
  achievements: Array<{
    title: string;
    description: string;
    icon: string;
    color: string;
  }>;
  badges: Badge[];
}) {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <RewardsHeader />

      <StatsGrid
        totalStars={totalStars}
        streak={streak}
        perfectWords={perfectWords}
      />

      <StarsGrid totalStars={totalStars} />

      <AchievementsSection achievements={achievements} />

      <BadgesSection badges={badges} />
    </div>
  );
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

  // Calculate perfect words (words where the first attempt was correct)
  const { data: perfectWordsCount } = useQuery({
    queryKey: ["perfect-words", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return 0;

      // Get ALL attempts (both correct and incorrect) to properly identify first attempts
      const { data: attempts } = await supabase
        .from("attempts")
        .select("word_id, started_at, correct")
        .eq("child_id", profile.id)
        .order("started_at", { ascending: true });

      if (!attempts || attempts.length === 0) return 0;

      // Group by word_id and collect all attempts for each word
      const wordAttemptsMap = new Map<
        string,
        Array<{ started_at: string; correct: boolean }>
      >();

      attempts.forEach((attempt) => {
        if (!attempt.word_id || !attempt.started_at) return;

        if (!wordAttemptsMap.has(attempt.word_id)) {
          wordAttemptsMap.set(attempt.word_id, []);
        }
        const wordAttempts = wordAttemptsMap.get(attempt.word_id);
        if (wordAttempts) {
          wordAttempts.push({
            started_at: attempt.started_at,
            correct: attempt.correct,
          });
        }
      });

      // Count words where the first attempt (earliest started_at) was correct
      let perfectCount = 0;
      wordAttemptsMap.forEach((wordAttempts) => {
        // Sort by started_at ascending to ensure we get the first attempt
        wordAttempts.sort(
          (a, b) =>
            new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
        );

        // Check if the first attempt was correct
        if (wordAttempts[0]?.correct === true) {
          perfectCount++;
        }
      });

      return perfectCount;
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
      <RewardsContent
        totalStars={totalStars}
        streak={streak}
        perfectWords={perfectWords}
        achievements={achievements}
        badges={badges}
      />
    </AppShell>
  );
}
