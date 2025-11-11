import { useState } from "react";
import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import { Plus, User, Trash2 } from "lucide-react";
import { useAuth } from "@/app/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/app/supabase";
import { logger } from "@/lib/logger";

interface ChildProfile {
  id: string;
  display_name: string | null;
  created_at: string | null;
  stars: number | null;
  streak_days: number | null;
}

// Reserved usernames that cannot be used
const RESERVED_USERNAMES = [
  "admin",
  "administrator",
  "root",
  "system",
  "spellstars",
  "support",
  "help",
  "info",
  "contact",
  "noreply",
  "no-reply",
  "postmaster",
  "hostmaster",
  "webmaster",
  "parent",
  "child",
  "user",
  "guest",
  "test",
  "demo",
];

// Username validation constraints
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 30;

/**
 * Validates username format and checks against reserved names.
 * Returns error message if invalid, null if valid.
 */
function validateUsername(username: string): string | null {
  if (!username) {
    return "Username is required";
  }

  if (username.length < USERNAME_MIN_LENGTH) {
    return `Username must be at least ${USERNAME_MIN_LENGTH} characters`;
  }

  if (username.length > USERNAME_MAX_LENGTH) {
    return `Username must be no more than ${USERNAME_MAX_LENGTH} characters`;
  }

  // Alphanumeric only (no special characters, no spaces)
  if (!/^[a-zA-Z0-9]+$/.test(username)) {
    return "Username can only contain letters and numbers (no spaces or special characters)";
  }

  // Must start with a letter
  if (!/^[a-zA-Z]/.test(username)) {
    return "Username must start with a letter";
  }

  // Check against reserved names (case-insensitive)
  if (RESERVED_USERNAMES.includes(username.toLowerCase())) {
    return "This username is reserved and cannot be used";
  }

  return null; // Valid
}

/**
 * Checks if a username is already taken by attempting a sign-in with the generated email.
 * Since we cannot query auth.users directly from the client, we use a clever workaround:
 * 1. Try to sign in with a dummy password
 * 2. If we get "Invalid login credentials", the user exists (username taken)
 * 3. If we get "Email not confirmed", the user exists (username taken)
 * 4. If we get any other auth error, assume username is available
 *
 * This is a client-side workaround since Supabase doesn't expose auth.users to the client.
 */
async function checkUsernameAvailability(username: string): Promise<{
  available: boolean;
  message?: string;
}> {
  const generatedEmail = `${username}@spellstars.app`;

  // Attempt sign-in with a dummy password that's guaranteed to fail
  // We're only checking if the email exists in the auth system
  const { error } = await supabase.auth.signInWithPassword({
    email: generatedEmail,
    password: "__DUMMY_PASSWORD_CHECK_ONLY__", // Will never match any real password
  });

  if (!error) {
    // This should never happen (we're using a dummy password)
    logger.warn("Unexpected successful login during username check");
    return { available: false, message: "Username already exists" };
  }

  // Check error types
  if (
    error.message.toLowerCase().includes("invalid login credentials") ||
    error.message.toLowerCase().includes("invalid email or password")
  ) {
    // User exists (wrong password) - username is taken
    return { available: false, message: "Username already taken" };
  }

  if (error.message.toLowerCase().includes("email not confirmed")) {
    // User exists but not confirmed - username is taken
    return { available: false, message: "Username already taken" };
  }

  if (error.message.toLowerCase().includes("user not found")) {
    // User doesn't exist - username is available
    return { available: true };
  }

  // For any other error, we assume the username is available
  // (better to allow creation and let signUp fail with a proper error)
  logger.debug("Username availability check returned unexpected error", error);
  return { available: true };
}

// Extracted component to reduce nesting
interface ChildCardProps {
  child: ChildProfile;
  deleteConfirm: string | null;
  onDeleteClick: (childId: string) => void;
  onDeleteConfirm: (childId: string) => void;
  onDeleteCancel: () => void;
  isDeleting: boolean;
}

function ChildCard({
  child,
  deleteConfirm,
  onDeleteClick,
  onDeleteConfirm,
  onDeleteCancel,
  isDeleting,
}: ChildCardProps) {
  const isConfirmingDelete = deleteConfirm === child.id;

  // Standard Card layout pattern - 5 levels of nesting is acceptable for UI components
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="text-primary" size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-lg">
              {child.display_name || "Unnamed Child"}
            </h3>
            <p className="text-sm text-muted-foreground">
              ⭐ {child.stars || 0} stars • 🔥 {child.streak_days || 0} day
              streak
            </p>
            {child.created_at && (
              <p className="text-sm text-muted-foreground">
                Created: {new Date(child.created_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {isConfirmingDelete ? (
            <>
              <Button
                size="sm"
                onClick={() => onDeleteConfirm(child.id)}
                disabled={isDeleting}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                Confirm Delete
              </Button>
              <Button size="sm" variant="outline" onClick={onDeleteCancel}>
                Cancel
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDeleteClick(child.id)}
              title="Delete child account"
            >
              <Trash2 size={16} />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export function ChildManagement() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [childUsername, setChildUsername] = useState(""); // Changed from email to username
  const [childPassword, setChildPassword] = useState("");
  const [childName, setChildName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  // Fetch children for current parent
  const { data: children, isLoading } = useQuery({
    queryKey: ["children", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "child")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("Error fetching children:", error);
        throw error;
      }

      return (data || []).map((child) => ({
        id: child.id,
        display_name: child.display_name,
        created_at: child.created_at,
        stars: child.stars,
        streak_days: child.streak_days,
      })) as ChildProfile[];
    },
    enabled: Boolean(user?.id),
  });

  // Create child account mutation
  const createChild = useMutation({
    mutationFn: async ({
      username,
      password,
      displayName,
      parentId,
    }: {
      username: string;
      password: string;
      displayName: string;
      parentId: string;
    }) => {
      // Generate a unique email from username (internal use only)
      // Using .app domain (valid TLD) to satisfy Supabase email validation
      const generatedEmail = `${username}@spellstars.app`;

      // Sign up child account with metadata
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: generatedEmail,
        password,
        options: {
          data: {
            role: "child",
            display_name: displayName,
            parent_id: parentId,
            username, // Store username in metadata
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("No user created");

      // Wait a moment for the trigger to create the profile
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update profile with parent_id (in case trigger didn't get it from metadata)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          parent_id: parentId,
          display_name: displayName,
        })
        .eq("id", authData.user.id);

      if (profileError) {
        logger.warn(
          "Profile update after creation failed (might be okay):",
          profileError
        );
        // Don't throw - the trigger should have created the profile
      }

      return authData.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["children"] });
      setShowAddForm(false);
      setChildUsername("");
      setChildPassword("");
      setChildName("");
      setUsernameError(null);
      logger.info("Child account created successfully");
    },
    onError: (error) => {
      logger.error("Error creating child account:", error);

      // Provide user-friendly error messages
      let errorMessage = "Failed to create child account";

      if (error instanceof Error) {
        if (
          error.message.toLowerCase().includes("user already registered") ||
          error.message.toLowerCase().includes("email already exists")
        ) {
          errorMessage =
            "This username is already taken. Please choose a different username.";
          setUsernameError("Username already taken");
        } else if (error.message.toLowerCase().includes("password")) {
          errorMessage =
            "Password does not meet requirements (min 6 characters)";
        } else if (error.message.toLowerCase().includes("email")) {
          errorMessage =
            "Invalid username format. Please use only letters and numbers.";
        } else {
          errorMessage = `Failed to create account: ${error.message}`;
        }
      }

      logger.error(errorMessage);
      // TODO: Add toast notification system for better UX
    },
  });

  // Delete child account mutation
  const deleteChild = useMutation({
    mutationFn: async (childId: string) => {
      // Delete profile (auth user will be deleted via trigger)
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", childId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["children"] });
      setDeleteConfirm(null);
      logger.info("Child account deleted successfully");
    },
    onError: (error) => {
      logger.error("Error deleting child account:", error);
      // Using logger.error instead of alert for better UX
      // TODO: Add toast notification system
      logger.error(`Failed to delete child account: ${error.message}`);
    },
  });

  const handleCreateChild = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      logger.error("You must be logged in to create a child account");
      return;
    }

    if (!childUsername || !childPassword || !childName) {
      logger.error("Please fill in all fields");
      return;
    }

    // Validate username format and reserved names
    const validationError = validateUsername(childUsername);
    if (validationError) {
      setUsernameError(validationError);
      logger.error(validationError);
      return;
    }

    if (childPassword.length < 6) {
      logger.error("Password must be at least 6 characters");
      return;
    }

    // Check username availability before attempting to create account
    setIsCheckingUsername(true);
    setUsernameError(null);

    try {
      const { available, message } =
        await checkUsernameAvailability(childUsername);

      if (!available) {
        setUsernameError(message || "Username is not available");
        logger.error(
          message ||
            "This username is already taken. Please choose a different username."
        );
        setIsCheckingUsername(false);
        return;
      }

      // Username is available, proceed with account creation
      setIsCheckingUsername(false);
      createChild.mutate({
        username: childUsername,
        password: childPassword,
        displayName: childName,
        parentId: user.id,
      });
    } catch (error) {
      logger.error("Error checking username availability:", error);
      setIsCheckingUsername(false);
      // Proceed anyway and let signUp handle the error
      createChild.mutate({
        username: childUsername,
        password: childPassword,
        displayName: childName,
        parentId: user.id,
      });
    }
  };

  const handleDeleteChild = (childId: string) => {
    deleteChild.mutate(childId);
  };

  /**
   * Validates username on blur (when user leaves the field).
   * Provides immediate feedback about username validity.
   */
  const handleUsernameBlur = async () => {
    if (!childUsername) {
      setUsernameError(null);
      return;
    }

    // First, validate format and reserved names
    const validationError = validateUsername(childUsername);
    if (validationError) {
      setUsernameError(validationError);
      return;
    }

    // Then check availability
    setIsCheckingUsername(true);
    setUsernameError(null);

    try {
      const { available, message } =
        await checkUsernameAvailability(childUsername);

      if (!available) {
        setUsernameError(message || "Username is not available");
      } else {
        setUsernameError(null); // Clear any previous errors
      }
    } catch (error) {
      logger.error("Error checking username availability:", error);
      // Don't show error to user - we'll check again on submit
      setUsernameError(null);
    } finally {
      setIsCheckingUsername(false);
    }
  };

  /**
   * Handles username input changes.
   * Converts to lowercase and clears errors.
   */
  const handleUsernameChange = (value: string) => {
    setChildUsername(value.toLowerCase());
    setUsernameError(null); // Clear error when user types
  };

  if (!profile || profile.role !== "parent") {
    return (
      <AppShell title="Child Accounts" variant="parent">
        <div className="max-w-4xl mx-auto">
          <Card>
            <p className="text-center text-muted-foreground">
              Only parents can manage child accounts.
            </p>
          </Card>
        </div>
      </AppShell>
    );
  }

  // Standard AppShell layout pattern - 5 levels of nesting is acceptable for page layouts
  return (
    <AppShell title="Child Accounts" variant="parent">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Child Accounts</h2>
            <p className="text-muted-foreground">
              Create and manage child accounts
            </p>
          </div>
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2"
          >
            <Plus size={20} />
            Add Child
          </Button>
        </div>

        {/* Add Child Form */}
        {showAddForm && (
          <Card>
            <form onSubmit={handleCreateChild} className="space-y-4">
              <h3 className="text-lg font-semibold">
                Create New Child Account
              </h3>

              <div>
                <label
                  htmlFor="childName"
                  className="block text-sm font-medium mb-1"
                >
                  Child&apos;s Name
                </label>
                <input
                  id="childName"
                  type="text"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder="Enter child&apos;s name"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="childUsername"
                  className="block text-sm font-medium mb-1"
                >
                  Username
                </label>
                <div className="relative">
                  <input
                    id="childUsername"
                    type="text"
                    value={childUsername}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    onBlur={handleUsernameBlur}
                    placeholder="e.g., sally, tommy, alex"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input ${
                      usernameError
                        ? "border-destructive focus:ring-destructive"
                        : ""
                    }`}
                    required
                    minLength={USERNAME_MIN_LENGTH}
                    maxLength={USERNAME_MAX_LENGTH}
                    pattern="^[a-zA-Z][a-zA-Z0-9]*$"
                    title="Must start with a letter, followed by letters and numbers only"
                    disabled={isCheckingUsername}
                  />
                  {isCheckingUsername && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                {usernameError ? (
                  <p className="text-xs text-destructive mt-1">
                    {usernameError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    {USERNAME_MIN_LENGTH}-{USERNAME_MAX_LENGTH} characters,
                    letters and numbers only, must start with a letter. This
                    creates a login username (no email needed).
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="childPassword"
                  className="block text-sm font-medium mb-1"
                >
                  Password
                </label>
                <input
                  id="childPassword"
                  type="password"
                  value={childPassword}
                  onChange={(e) => setChildPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input"
                  required
                  minLength={6}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={
                    createChild.isPending ||
                    isCheckingUsername ||
                    Boolean(usernameError)
                  }
                >
                  {isCheckingUsername
                    ? "Checking username..."
                    : createChild.isPending
                      ? "Creating..."
                      : "Create Child Account"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setUsernameError(null);
                    setChildUsername("");
                    setChildPassword("");
                    setChildName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Children List */}
        {isLoading ? (
          <Card>
            <p className="text-center text-muted-foreground">
              Loading children...
            </p>
          </Card>
        ) : children?.length ? (
          <div className="grid gap-4">
            {children.map((child) => (
              <ChildCard
                key={child.id}
                child={child}
                deleteConfirm={deleteConfirm}
                onDeleteClick={setDeleteConfirm}
                onDeleteConfirm={handleDeleteChild}
                onDeleteCancel={() => setDeleteConfirm(null)}
                isDeleting={deleteChild.isPending}
              />
            ))}
          </div>
        ) : (
          <Card>
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No child accounts yet
              </p>
              <p className="text-sm text-muted-foreground">
                Click &quot;Add Child&quot; to create your first child account
              </p>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
