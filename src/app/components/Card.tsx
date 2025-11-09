import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "parent" | "child";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "parent", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-white border",
          variant === "child" ? "child-card" : "parent-card",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
