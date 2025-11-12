import React from "react";

interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
}

/**
 * SkipLink component provides a keyboard-accessible link for bypassing navigation.
 * The link is visually hidden by default but becomes visible when focused via keyboard.
 * When clicked, it programmatically moves focus to the target element via the href.
 *
 * @example
 * <SkipLink href="#main-content">Skip to main content</SkipLink>
 */
export function SkipLink({ href, children }: SkipLinkProps) {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const target = document.querySelector(href);
    if (target instanceof HTMLElement) {
      target.focus();
    }
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className="skip-link sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-lg focus:outline-none"
    >
      {children}
    </a>
  );
}
