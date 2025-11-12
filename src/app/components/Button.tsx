import { type VariantProps } from "class-variance-authority";
import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./buttonVariants";

/**
 * Button component with CVA styling and full ARIA support.
 *
 * The component forwards all HTML attributes including ARIA attributes,
 * allowing for flexible accessibility customization.
 *
 * @example
 * // Basic button
 * <Button>Click me</Button>
 *
 * // Button with ARIA label for icon-only buttons
 * <Button aria-label="Close dialog">X</Button>
 *
 * // Button with ARIA description
 * <Button aria-label="Delete item" aria-describedby="delete-confirmation">
 *   Delete
 * </Button>
 *
 * // Button with ARIA disabled state (for custom disabled logic)
 * <Button aria-disabled={isLoading}>{isLoading ? 'Loading...' : 'Submit'}</Button>
 */
export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => {
    return (
      <button
        type={type}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
