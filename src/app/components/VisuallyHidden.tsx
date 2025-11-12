import React from "react";

interface VisuallyHiddenProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  as?: keyof JSX.IntrinsicElements;
  htmlFor?: string;
}

/**
 * VisuallyHidden component renders content that is hidden visually but accessible to screen readers.
 * Uses the sr-only CSS class pattern to keep content in the accessibility tree while hiding it from view.
 *
 * @example
 * <VisuallyHidden>Screen reader only text</VisuallyHidden>
 * <VisuallyHidden as="label" htmlFor="input">Label for input</VisuallyHidden>
 */
export function VisuallyHidden({
  children,
  as: Component = "span",
  htmlFor,
  ...props
}: VisuallyHiddenProps) {
  const elementProps = htmlFor ? { ...props, htmlFor } : props;
  return React.createElement(
    Component,
    { className: "sr-only", ...elementProps },
    children
  );
}
