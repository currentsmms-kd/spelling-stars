import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/hooks/useAuth";
import { Button } from "@/app/components/Button";
import { Card } from "@/app/components/Card";
import { supabase } from "@/app/supabase";
import { logger } from "@/lib/logger";

const loginSchema = z.object({
  emailOrUsername: z.string().min(1, "Username or email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginForm() {
  const { signIn, profile } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Clear any stale auth state on mount
  useEffect(() => {
    const clearStaleAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error || (session && error)) {
          logger.info("Clearing stale auth session on login page");
          await supabase.auth.signOut();
        }
      } catch (err) {
        logger.warn("Error checking session on login:", err);
      }
    };
    clearStaleAuth();
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    const emailToUse = data.emailOrUsername;

    // Try to sign in with whatever they entered
    // If it's a username, they'll need to use the full email (parent+username@domain.com)
    const { data: authData, error: signInError } = await signIn(
      emailToUse,
      data.password,
    );

    if (signInError) {
      // Provide helpful error message for username-only logins
      if (!emailToUse.includes("@")) {
        setError(
          "Please use your full login email. Ask your parent for the email address " +
            "(it looks like: parentemail+yourname@domain.com)",
        );
      } else {
        setError(signInError.message);
      }
      setIsLoading(false);
      return;
    }

    if (authData?.user) {
      // Wait for profile to be fetched, then redirect
      // The useAuth hook will update the profile via the auth state change listener
      // Give it a moment to fetch the profile
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Fetch profile to determine redirect
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authData.user.id)
        .single();

      if (profileData) {
        if (profileData.role === "parent") {
          navigate("/parent/dashboard");
        } else {
          navigate("/child/home");
        }
      } else {
        setError("Profile not found. Please contact support.");
      }
    }

    setIsLoading(false);
  };

  return (
    <>
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-primary mb-2">⭐ SpellStars</h1>
        <p className="text-muted-foreground">Sign in to continue</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="emailOrUsername"
            className="block text-sm font-medium text-foreground mb-1"
          >
            Email or Username
          </label>
          <input
            {...register("emailOrUsername")}
            type="text"
            id="emailOrUsername"
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input"
            placeholder="username or parent@example.com"
          />
          {errors.emailOrUsername && (
            <p className="mt-1 text-sm text-destructive">
              {errors.emailOrUsername.message}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Children: Enter your username • Parents: Enter your email
          </p>
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-foreground mb-1"
          >
            Password
          </label>
          <input
            {...register("password")}
            type="password"
            id="password"
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input"
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="mt-1 text-sm text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        <p>
          Don&apos;t have an account?{" "}
          <Link
            to="/signup"
            className="text-primary hover:text-primary/80 font-medium"
          >
            Sign up
          </Link>
        </p>
      </div>
    </>
  );
}

export function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50 p-4">
      <Card className="w-full max-w-md">
        <LoginForm />
      </Card>
    </div>
  );
}
