import { AlertTriangle } from "lucide-react";

interface SetupErrorProps {
  message: string;
  details?: string[];
}

/**
 * Component displayed when critical setup requirements are missing
 * Used for missing environment variables and other configuration issues
 */
export function SetupError({ message, details }: SetupErrorProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-2xl w-full bg-card rounded-lg shadow-lg p-8 border-4 border-destructive">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-12 h-12 text-destructive flex-shrink-0" />
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
                  {details.map((detail, index) => (
                    <li key={index}>{detail}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-secondary p-4 rounded-md">
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
                    className="text-primary hover:underline"
                  >
                    Supabase Dashboard
                  </a>
                </li>
                <li>
                  Using Doppler? Run{" "}
                  <code className="bg-muted px-1 py-0.5 rounded">
                    doppler setup
                  </code>{" "}
                  and{" "}
                  <code className="bg-muted px-1 py-0.5 rounded">
                    doppler run -- npm run dev
                  </code>
                </li>
                <li>Restart the development server</li>
              </ol>
            </div>

            <div className="mt-6 p-4 bg-accent rounded-md">
              <p className="text-sm text-accent-foreground">
                📖 For detailed setup instructions, see{" "}
                <code className="bg-muted px-1 py-0.5 rounded">
                  docs/DEPLOYMENT.md
                </code>{" "}
                and{" "}
                <code className="bg-muted px-1 py-0.5 rounded">
                  docs/QUICKSTART.md
                </code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
