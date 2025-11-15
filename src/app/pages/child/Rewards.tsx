import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { Home, ShoppingBag, Package, Flame } from "lucide-react";
import { useAuth } from "@/app/hooks/useAuth";
import { Link } from "react-router-dom";
import { Button } from "@/app/components/Button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  useRewardsCatalog,
  useUserRewards,
  usePurchaseReward,
  useEquipReward,
} from "@/app/api/supa";
import { useOnline } from "@/app/hooks/useOnline";
import confetti from "canvas-confetti";
import { logger } from "@/lib/logger";

type TabType = "shop" | "my-stuff" | "streaks";

// Tab Navigation Component
function TabNavigation({
  activeTab,
  onTabChange,
}: {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}) {
  return (
    <div className="flex gap-2 mb-6">
      <Button
        size="child"
        variant={activeTab === "shop" ? "default" : "outline"}
        onClick={() => onTabChange("shop")}
        className="flex-1 flex items-center justify-center gap-2"
      >
        <ShoppingBag size={24} />
        <span>Shop</span>
      </Button>
      <Button
        size="child"
        variant={activeTab === "my-stuff" ? "default" : "outline"}
        onClick={() => onTabChange("my-stuff")}
        className="flex-1 flex items-center justify-center gap-2"
      >
        <Package size={24} />
        <span>My Stuff</span>
      </Button>
      <Button
        size="child"
        variant={activeTab === "streaks" ? "default" : "outline"}
        onClick={() => onTabChange("streaks")}
        className="flex-1 flex items-center justify-center gap-2"
      >
        <Flame size={24} />
        <span>Streaks</span>
      </Button>
    </div>
  );
}

// Reward Card Component for Shop
function RewardCard({
  reward,
  onPurchase,
  userStars,
  isOwned,
  isPurchasing,
  isOnline,
}: {
  reward: {
    id: string;
    name: string;
    description: string | null;
    cost_stars: number;
    icon: string | null;
    type: string;
  };
  onPurchase: () => void;
  userStars: number;
  isOwned: boolean;
  isPurchasing: boolean;
  isOnline: boolean;
}) {
  const canAfford = userStars >= reward.cost_stars;
  const canPurchase = canAfford && !isOwned && isOnline;

  return (
    <Card variant="child">
      <div className="text-center space-y-4">
        <div className="text-6xl">{reward.icon || "🎁"}</div>
        <h3 className="text-2xl font-bold">{reward.name}</h3>
        {reward.description && (
          <p className="text-lg text-muted-foreground">{reward.description}</p>
        )}
        <div className="flex items-center justify-center gap-2 text-2xl font-bold text-primary">
          <span>⭐</span>
          <span>{reward.cost_stars}</span>
        </div>
        {isOwned ? (
          <div className="text-xl text-green-600 font-semibold">✓ Owned</div>
        ) : (
          <Button
            size="child"
            onClick={onPurchase}
            disabled={!canPurchase || isPurchasing}
            className="w-full"
          >
            {!isOnline
              ? "Connect to Purchase"
              : !canAfford
                ? "Not Enough Stars"
                : isPurchasing
                  ? "Purchasing..."
                  : "Buy Now"}
          </Button>
        )}
      </div>
    </Card>
  );
}

// Shop Tab Component
function ShopTab({ userId }: { userId: string }) {
  const [selectedType, setSelectedType] = useState<
    "all" | "avatar" | "theme" | "badge" | "coupon"
  >("all");
  const isOnline = useOnline();
  const { profile } = useAuth();

  const { data: catalog = [] } = useRewardsCatalog(
    selectedType === "all" ? undefined : selectedType
  );
  const { data: userRewards = [] } = useUserRewards(userId);
  const purchaseReward = usePurchaseReward();

  const ownedRewardIds = new Set(
    userRewards.map((r: { reward_id: string }) => r.reward_id)
  );
  const userStars = profile?.stars || 0;

  const handlePurchase = async (rewardId: string, rewardName: string) => {
    if (!isOnline) return;

    try {
      await purchaseReward.mutateAsync({
        userId,
        rewardId,
      });

      // Confetti animation on success
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#FFD700", "#FFA500", "#FF6347"],
      });

      // Success message
      logger.info(`Purchased ${rewardName}!`);
    } catch (error) {
      logger.error("Purchase failed. Please try again.", error);
    }
  };

  return (
    <div className="space-y-6">
      {!isOnline && (
        <div className="bg-warning/20 p-6 rounded-lg border-2 border-warning">
          <p className="text-xl text-center">
            ⚠️ You&apos;re offline. Connect to purchase rewards.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-3xl font-bold flex items-center gap-2">
          <span>⭐</span>
          <span>{userStars} Stars</span>
        </div>
      </div>

      {/* Type Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {["all", "avatar", "theme", "badge", "coupon"].map((type) => (
          <Button
            key={type}
            size="sm"
            variant={selectedType === type ? "default" : "outline"}
            onClick={() => setSelectedType(type as typeof selectedType)}
            className="whitespace-nowrap"
          >
            {type === "all"
              ? "All"
              : type.charAt(0).toUpperCase() + type.slice(1)}
          </Button>
        ))}
      </div>

      {/* Rewards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {catalog.map(
          (reward: {
            id: string;
            name: string;
            description: string | null;
            cost_stars: number;
            icon: string | null;
            type: string;
          }) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              onPurchase={() => handlePurchase(reward.id, reward.name)}
              userStars={userStars}
              isOwned={ownedRewardIds.has(reward.id)}
              isPurchasing={purchaseReward.isPending}
              isOnline={isOnline}
            />
          )
        )}
      </div>

      {catalog.length === 0 && (
        <Card variant="child">
          <p className="text-2xl text-center text-muted-foreground py-12">
            No rewards available in this category
          </p>
        </Card>
      )}
    </div>
  );
}

// Owned Reward Card Component
function OwnedRewardCard({
  userReward,
  profile,
  equipReward,
  onEquip,
}: {
  userReward: {
    id: string;
    reward_id: string;
    reward?: {
      id: string;
      name: string;
      description: string | null;
      icon: string | null;
      type: string;
    };
  };
  profile: {
    equipped_avatar?: string | null;
    equipped_theme?: string | null;
  } | null;
  equipReward: { isPending: boolean };
  onEquip: (rewardId: string) => void;
}) {
  const reward = userReward.reward;
  if (!reward) return null;

  const isEquipped =
    (reward.type === "avatar" && profile?.equipped_avatar === reward.id) ||
    (reward.type === "theme" && profile?.equipped_theme === reward.id);

  return (
    <Card variant="child">
      <div className="text-center space-y-4">
        <div className="text-6xl">{reward.icon || "🎁"}</div>
        <h3 className="text-2xl font-bold">{reward.name}</h3>
        {reward.description && (
          <p className="text-lg text-muted-foreground">{reward.description}</p>
        )}
        {(reward.type === "avatar" || reward.type === "theme") && (
          <Button
            size="child"
            onClick={() => onEquip(reward.id)}
            disabled={isEquipped || equipReward.isPending}
            variant={isEquipped ? "secondary" : "default"}
            className="w-full"
          >
            {isEquipped
              ? "✓ Equipped"
              : equipReward.isPending
                ? "Equipping..."
                : "Equip"}
          </Button>
        )}
        {reward.type === "badge" && (
          <div className="text-xl text-primary font-semibold">Badge</div>
        )}
        {reward.type === "coupon" && (
          <div className="text-xl text-accent font-semibold">
            Special Coupon
          </div>
        )}
      </div>
    </Card>
  );
}

// My Stuff Tab Component
function MyStuffTab({ userId }: { userId: string }) {
  const { profile } = useAuth();
  const { data: userRewards = [] } = useUserRewards(userId);
  const equipReward = useEquipReward();

  const handleEquip = async (rewardId: string) => {
    try {
      await equipReward.mutateAsync({
        userId,
        rewardId,
      });
    } catch (error) {
      logger.error("Failed to equip item. Please try again.", error);
    }
  };

  if (userRewards.length === 0) {
    return (
      <Card variant="child">
        <div className="text-center py-12 space-y-4">
          <div className="text-6xl">🎁</div>
          <h3 className="text-3xl font-bold">No Rewards Yet</h3>
          <p className="text-xl text-muted-foreground">
            Visit the Shop to get your first reward!
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {userRewards.map(
          (userReward: {
            id: string;
            reward_id: string;
            reward?: {
              id: string;
              name: string;
              description: string | null;
              icon: string | null;
              type: string;
            };
          }) => (
            <OwnedRewardCard
              key={userReward.id}
              userReward={userReward}
              profile={profile}
              equipReward={equipReward}
              onEquip={handleEquip}
            />
          )
        )}
      </div>
    </div>
  );
}

// Streak Milestone Item Component
function StreakMilestoneItem({
  milestone,
  streakDays,
}: {
  milestone: { days: number; stars: number; emoji: string };
  streakDays: number;
}) {
  const achieved = streakDays >= milestone.days;
  return (
    <div
      className={cn(
        "p-6 rounded-xl border-2 flex items-center justify-between",
        achieved ? "bg-primary/10 border-primary" : "bg-muted/50 border-border"
      )}
    >
      <div className="flex items-center gap-4">
        <span className="text-4xl">{milestone.emoji}</span>
        <div>
          <p className="text-2xl font-bold">
            {milestone.days} Day{milestone.days > 1 ? "s" : ""}
          </p>
          <p className="text-lg text-muted-foreground">
            +{milestone.stars} bonus stars
          </p>
        </div>
      </div>
      {achieved && <div className="text-3xl text-primary font-bold">✓</div>}
    </div>
  );
}

// Current Streak Display Component
function CurrentStreakDisplay({ streakDays }: { streakDays: number }) {
  return (
    <Card variant="child">
      <div className="text-center space-y-4">
        <div className="text-8xl">🔥</div>
        <h2 className="text-6xl font-bold text-primary">{streakDays}</h2>
        <p className="text-3xl font-semibold">
          {streakDays === 1 ? "Day Streak" : "Days Streak"}
        </p>
        <p className="text-xl text-muted-foreground">
          Keep practicing every day!
        </p>
      </div>
    </Card>
  );
}

// Bonus Stars Display Component
function BonusStarsDisplay({ bonusStars }: { bonusStars: number }) {
  return (
    <Card variant="child">
      <h3 className="text-3xl font-bold mb-4 text-center">
        Bonus Stars from Streaks
      </h3>
      <div className="text-center space-y-2">
        <div className="text-5xl font-bold text-primary flex items-center justify-center gap-2">
          <span>⭐</span>
          <span>{bonusStars}</span>
        </div>
        <p className="text-xl text-muted-foreground">
          Bonus stars earned from streaks!
        </p>
      </div>
    </Card>
  );
}

// Streak Milestones List Component
function StreakMilestonesList({
  streakMilestones,
  streakDays,
}: {
  streakMilestones: Array<{ days: number; stars: number; emoji: string }>;
  streakDays: number;
}) {
  return (
    <Card variant="child">
      <h3 className="text-3xl font-bold mb-6 text-center">Streak Milestones</h3>
      <div className="space-y-4">
        {streakMilestones.map((milestone) => (
          <StreakMilestoneItem
            key={milestone.days}
            milestone={milestone}
            streakDays={streakDays}
          />
        ))}
      </div>
    </Card>
  );
}

// Streaks Tab Component
function StreaksTab() {
  const { profile } = useAuth();

  const streakDays = profile?.streak_days || 0;

  // Calculate bonus stars from streaks
  const bonusStars =
    Math.floor(streakDays / 3) * 5 + // +5 for every 3 days
    Math.floor(streakDays / 7) * 5 + // +10 total for every 7 days (5 + previous 5)
    Math.floor(streakDays / 30) * 30; // +50 total for every 30 days

  const streakMilestones = [
    { days: 3, stars: 5, emoji: "🔥" },
    { days: 7, stars: 10, emoji: "⚡" },
    { days: 14, stars: 20, emoji: "💫" },
    { days: 30, stars: 50, emoji: "🌟" },
    { days: 60, stars: 100, emoji: "💎" },
    { days: 90, stars: 150, emoji: "👑" },
  ];

  return (
    <div className="space-y-6">
      <CurrentStreakDisplay streakDays={streakDays} />
      <BonusStarsDisplay bonusStars={bonusStars} />
      <StreakMilestonesList
        streakMilestones={streakMilestones}
        streakDays={streakDays}
      />
    </div>
  );
}

// Main Rewards Content Component
function RewardsContent({
  profile,
  activeTab,
  onTabChange,
}: {
  profile: { id: string };
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}) {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Link to="/child/home">
        <Button size="child" className="flex items-center gap-2">
          <Home size={24} />
          <span>Home</span>
        </Button>
      </Link>

      <TabNavigation activeTab={activeTab} onTabChange={onTabChange} />

      {activeTab === "shop" && <ShopTab userId={profile.id} />}
      {activeTab === "my-stuff" && <MyStuffTab userId={profile.id} />}
      {activeTab === "streaks" && <StreaksTab />}
    </div>
  );
}

export function Rewards() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("shop");

  if (!profile) {
    return (
      <AppShell title="My Rewards" variant="child">
        <div className="max-w-4xl mx-auto">
          <Card variant="child">
            <p className="text-2xl text-center py-12">Loading...</p>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="My Rewards" variant="child">
      <RewardsContent
        profile={profile}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </AppShell>
  );
}
