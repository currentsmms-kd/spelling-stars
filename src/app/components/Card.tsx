import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Card component with support for interactive (clickable) cards.
 *
 * When used as an interactive element (with onClick), the component:
 * - Requires role and tabIndex props for accessibility (enforced by TypeScript)
 * - Provides default values: role="button" and tabIndex={0} if omitted at runtime
 * - Handles Enter and Space key presses to trigger onClick
 * - Adds a cursor-pointer class for visual feedback
 *
 * @example
 * // Static card
 * <Card>Content here</Card>
 *
 * // Interactive card (clickable, keyboard accessible)
 * // TypeScript enforces role and tabIndex when onClick is provided
 * <Card role="button" tabIndex={0} onClick={handleClick}>
 *   Click me
 * </Card>
 */

// Base props shared by all card variants
type BaseCardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "parent" | "child";
};

// Non-interactive card: onClick cannot be provided
type NonInteractiveCardProps = BaseCardProps & {
  onClick?: never;
  role?: string;
  tabIndex?: number;
};

// Interactive card: onClick requires role and tabIndex
type InteractiveCardProps = BaseCardProps & {
  onClick: () => void;
  role: string;
  tabIndex: number;
};

// Union type: card is either interactive (with required accessibility props) or non-interactive
export type CardProps = NonInteractiveCardProps | InteractiveCardProps;

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
    // Development warning: if onClick is provided without role/tabIndex, warn developer
    if (process.env.NODE_ENV === "development" && onClick) {
      if (!role || tabIndex === undefined) {
        console.warn(
          "Card: onClick provided without explicit role/tabIndex; using defaults (role='button', tabIndex=0) for accessibility."
        );
      }
    }

    // Apply defaults for interactive cards to ensure accessibility
    const effectiveRole = onClick ? role || "button" : role;
    const effectiveTabIndex = onClick ? (tabIndex ?? 0) : tabIndex;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (onClick && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        onClick();
      }
    };

    return (
      <div
        ref={ref}
        role={effectiveRole}
        tabIndex={effectiveTabIndex}
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
