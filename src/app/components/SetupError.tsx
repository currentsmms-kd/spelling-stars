import { AlertTriangle, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Button } from "./Button";

interface SetupErrorProps {
  message: string;
  details?: string[];
  type?: "env" | "network" | "database" | "permission" | "general";
  onRetry?: () => void;
  isRetrying?: boolean;
}

/**
 * Component displayed when critical setup requirements are missing
 * Used for missing environment variables and other configuration issues
 */
export function SetupError({
  message,
  details,
  type = "env",
  onRetry,
  isRetrying = false,
}: SetupErrorProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const getTypeSpecificGuidance = () => {
    switch (type) {
      case "network":
        return (
          <div className="bg-secondary/50 p-4 rounded-md mb-4">
            <h3 className="font-semibold text-foreground mb-2">
              🌐 Network Troubleshooting:
            </h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>Check your internet connection</li>
              <li>Disable VPN or proxy temporarily</li>
              <li>Check if your firewall is blocking the app</li>
              <li>Try using a different network (mobile hotspot)</li>
            </ul>
          </div>
        );

      case "database":
        return (
          <div className="bg-secondary/50 p-4 rounded-md mb-4">
            <h3 className="font-semibold text-foreground mb-2">
              🗄️ Database Connection Issues:
            </h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                Check{" "}
                <a
                  href="https://status.supabase.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Supabase Status <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>Verify your Supabase project credentials are correct</li>
              <li>Ensure your Supabase project is not paused</li>
              <li>Check if your IP is allowed in Supabase settings</li>
            </ul>
          </div>
        );

      case "permission":
        return (
          <div className="bg-secondary/50 p-4 rounded-md mb-4">
            <h3 className="font-semibold text-foreground mb-2">
              🔒 Browser Permission Issues:
            </h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>Click the lock icon 🔒 in your browser&apos;s address bar</li>
              <li>Allow microphone access for recording features</li>
              <li>Enable storage and cookies for offline functionality</li>
              <li>Clear browser cache and try again</li>
            </ul>
          </div>
        );

      case "general":
        return (
          <div className="bg-secondary/50 p-4 rounded-md mb-4">
            <h3 className="font-semibold text-foreground mb-2">
              🔧 General Troubleshooting:
            </h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>Try clearing your browser cache</li>
              <li>
                Use a modern browser (Chrome, Firefox, or Edge recommended)
              </li>
              <li>Disable browser extensions temporarily</li>
              <li>Try in an incognito/private window</li>
            </ul>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-2xl w-full bg-card rounded-lg shadow-lg p-8 border-4 border-destructive">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-16 h-16 text-destructive flex-shrink-0" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-destructive mb-4">
              Configuration Error
            </h1>
            <p className="text-lg text-foreground mb-6">{message}</p>

            {details && details.length > 0 && (
              <div className="bg-muted p-4 rounded-md mb-6">
                <h2 className="font-semibold text-foreground mb-2">
                  Required Setup:
                </h2>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  {details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Type-specific guidance */}
            {getTypeSpecificGuidance()}

            {/* Troubleshooting Checklist */}
            <div className="bg-accent/20 p-4 rounded-md mb-6">
              <h3 className="font-semibold text-foreground mb-2">
                ✅ Troubleshooting Checklist:
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-border rounded"></span>
                  Is your internet connection working?
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-border rounded"></span>
                  Have you allowed necessary browser permissions?
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-border rounded"></span>
                  Are you using a supported browser (Chrome, Firefox, Edge)?
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-border rounded"></span>
                  Have you tried clearing your browser cache?
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-border rounded"></span>
                  Is Supabase service operational?
                </li>
              </ul>
            </div>

            {/* Environment Setup (for env type) */}
            {type === "env" && (
              <div className="bg-secondary p-4 rounded-md mb-6">
                <h3 className="font-semibold text-foreground mb-2">
                  Quick Setup Guide:
                </h3>
                <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
                  <li>
                    Create a{" "}
                    <code className="bg-muted px-1 py-0.5 rounded">.env</code>{" "}
                    file in the project root
                  </li>
                  <li>
                    Copy contents from{" "}
                    <code className="bg-muted px-1 py-0.5 rounded">
                      .env.example
                    </code>
                  </li>
                  <li>
                    Add your Supabase project credentials from{" "}
                    <a
                      href="https://supabase.com/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Supabase Dashboard <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>
                    Using Doppler? Run{" "}
                    <code className="bg-muted px-1 py-0.5 rounded">
                      doppler setup
                    </code>{" "}
                    and{" "}
                    <code className="bg-muted px-1 py-0.5 rounded">
                      doppler run -- pnpm run dev
                    </code>
                  </li>
                  <li>Restart the development server</li>
                </ol>
              </div>
            )}

            {/* Retry Button */}
            {onRetry && (
              <div className="mb-6">
                <Button
                  onClick={onRetry}
                  variant="default"
                  size="default"
                  className="w-full"
                  disabled={isRetrying}
                >
                  {isRetrying ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⏳</span>
                      Retrying...
                    </span>
                  ) : (
                    "Retry Connection"
                  )}
                </Button>
              </div>
            )}

            {/* Technical Details Toggle */}
            <div className="mb-6">
              <Button
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                variant="outline"
                size="sm"
                className="w-full"
              >
                {showTechnicalDetails ? "Hide" : "Show"} Technical Details
              </Button>
              {showTechnicalDetails && details && (
                <div className="mt-3 p-3 bg-muted rounded-md">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                    {JSON.stringify({ message, details, type }, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Get Help Section */}
            <div className="bg-accent/30 p-4 rounded-md mb-4">
              <h3 className="font-semibold text-foreground mb-2">
                🆘 Need More Help?
              </h3>
              <ul className="space-y-2 text-sm text-accent-foreground">
                <li>
                  📖 Check{" "}
                  <code className="bg-muted px-1 py-0.5 rounded">
                    docs/QUICKSTART.md
                  </code>{" "}
                  for setup instructions
                </li>
                <li>
                  📖 Review{" "}
                  <code className="bg-muted px-1 py-0.5 rounded">
                    docs/DEPLOYMENT.md
                  </code>{" "}
                  for deployment details
                </li>
                <li>
                  🐛 Report bugs on{" "}
                  <a
                    href="https://github.com/currentsmms-kd/spelling-stars/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    GitHub Issues <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
              </ul>
            </div>

            <div className="mt-6 p-4 bg-accent rounded-md">
              <p className="text-sm text-accent-foreground">
                💡 <strong>Tip:</strong> Most setup issues are resolved by
                checking environment variables and browser permissions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
