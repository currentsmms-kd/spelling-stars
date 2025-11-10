import { useState } from "react";
import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import { useAuth } from "@/app/hooks/useAuth";
import {
  useUserRewards,
  useAwardStars,
  type RewardsCatalogItem,
} from "@/app/api/supa";
import { supabase } from "@/app/supabase";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Package, Star, Plus, Eye, EyeOff, Gift, Users } from "lucide-react";

// Types
interface CreateCouponFormData {
  name: string;
  description: string;
  costStars: number;
  icon: string;
}

// Reward Card Component
function RewardCard({
  reward,
  onToggleActive,
  isUpdating,
}: {
  reward: RewardsCatalogItem;
  onToggleActive: (id: string, isActive: boolean) => void;
  isUpdating: boolean;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className="text-5xl">{reward.icon}</div>
          <div className="flex-1">
            <h3 className="text-lg font-bold">{reward.name}</h3>
            <p className="text-sm text-muted-foreground">
              {reward.description}
            </p>
            <div className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1 text-primary font-semibold">
                <Star size={16} fill="currentColor" />
                {reward.cost_stars}
              </span>
              <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                {reward.type}
              </span>
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant={reward.is_active ? "default" : "outline"}
          onClick={() => onToggleActive(reward.id, !reward.is_active)}
          disabled={isUpdating}
          className="flex items-center gap-2"
        >
          {reward.is_active ? (
            <>
              <Eye size={16} />
              Active
            </>
          ) : (
            <>
              <EyeOff size={16} />
              Hidden
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

// Create Coupon Form Component
function CreateCouponForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: CreateCouponFormData) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<CreateCouponFormData>({
    name: "",
    description: "",
    costStars: 50,
    icon: "🎁",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card>
      <h3 className="text-xl font-bold mb-4">Create Custom Coupon</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Coupon Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-ring bg-input"
            placeholder="e.g., Movie Night"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-ring bg-input"
            placeholder="e.g., Choose the family movie!"
            rows={3}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Cost (Stars)
            </label>
            <input
              type="number"
              min="1"
              value={formData.costStars}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  costStars: parseInt(e.target.value) || 0,
                })
              }
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-ring bg-input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Icon (Emoji)
            </label>
            <input
              type="text"
              value={formData.icon}
              onChange={(e) =>
                setFormData({ ...formData, icon: e.target.value })
              }
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-ring bg-input text-2xl"
              placeholder="🎁"
              maxLength={2}
              required
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" className="flex-1">
            <Plus size={16} className="mr-2" />
            Create Coupon
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

// Child Rewards View Component
function ChildRewardsCard({ childId }: { childId: string }) {
  const { data: userRewards } = useUserRewards(childId);
  const { data: profile } = useQuery({
    queryKey: ["profile", childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", childId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const awardStars = useAwardStars();
  const [manualStars, setManualStars] = useState(10);

  const handleAwardStars = async () => {
    if (!childId) return;
    await awardStars.mutateAsync({
      userId: childId,
      amount: manualStars,
      reason: "parent_bonus",
    });
    setManualStars(10);
  };

  if (!profile) return null;

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">
              {profile.display_name || "Child"}
            </h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Star size={14} fill="currentColor" className="text-primary" />
              {profile.stars || 0} stars
            </p>
          </div>
          {profile.equipped_avatar && (
            <div className="text-4xl">{profile.equipped_avatar}</div>
          )}
        </div>

        {/* Manual Star Award */}
        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            value={manualStars}
            onChange={(e) => setManualStars(parseInt(e.target.value) || 0)}
            className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ring bg-input"
          />
          <Button
            size="sm"
            onClick={handleAwardStars}
            disabled={awardStars.isPending}
            className="flex items-center gap-2"
          >
            <Gift size={16} />
            Award Stars
          </Button>
        </div>

        {/* Owned Rewards */}
        {userRewards && userRewards.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold mb-2">Owned Rewards</h4>
            <div className="space-y-2">
              {userRewards.map((ur) => (
                <div
                  key={ur.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{ur.reward?.icon}</span>
                    <span>{ur.reward?.name}</span>
                  </div>
                  {ur.equipped && (
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary">
                      Equipped
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// Main Component
export function RewardsManagement() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateCoupon, setShowCreateCoupon] = useState(false);
  const [filterType, setFilterType] = useState<
    "all" | "avatar" | "theme" | "coupon" | "badge"
  >("all");

  // Fetch rewards catalog (including inactive)
  const { data: allRewards, isLoading } = useQuery({
    queryKey: ["rewards-catalog-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rewards_catalog")
        .select("*")
        .order("type", { ascending: true })
        .order("cost_stars", { ascending: true });

      if (error) throw error;
      return data as RewardsCatalogItem[];
    },
  });

  // Fetch all children (for parent)
  const { data: children } = useQuery({
    queryKey: ["children", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("parent_id", profile.id)
        .eq("role", "child");

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  // Toggle reward active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({
      rewardId,
      isActive,
    }: {
      rewardId: string;
      isActive: boolean;
    }) => {
      const { error } = await supabase
        .from("rewards_catalog")
        .update({ is_active: isActive })
        .eq("id", rewardId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rewards-catalog-admin"] });
      queryClient.invalidateQueries({ queryKey: ["rewards-catalog"] });
    },
  });

  // Create custom coupon
  const createCouponMutation = useMutation({
    mutationFn: async (formData: CreateCouponFormData) => {
      const { error } = await supabase.from("rewards_catalog").insert({
        name: formData.name,
        description: formData.description,
        cost_stars: formData.costStars,
        icon: formData.icon,
        type: "coupon",
        is_active: true,
        metadata: { coupon_type: "custom", created_by: profile?.id },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rewards-catalog-admin"] });
      queryClient.invalidateQueries({ queryKey: ["rewards-catalog"] });
      setShowCreateCoupon(false);
    },
  });

  const filteredRewards =
    allRewards?.filter((r) => filterType === "all" || r.type === filterType) ||
    [];

  if (isLoading) {
    return (
      <AppShell title="Rewards Management" variant="parent">
        <div className="text-center py-12">Loading...</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Rewards Management" variant="parent">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Rewards Management</h1>
            <p className="text-muted-foreground">
              Manage rewards catalog and track children's progress
            </p>
          </div>
          <Button
            onClick={() => setShowCreateCoupon(!showCreateCoupon)}
            className="flex items-center gap-2"
          >
            <Plus size={20} />
            Create Coupon
          </Button>
        </div>

        {/* Create Coupon Form */}
        {showCreateCoupon && (
          <CreateCouponForm
            onSubmit={(data) => createCouponMutation.mutate(data)}
            onCancel={() => setShowCreateCoupon(false)}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Rewards Catalog Section */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <Package className="text-primary" size={24} />
                <h2 className="text-xl font-bold">Rewards Catalog</h2>
              </div>

              {/* Filter Buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                {["all", "avatar", "theme", "coupon", "badge"].map((type) => (
                  <Button
                    key={type}
                    size="sm"
                    variant={filterType === type ? "default" : "outline"}
                    onClick={() =>
                      setFilterType(
                        type as "all" | "avatar" | "theme" | "coupon" | "badge"
                      )
                    }
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Button>
                ))}
              </div>

              {/* Rewards List */}
              <div className="space-y-3">
                {filteredRewards.map((reward) => (
                  <RewardCard
                    key={reward.id}
                    reward={reward}
                    onToggleActive={(id, isActive) =>
                      toggleActiveMutation.mutate({ rewardId: id, isActive })
                    }
                    isUpdating={toggleActiveMutation.isPending}
                  />
                ))}
              </div>

              {filteredRewards.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No rewards found for this filter.
                </p>
              )}
            </Card>
          </div>

          {/* Children Overview Section */}
          <div className="space-y-6">
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <Users className="text-primary" size={24} />
                <h2 className="text-xl font-bold">Children</h2>
              </div>

              <div className="space-y-4">
                {children && children.length > 0 ? (
                  children.map((child) => (
                    <ChildRewardsCard key={child.id} childId={child.id} />
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    No children found.
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
