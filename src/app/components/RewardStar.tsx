import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RewardStarProps {
  filled?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap = {
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64,
};

export function RewardStar({
  filled = false,
  size = "md",
  className,
}: RewardStarProps) {
  return (
    <Star
      size={sizeMap[size]}
      className={cn(
        "transition-all",
        filled
          ? "fill-accent text-accent drop-shadow-md"
          : "fill-none text-muted",
        className
      )}
    />
  );
}
