import { cn } from "@/lib/utils";
import { AVATARS, getAvatarById } from "@/app/lib/avatars";

interface AvatarSelectorProps {
  selectedAvatar?: string;
  onSelect: (avatarId: string) => void;
  size?: "sm" | "md" | "lg";
}

export function AvatarSelector({
  selectedAvatar,
  onSelect,
  size = "md",
}: AvatarSelectorProps) {
  const sizeClasses = {
    sm: "text-2xl w-12 h-12",
    md: "text-3xl w-16 h-16",
    lg: "text-5xl w-24 h-24",
  };

  const categories = Array.from(new Set(AVATARS.map((a) => a.category)));

  return (
    <div className="space-y-6">
      {categories.map((category) => {
        const categoryAvatars = AVATARS.filter((a) => a.category === category);
        return (
          <div key={category}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
              {category}
            </h3>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {categoryAvatars.map((avatar) => (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => onSelect(avatar.id)}
                  className={cn(
                    "rounded-lg border-2 transition-all hover:scale-110 hover:shadow-lg flex items-center justify-center",
                    sizeClasses[size],
                    selectedAvatar === avatar.id
                      ? "border-primary bg-primary/10 shadow-md scale-105"
                      : "border-border bg-card hover:border-primary/50"
                  )}
                  title={avatar.name}
                  aria-label={`Select ${avatar.name} avatar`}
                >
                  <span className="select-none">{avatar.emoji}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface AvatarDisplayProps {
  avatarId?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function AvatarDisplay({
  avatarId,
  size = "md",
  className,
}: AvatarDisplayProps) {
  const avatar = getAvatarById(avatarId);

  const sizeClasses = {
    xs: "text-xl w-8 h-8",
    sm: "text-2xl w-12 h-12",
    md: "text-3xl w-16 h-16",
    lg: "text-5xl w-24 h-24",
    xl: "text-7xl w-32 h-32",
  };

  return (
    <div
      className={cn(
        "rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center",
        sizeClasses[size],
        className
      )}
      title={avatar?.name || "No avatar"}
    >
      {avatar ? (
        <span className="select-none">{avatar.emoji}</span>
      ) : (
        <span className="text-muted-foreground select-none">👤</span>
      )}
    </div>
  );
}
