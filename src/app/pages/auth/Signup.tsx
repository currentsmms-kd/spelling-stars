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

// Extracted Role Option Component
function RoleOption({
  register,
  value,
  title,
  description,
}: {
  register: UseFormRegister<SignupFormData>;
  value: "parent" | "child";
  title: string;
  description: string;
}) {
  return (
    <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
      <input
        {...register("role")}
        type="radio"
        value={value}
        className="w-4 h-4 text-primary"
      />
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
    </label>
  );
}

function RoleSelection({
  register,
  error,
}: {
  register: UseFormRegister<SignupFormData>;
  error?: string;
}) {
  return (
    <div>
      <p className="block text-sm font-medium text-foreground mb-2">
        I am a...
      </p>
      <div className="space-y-2">
        <RoleOption
          register={register}
          value="parent"
          title="Parent"
          description="Manage word lists and track progress"
        />
        <RoleOption
          register={register}
          value="child"
          title="Child"
          description="Practice spelling and earn rewards"
        />
      </div>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}

// Extracted Form Field Component
function FormField({
  id,
  label,
  type = "text",
  placeholder,
  register,
  error,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder: string;
  register: ReturnType<UseFormRegister<SignupFormData>>;
  error?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-foreground mb-1"
      >
        {label}
      </label>
      <input
        {...register}
        type={type}
        id={id}
        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input"
        placeholder={placeholder}
      />
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}

// Extracted Header Component
function SignupHeader() {
  return (
    <div className="text-center mb-8">
      <h1 className="text-4xl font-bold text-primary mb-2">⭐ SpellStars</h1>
      <p className="text-muted-foreground">Create your account</p>
    </div>
  );
}

// Extracted Footer Component
function SignupFooter() {
  return (
    <div className="mt-6 text-center text-sm text-muted-foreground">
      <p>
        Already have an account?{" "}
        <Link
          to="/login"
          className="text-primary hover:text-primary/80 font-medium"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

// Extracted Error Alert Component
function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="p-3 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
      {message}
    </div>
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
      <SignupHeader />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && <ErrorAlert message={error} />}

        <FormField
          id="email"
          label="Email"
          type="email"
          placeholder="you@example.com"
          register={register("email")}
          error={errors.email?.message}
        />

        <FormField
          id="password"
          label="Password"
          type="password"
          placeholder="••••••••"
          register={register("password")}
          error={errors.password?.message}
        />

        <FormField
          id="displayName"
          label="Name"
          type="text"
          placeholder="Your name"
          register={register("displayName")}
          error={errors.displayName?.message}
        />

        <RoleSelection register={register} error={errors.role?.message} />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Creating account..." : "Create Account"}
        </Button>
      </form>

      <SignupFooter />
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
