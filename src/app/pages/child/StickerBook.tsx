import { useEffect, useState } from "react";
import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { useAuth } from "@/app/hooks/useAuth";
import { supabase } from "@/app/supabase";
import { Award, Star, Lock } from "lucide-react";
import { logger } from "@/lib/logger";
import type { Tables } from "@/types/database.types";

type Badge = Tables<"badges">;

// Badge Requirements Display Component
function BadgeRequirements({
  earned,
  canEarn,
  requiredStars,
}: {
  earned: boolean;
  canEarn: boolean;
  requiredStars: number;
}) {
  if (earned) {
    return (
      <div className="text-sm text-secondary-foreground font-semibold flex items-center justify-center gap-1">
        <Award size={16} />
        Earned!
      </div>
    );
  }

  if (requiredStars > 0) {
    return (
      <div className="flex items-center justify-center gap-1 text-sm">
        <Star className="text-secondary fill-current" size={16} />
        <span
          className={
            canEarn
              ? "text-secondary-foreground font-semibold"
              : "text-muted-foreground"
          }
        >
          {requiredStars} stars
          {canEarn && " - Ready!"}
        </span>
      </div>
    );
  }

  return null;
}

// Badge Icon Display Component
function BadgeIcon({
  earned,
  canEarn,
  icon,
}: {
  earned: boolean;
  canEarn: boolean;
  icon: string;
}) {
  return (
    <div className="relative">
      <div
        className={`w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 mx-auto mb-3 sm:mb-4 rounded-full flex items-center justify-center text-3xl sm:text-4xl md:text-5xl ${
          earned
            ? "bg-primary/20 shadow-lg"
            : canEarn
              ? "bg-secondary/20"
              : "bg-muted"
        }`}
      >
        {earned || canEarn ? (
          icon
        ) : (
          <Lock className="text-muted-foreground" size={24} />
        )}
      </div>

      {earned && (
        <div className="absolute -top-1 sm:-top-2 -right-1 sm:-right-2">
          <Award className="text-secondary fill-secondary/20" size={24} />
        </div>
      )}
    </div>
  );
}

// Extracted Badge Card Component
function BadgeCard({
  badge,
  earned,
  canEarn,
}: {
  badge: Badge;
  earned: boolean;
  canEarn: boolean;
}) {
  return (
    <Card
      className={`text-center transition-all hover:scale-105 ${
        earned
          ? "bg-primary/10 border-2 border-primary"
          : canEarn
            ? "bg-secondary/10 border-2 border-secondary"
            : "bg-muted/50 opacity-60"
      }`}
    >
      <BadgeIcon earned={earned} canEarn={canEarn} icon={badge.icon} />

      <h3
        className={`font-bold text-base sm:text-lg mb-1 ${
          earned ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {badge.name}
      </h3>
      <p
        className={`text-xs sm:text-sm mb-2 sm:mb-3 ${
          earned ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {badge.description}
      </p>

      <BadgeRequirements
        earned={earned}
        canEarn={canEarn}
        requiredStars={badge.required_stars || 0}
      />
    </Card>
  );
}

// Extracted Stats Card Component
function StatsCard({
  value,
  label,
}: {
  value: number | string;
  label: string;
}) {
  return (
    <Card className="text-center p-3 sm:p-4">
      <div className="text-2xl sm:text-3xl font-bold text-primary">{value}</div>
      <div className="text-xs sm:text-sm text-muted-foreground mt-1">
        {label}
      </div>
    </Card>
  );
}

// Extracted Badge Stats Component
function BadgeStatsGrid({
  earnedCount,
  totalCount,
}: {
  earnedCount: number;
  totalCount: number;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
      <StatsCard value={earnedCount} label="Earned" />
      <Card className="text-center p-3 sm:p-4">
        <div className="text-2xl sm:text-3xl font-bold text-muted-foreground">
          {totalCount - earnedCount}
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground mt-1">
          Locked
        </div>
      </Card>
      <Card className="text-center p-3 sm:p-4">
        <div className="text-2xl sm:text-3xl font-bold text-secondary">
          {Math.round((earnedCount / totalCount) * 100)}%
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground mt-1">
          Complete
        </div>
      </Card>
      <Card className="text-center p-3 sm:p-4">
        <div className="text-2xl sm:text-3xl font-bold text-accent">
          {totalCount}
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground mt-1">
          Total
        </div>
      </Card>
    </div>
  );
}

// Extracted Empty State Component
function EmptyBadgeState() {
  return (
    <Card className="text-center py-12">
      <Award className="text-muted-foreground mx-auto mb-4" size={64} />
      <h3 className="text-2xl font-bold mb-2">Start Your Collection!</h3>
      <p className="text-muted-foreground text-lg">
        Practice spelling to earn your first sticker
      </p>
    </Card>
  );
}

// Extracted Header Component
function StickerBookHeader({ totalStars }: { totalStars: number }) {
  return (
    <Card className="child-card bg-gradient-to-br from-secondary-100 to-secondary-200 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
          My Sticker Book
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-muted-foreground">
          Collect stickers by practicing!
        </p>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 bg-card px-4 py-3 sm:px-6 sm:py-4 rounded-2xl shadow-lg">
        <Star className="text-secondary fill-current" size={36} />
        <div>
          <div className="text-3xl sm:text-4xl font-bold">{totalStars}</div>
          <div className="text-xs sm:text-sm text-muted-foreground">
            Total Stars
          </div>
        </div>
      </div>
    </Card>
  );
}

// Extracted Badges Grid Component
function BadgesGrid({
  badges,
  isBadgeEarned,
  canEarnBadge,
}: {
  badges: Badge[];
  isBadgeEarned: (badge: Badge) => boolean;
  canEarnBadge: (badge: Badge) => boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
      {badges.map((badge) => {
        const earned = isBadgeEarned(badge);
        const canEarn = canEarnBadge(badge);

        return (
          <BadgeCard
            key={badge.id}
            badge={badge}
            earned={earned}
            canEarn={canEarn}
          />
        );
      })}
    </div>
  );
}

// Extracted Sticker Book Content Component
function StickerBookContent({
  totalStars,
  badges,
  earnedBadges,
  isBadgeEarned,
  canEarnBadge,
}: {
  totalStars: number;
  badges: Badge[];
  earnedBadges: Set<string>;
  isBadgeEarned: (badge: Badge) => boolean;
  canEarnBadge: (badge: Badge) => boolean;
}) {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <StickerBookHeader totalStars={totalStars} />

      <BadgeStatsGrid
        earnedCount={earnedBadges.size}
        totalCount={badges.length}
      />

      <BadgesGrid
        badges={badges}
        isBadgeEarned={isBadgeEarned}
        canEarnBadge={canEarnBadge}
      />

      {earnedBadges.size === 0 && <EmptyBadgeState />}
    </div>
  );
}

export function StickerBook() {
  const { profile } = useAuth();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<Set<string>>(new Set());
  const [totalStars, setTotalStars] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!profile?.id) return;

      try {
        // Load all badges
        const { data: badgesData, error: badgesError } = await supabase
          .from("badges")
          .select("*")
          .order("required_stars", { ascending: true });

        if (badgesError) throw badgesError;

        // Load user's earned badges
        const { data: userBadgesData, error: userBadgesError } = await supabase
          .from("user_badges")
          .select("badge_id")
          .eq("child_id", profile.id);

        if (userBadgesError) throw userBadgesError;

        // Load total stars
        const { data: rewardsData, error: rewardsError } = await supabase
          .from("rewards")
          .select("stars_total")
          .eq("child_id", profile.id)
          .single();

        if (rewardsError?.code !== "PGRST116") throw rewardsError;

        setBadges(badgesData || []);
        setEarnedBadges(
          new Set(userBadgesData?.map((ub) => ub.badge_id) || [])
        );
        setTotalStars(rewardsData?.stars_total || 0);
      } catch (err) {
        logger.error("Error loading sticker book data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [profile]);

  const isBadgeEarned = (badge: Badge) => {
    return earnedBadges.has(badge.id);
  };

  const canEarnBadge = (badge: Badge) => {
    if (!badge.required_stars || badge.required_stars === 0) return false; // Criteria-based, not star-based
    return totalStars >= badge.required_stars;
  };

  // Early return for loading state
  if (isLoading) {
    return (
      <AppShell title="Sticker Book" variant="child">
        <div className="text-center py-12">
          <div className="text-2xl text-foreground">Loading...</div>
        </div>
      </AppShell>
    );
  }

  // Main content
  return (
    <AppShell title="Sticker Book" variant="child">
      <StickerBookContent
        totalStars={totalStars}
        badges={badges}
        earnedBadges={earnedBadges}
        isBadgeEarned={isBadgeEarned}
        canEarnBadge={canEarnBadge}
      />
    </AppShell>
  );
}
