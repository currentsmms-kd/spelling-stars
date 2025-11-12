import React, { useRef, useEffect } from "react";

interface FocusTrapProps {
  children: React.ReactNode;
  active: boolean;
  onEscape?: () => void;
}

/**
 * FocusTrap component manages focus within a modal or dialog.
 * When active, it ensures keyboard focus stays within the trapped element,
 * cycling back to the first focusable element when Tab is pressed on the last one.
 * Supports Escape key to close the modal.
 *
 * @example
 * <FocusTrap active={isOpen} onEscape={handleClose}>
 *   <Modal>...</Modal>
 * </FocusTrap>
 */
export function FocusTrap({ children, active, onEscape }: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  useEffect(() => {
    if (!active) return;

    // Store the previously focused element to restore later
    previousActiveElement.current = document.activeElement;

    const container = containerRef.current;
    if (!container) return;

    // Get all focusable elements
    const focusableSelectors = [
      "button:not([disabled])",
      "[href]",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(", ");

    const getFocusableElements = () => {
      return Array.from(container.querySelectorAll(focusableSelectors)).filter(
        (element) => {
          const style = window.getComputedStyle(element);
          return style.visibility !== "hidden" && style.display !== "none";
        }
      ) as HTMLElement[];
    };

    let focusableElements = getFocusableElements();

    // Focus the first element
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      focusableElements = getFocusableElements();

      if (event.key === "Escape") {
        event.preventDefault();
        onEscape?.();
        return;
      }

      if (event.key === "Tab") {
        const activeElement = document.activeElement as HTMLElement;
        const activeIndex = focusableElements.indexOf(activeElement);

        if (event.shiftKey) {
          // Shift+Tab
          if (activeIndex <= 0) {
            event.preventDefault();
            focusableElements[focusableElements.length - 1].focus();
          }
        } else {
          // Tab
          if (activeIndex >= focusableElements.length - 1) {
            event.preventDefault();
            focusableElements[0].focus();
          }
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("keydown", handleKeyDown);

      // Restore focus to the previously focused element
      if (
        previousActiveElement.current &&
        previousActiveElement.current instanceof HTMLElement
      ) {
        previousActiveElement.current.focus();
      }
    };
  }, [active, onEscape]);

  return (
    <div ref={containerRef} role="group">
      {children}
    </div>
  );
}
