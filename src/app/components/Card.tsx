import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Card component with support for interactive (clickable) cards.
 *
 * When used as an interactive element (with onClick), the component:
 * - Accepts a role="button" prop for semantic meaning
 * - Supports tabIndex={0} to make it keyboard accessible
 * - Handles Enter and Space key presses to trigger onClick
 * - Adds a cursor-pointer class for visual feedback
 *
 * @example
 * // Static card
 * <Card>Content here</Card>
 *
 * // Interactive card (clickable, keyboard accessible)
 * <Card role="button" tabIndex={0} onClick={handleClick}>
 *   Click me
 * </Card>
 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "parent" | "child";
  role?: string;
  tabIndex?: number;
  onClick?: () => void;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant = "parent",
      children,
      role,
      tabIndex,
      onClick,
      ...props
    },
    ref
  ) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (onClick && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        onClick();
      }
    };

    return (
      <div
        ref={ref}
        role={role}
        tabIndex={tabIndex}
        onKeyDown={onClick ? handleKeyDown : undefined}
        onClick={onClick}
        className={cn(
          "bg-card text-card-foreground border border-border",
          variant === "child" ? "child-card" : "parent-card",
          onClick && "cursor-pointer",
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
