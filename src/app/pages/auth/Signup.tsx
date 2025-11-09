import { useState } from "react";
import { useForm } from "react-hook-form";
import type { UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/app/supabase";
import { Button } from "@/app/components/Button";
import { Card } from "@/app/components/Card";

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  displayName: z.string().min(1, "Name is required"),
  role: z.enum(["parent", "child"], {
    required_error: "Please select a role",
  }),
});

type SignupFormData = z.infer<typeof signupSchema>;

function RoleSelection({
  register,
  error,
}: {
  register: UseFormRegister<SignupFormData>;
  error?: string;
}) {
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-gray-700 mb-2">
        I am a...
      </legend>
      <div className="space-y-2">
        <label className="flex items-center gap-2 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
          <input
            {...register("role")}
            type="radio"
            value="parent"
            className="w-4 h-4 text-primary-600"
          />
          <div>
            <div className="font-medium">Parent</div>
            <div className="text-sm text-gray-500">
              Manage word lists and track progress
            </div>
          </div>
        </label>
        <label className="flex items-center gap-2 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
          <input
            {...register("role")}
            type="radio"
            value="child"
            className="w-4 h-4 text-primary-600"
          />
          <div>
            <div className="font-medium">Child</div>
            <div className="text-sm text-gray-500">
              Practice spelling and earn rewards
            </div>
          </div>
        </label>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </fieldset>
  );
}

function SignupForm() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      // Sign up with Supabase
      const { data: authData, error: signUpError } = await supabase.auth.signUp(
        {
          email: data.email,
          password: data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              display_name: data.displayName,
              role: data.role,
            },
          },
        }
      );

      if (signUpError) throw signUpError;

      if (authData.user) {
        // Wait a moment for the trigger to create the profile
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Try to update the profile multiple times if needed
        let retries = 3;
        let profileUpdated = false;

        while (retries > 0 && !profileUpdated) {
          const { error: profileError } = await supabase
            .from("profiles")
            .update({
              display_name: data.displayName,
              role: data.role,
            })
            .eq("id", authData.user.id);

          if (!profileError) {
            profileUpdated = true;
          } else {
            retries--;
            if (retries > 0) {
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }
        }

        // Redirect based on role
        if (data.role === "parent") {
          navigate("/parent/dashboard");
        } else {
          navigate("/child/home");
        }
      }
    } catch (err) {
      const error = err as Error;
      setError(error.message || "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-primary-700 mb-2">
          ⭐ SpellStars
        </h1>
        <p className="text-gray-600">Create your account</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email
          </label>
          <input
            {...register("email")}
            type="email"
            id="email"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="you@example.com"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Password
          </label>
          <input
            {...register("password")}
            type="password"
            id="password"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">
              {errors.password.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="displayName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Name
          </label>
          <input
            {...register("displayName")}
            type="text"
            id="displayName"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Your name"
          />
          {errors.displayName && (
            <p className="mt-1 text-sm text-red-600">
              {errors.displayName.message}
            </p>
          )}
        </div>

        <RoleSelection register={register} error={errors.role?.message} />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Creating account..." : "Create Account"}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        <p>
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Sign in
          </Link>
        </p>
      </div>
    </>
  );
}

export function Signup() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50 p-4">
      <Card className="w-full max-w-md">
        <SignupForm />
      </Card>
    </div>
  );
}
