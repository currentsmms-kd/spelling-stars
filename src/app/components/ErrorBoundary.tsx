import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card } from "./Card";
import { Button } from "./Button";
import { AlertTriangle, Copy } from "lucide-react";
import { logger } from "@/lib/logger";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Generate unique error ID for support requests
    const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Store error info in state for detailed error display
    this.setState({ errorInfo });

    // Log error with stack trace
    logger.error("React Error Boundary caught error:", error, {
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
    });

    // Track error telemetry
    logger.metrics.errorCaptured({
      context: "ErrorBoundary",
      message: error.message,
      stack: errorInfo.componentStack || error.stack,
      severity: "critical",
      errorId: this.state.errorId,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  copyErrorDetails = async (): Promise<void> => {
    const { error, errorInfo, errorId } = this.state;
    const errorDetails = `
SpellStars Error Report
-----------------------
Error ID: ${errorId}
Timestamp: ${new Date().toISOString()}
Message: ${error?.message || "Unknown error"}
Stack: ${error?.stack || "No stack trace"}
Component Stack: ${errorInfo?.componentStack || "No component stack"}
User Agent: ${navigator.userAgent}
URL: ${window.location.href}
    `.trim();

    try {
      await navigator.clipboard.writeText(errorDetails);
      logger.info("Error details copied to clipboard");
      // Could add a toast notification here
    } catch (err) {
      logger.error("Failed to copy error details:", err);
      // Fallback: select text for manual copy
      alert("Failed to copy automatically. Error details logged to console.");
      console.log(errorDetails);
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-lg w-full">
            <div className="flex flex-col items-center text-center space-y-6">
              {/* Error Icon */}
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>

              {/* Error Heading */}
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground">
                  Something went wrong
                </h1>
                <p className="text-muted-foreground">
                  We encountered an unexpected error. Don't worry - your data is
                  safe.
                </p>
              </div>

              {/* Error Message */}
              {this.state.error && (
                <div className="w-full space-y-2">
                  <div className="p-4 rounded-lg bg-destructive/10 border-2 border-destructive/20">
                    <p className="text-sm text-destructive font-medium break-words">
                      {this.state.error.message}
                    </p>
                  </div>
                  {this.state.errorId && (
                    <p className="text-xs text-muted-foreground font-mono">
                      Error ID: {this.state.errorId}
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 w-full">
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <Button
                    variant="default"
                    size="default"
                    onClick={() => window.location.reload()}
                    className="flex-1"
                  >
                    Reload Page
                  </Button>
                  <Button
                    variant="outline"
                    size="default"
                    onClick={() => (window.location.href = "/")}
                    className="flex-1"
                  >
                    Go Home
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="default"
                  onClick={this.copyErrorDetails}
                  className="w-full"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Error Details
                </Button>
              </div>

              {/* Help Text */}
              <p className="text-xs text-muted-foreground">
                If this problem persists, try clearing your browser cache or
                contact support with the error ID above.
              </p>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC for easy wrapping
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || "Component"})`;

  return WrappedComponent;
}
