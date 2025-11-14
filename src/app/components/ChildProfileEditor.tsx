import { useState } from "react";
import { Card } from "./Card";
import { Button } from "./Button";
import { AvatarSelector, AvatarDisplay } from "./AvatarSelector";
import { FAVORITE_COLORS } from "@/app/lib/avatars";
import { cn } from "@/lib/utils";
import { Sparkles, Calendar, Cake, X } from "lucide-react";
import { useUpdateChildProfile } from "@/app/api/supa";
import { toast } from "react-hot-toast";
import { Toast } from "./Toast";

interface ChildProfileEditorProps {
  childId: string;
  childName: string;
  currentAvatar?: string | null;
  currentAge?: number | null;
  currentBirthday?: string | null;
  currentFavoriteColor?: string | null;
  onClose: () => void;
}

export function ChildProfileEditor({
  childId,
  childName,
  currentAvatar,
  currentAge,
  currentBirthday,
  currentFavoriteColor,
  onClose,
}: ChildProfileEditorProps) {
  const [selectedAvatar, setSelectedAvatar] = useState(currentAvatar || "");
  const [age, setAge] = useState(currentAge?.toString() || "");
  const [birthday, setBirthday] = useState(currentBirthday || "");
  const [favoriteColor, setFavoriteColor] = useState(
    currentFavoriteColor || ""
  );

  const updateProfile = useUpdateChildProfile();

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({
        childId,
        updates: {
          equipped_avatar: selectedAvatar || null,
          age: age ? parseInt(age) : null,
          birthday: birthday || null,
          favorite_color: favoriteColor || null,
        },
      });

      toast.custom((t) => (
        <Toast
          type="success"
          message="Profile updated! 🎉"
          onClose={() => toast.dismiss(t.id)}
        />
      ));

      onClose();
    } catch (error) {
      toast.custom((t) => (
        <Toast
          type="error"
          message={`Failed to update profile: ${error instanceof Error ? error.message : "Unknown error"}`}
          onClose={() => toast.dismiss(t.id)}
        />
      ));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <Card className="relative">
          {/* Header with sparkles */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Sparkles className="text-primary" size={32} />
              <div>
                <h2 className="text-2xl font-bold">
                  Customize {childName}'s Profile
                </h2>
                <p className="text-sm text-muted-foreground">
                  Make it special and unique! ✨
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="rounded-full"
            >
              <X size={24} />
            </Button>
          </div>

          {/* Avatar Preview */}
          <div className="flex flex-col items-center gap-4 mb-8 p-6 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-xl border-2 border-primary/20">
            <AvatarDisplay avatarId={selectedAvatar} size="xl" />
            <div className="text-center">
              <p className="font-semibold text-lg">{childName}</p>
              {age && <p className="text-muted-foreground">Age {age}</p>}
            </div>
          </div>

          {/* Avatar Selection */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-2">
              <Sparkles className="text-primary" size={20} />
              <h3 className="text-lg font-semibold">Choose Your Avatar</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Pick your favorite character! Click to select.
            </p>
            <AvatarSelector
              selectedAvatar={selectedAvatar}
              onSelect={setSelectedAvatar}
              size="md"
            />
          </div>

          {/* Age Input */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-2">
              <Cake className="text-primary" size={20} />
              <h3 className="text-lg font-semibold">How Old Are You?</h3>
            </div>
            <input
              type="number"
              min="3"
              max="18"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Enter your age"
              className="w-full px-4 py-3 border-2 rounded-lg focus:ring-4 focus:ring-primary/20 focus:border-primary bg-input text-lg"
            />
          </div>

          {/* Birthday Input */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="text-primary" size={20} />
              <h3 className="text-lg font-semibold">When's Your Birthday?</h3>
            </div>
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="w-full px-4 py-3 border-2 rounded-lg focus:ring-4 focus:ring-primary/20 focus:border-primary bg-input text-lg"
            />
          </div>

          {/* Favorite Color Selection */}
          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-2">
              <Sparkles className="text-primary" size={20} />
              <h3 className="text-lg font-semibold">
                What's Your Favorite Color?
              </h3>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
              {FAVORITE_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setFavoriteColor(color.id)}
                  className={cn(
                    "w-16 h-16 rounded-xl border-4 transition-all hover:scale-110 hover:shadow-lg flex items-center justify-center",
                    favoriteColor === color.id
                      ? "border-foreground shadow-lg scale-105"
                      : "border-border"
                  )}
                  style={{
                    background:
                      color.id === "rainbow"
                        ? "linear-gradient(135deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7, #ec4899)"
                        : color.hex,
                  }}
                  title={color.name}
                  aria-label={`Select ${color.name}`}
                >
                  {favoriteColor === color.id && (
                    <span className="text-white text-2xl drop-shadow-lg">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={updateProfile.isPending}
              className="flex-1 child-button"
              size="child"
            >
              {updateProfile.isPending ? "Saving..." : "Save Profile 🎉"}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 child-button"
              size="child"
            >
              Cancel
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
