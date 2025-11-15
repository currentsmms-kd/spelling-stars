import { useState } from "react";
import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import { Plus, Trash2, Edit } from "lucide-react";
import { useAuth } from "@/app/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/app/supabase";
import { logger } from "@/lib/logger";
import { toast } from "react-hot-toast";
import { Toast } from "@/app/components/Toast";
import { ChildProfileEditor } from "@/app/components/ChildProfileEditor";
import { AvatarDisplay } from "@/app/components/AvatarSelector";

interface ChildProfile {
  id: string;
  display_name: string | null;
  created_at: string | null;
  stars: number | null;
  streak_days: number | null;
  equipped_avatar: string | null;
  age: number | null;
  birthday: string | null;
  favorite_color: string | null;
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

// Extracted component to reduce nesting
interface ChildCardProps {
  child: ChildProfile;
  deleteConfirm: string | null;
  onDeleteClick: (childId: string) => void;
  onDeleteConfirm: (childId: string) => void;
  onDeleteCancel: () => void;
  onEditClick: (childId: string) => void;
  isDeleting: boolean;
}

function ChildCard({
  child,
  deleteConfirm,
  onDeleteClick,
  onDeleteConfirm,
  onDeleteCancel,
  onEditClick,
  isDeleting,
}: ChildCardProps) {
  const isConfirmingDelete = deleteConfirm === child.id;

  const handleDeleteClick = () => {
    onDeleteClick(child.id);
  };

  const handleConfirmDelete = () => {
    onDeleteConfirm(child.id);
  };

  const handleEditClick = () => {
    onEditClick(child.id);
  };

  // Standard Card layout pattern - 5 levels of nesting is acceptable for UI components
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <AvatarDisplay avatarId={child.equipped_avatar} size="lg" />
          <div>
            <h3 className="font-semibold text-lg">
              {child.display_name || "Unnamed Child"}
            </h3>
            {child.age && (
              <p className="text-sm text-muted-foreground">
                {child.age} years old
                {child.birthday &&
                  ` • 🎂 ${new Date(child.birthday).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`}
              </p>
            )}
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
                onClick={handleConfirmDelete}
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
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleEditClick}
                title="Edit profile"
              >
                <Edit size={16} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDeleteClick}
                title="Delete child account"
              >
                <Trash2 size={16} />
              </Button>
            </>
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
  const [createdLoginEmail, setCreatedLoginEmail] = useState<string | null>(
    null,
  );
  const [editingChild, setEditingChild] = useState<ChildProfile | null>(null);

  // Handler for toggling the add form
  const handleToggleAddForm = () => {
    setShowAddForm(!showAddForm);
  };

  // Handler for child name change
  const handleChildNameChange = (value: string) => {
    setChildName(value);
  };

  // Handler wrapper for child name input onChange
  const handleChildNameInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    handleChildNameChange(e.target.value);
  };

  // Handler for child password change
  const handleChildPasswordChange = (value: string) => {
    setChildPassword(value);
  };

  // Handler wrapper for child password input onChange
  const handleChildPasswordInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    handleChildPasswordChange(e.target.value);
  };

  /**
   * Handles username input changes.
   * Converts to lowercase and clears errors.
   */
  const handleUsernameChange = (value: string) => {
    setChildUsername(value.toLowerCase());
    setUsernameError(null); // Clear error when user types
  };

  // Handler wrapper for username input onChange
  const handleUsernameInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    handleUsernameChange(e.target.value);
  };

  // Handler for cancel button
  const handleCancelAddForm = () => {
    setShowAddForm(false);
    setUsernameError(null);
    setChildUsername("");
    setChildPassword("");
    setChildName("");
  };

  // Handler for clearing delete confirmation
  const handleClearDeleteConfirm = () => {
    setDeleteConfirm(null);
  };

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
        logger.metrics.errorCaptured({
          context: "ChildManagement.fetchChildren",
          message: error instanceof Error ? error.message : "Unknown error",
          severity: "warning",
        });
        throw error;
      }

      return (data || []).map((child) => ({
        id: child.id,
        display_name: child.display_name,
        created_at: child.created_at,
        stars: child.stars,
        streak_days: child.streak_days,
        equipped_avatar: child.equipped_avatar,
        age: child.age,
        birthday: child.birthday,
        favorite_color: child.favorite_color,
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
      // Use parent's email with plus addressing for child accounts
      // Format: parent+childusername@domain.com
      // This way:
      // - All emails go to the parent (they control everything)
      // - Each child has a unique, valid email for Supabase Auth
      // - Children still log in with just their username
      // - Supabase accepts it as a valid email format

      if (!user?.email) {
        throw new Error("Parent email not found. Please log in again.");
      }

      // Extract email parts: user@domain.com -> user + domain.com
      const emailParts = user.email.split("@");
      if (emailParts.length !== 2) {
        throw new Error("Invalid parent email format");
      }

      const [localPart, domain] = emailParts;
      // Generate: parent+childusername@domain.com
      const generatedEmail = `${localPart}+${username}@${domain}`;

      logger.info("Creating child account with username:", username);
      logger.info("Using parent email plus addressing:", generatedEmail);

      // Sign up child account with metadata
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: generatedEmail,
        password,
        options: {
          data: {
            role: "child",
            display_name: displayName,
            parent_id: parentId,
            username, // Store username in metadata for easy lookup
            parent_email: user.email, // Store parent email for reference
          },
        },
      });

      if (authError) {
        logger.error("Supabase auth.signUp error:", authError);
        throw authError;
      }
      if (!authData.user) {
        const error = new Error("No user created");
        logger.error("No user returned from signUp");
        throw error;
      }

      logger.info("Child user created successfully:", authData.user.id);

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
          profileError,
        );
        // Don't throw - the trigger should have created the profile
      }

      return { user: authData.user, loginEmail: generatedEmail };
    },
    onSuccess: (data) => {
      const loginInfo = `Login Email: ${data.loginEmail}`;

      // Store the login email to display in UI
      setCreatedLoginEmail(data.loginEmail);

      toast.custom((t) => (
        <Toast
          type="success"
          message={`Child account created! ${loginInfo}`}
          onClose={() => toast.dismiss(t.id)}
        />
      ));

      // Show a more detailed message with login instructions
      logger.info("=".repeat(60));
      logger.info("CHILD ACCOUNT CREATED SUCCESSFULLY");
      logger.info("=".repeat(60));
      logger.info(`Login Email: ${data.loginEmail}`);
      logger.info(`Username: ${childUsername}`);
      logger.info("=".repeat(60));
      logger.info("IMPORTANT: Save this login email!");
      logger.info("Your child will need this email to log in.");
      logger.info("=".repeat(60));

      queryClient.invalidateQueries({ queryKey: ["children"] });
      setShowAddForm(false);
      setChildUsername("");
      setChildPassword("");
      setChildName("");
      setUsernameError(null);
    },
    onError: (error) => {
      logger.error("Error creating child account:", error);
      logger.metrics.errorCaptured({
        context: "ChildManagement.createChild",
        message: error instanceof Error ? error.message : "Unknown error",
        severity: "error",
      });

      // Provide user-friendly error messages
      let errorMessage = "Failed to create child account";

      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();

        if (
          errorMsg.includes("user already registered") ||
          errorMsg.includes("already exists") ||
          errorMsg.includes("duplicate")
        ) {
          errorMessage =
            "This username is already taken. Please choose a different username.";
          setUsernameError("Username already taken");
        } else if (errorMsg.includes("password")) {
          errorMessage =
            "Password does not meet requirements (min 6 characters)";
        } else if (
          errorMsg.includes("invalid") ||
          errorMsg.includes("format")
        ) {
          errorMessage =
            "Invalid username format. Please use only letters and numbers, starting with a letter.";
          setUsernameError("Invalid format");
        } else {
          errorMessage =
            "Failed to create account. Please try again or contact support if the problem persists.";
        }
      }

      toast.custom((t) => (
        <Toast
          type="error"
          message={errorMessage}
          onClose={() => toast.dismiss(t.id)}
        />
      ));
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
      toast.custom((t) => (
        <Toast
          type="success"
          message="Child account deleted successfully"
          onClose={() => toast.dismiss(t.id)}
        />
      ));
      queryClient.invalidateQueries({ queryKey: ["children"] });
      setDeleteConfirm(null);
      logger.info("Child account deleted successfully");
    },
    onError: (error) => {
      logger.error("Error deleting child account:", error);
      logger.metrics.errorCaptured({
        context: "ChildManagement.deleteChild",
        message: error instanceof Error ? error.message : "Unknown error",
        severity: "error",
      });
      toast.custom((t) => (
        <Toast
          type="error"
          message={`Failed to delete child account: ${error.message}`}
          onClose={() => toast.dismiss(t.id)}
        />
      ));
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

    // Proceed with account creation - signUp will handle duplicate detection
    createChild.mutate({
      username: childUsername,
      password: childPassword,
      displayName: childName,
      parentId: user.id,
    });
  };

  const handleDeleteChild = (childId: string) => {
    deleteChild.mutate(childId);
  };

  /**
   * Validates username on blur (when user leaves the field).
   * Provides immediate feedback about username validity.
   * Note: Only validates format - duplicate checking happens during signup.
   */
  const handleUsernameBlur = async () => {
    if (!childUsername) {
      setUsernameError(null);
      return;
    }

    // Validate format and reserved names only
    const validationError = validateUsername(childUsername);
    if (validationError) {
      setUsernameError(validationError);
    } else {
      setUsernameError(null); // Clear any previous errors
    }
  };

  const handleEditChild = (childId: string) => {
    const child = children?.find((c) => c.id === childId);
    if (child) {
      setEditingChild(child);
    }
  };

  const handleCloseEditor = () => {
    setEditingChild(null);
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
        {/* Profile Editor Modal */}
        {editingChild && (
          <ChildProfileEditor
            childId={editingChild.id}
            childName={editingChild.display_name || "Child"}
            currentAvatar={editingChild.equipped_avatar}
            currentAge={editingChild.age}
            currentBirthday={editingChild.birthday}
            currentFavoriteColor={editingChild.favorite_color}
            onClose={handleCloseEditor}
          />
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Child Accounts</h2>
            <p className="text-muted-foreground">
              Create and manage child accounts
            </p>
          </div>
          <Button
            onClick={handleToggleAddForm}
            className="flex items-center gap-2"
          >
            <Plus size={20} />
            Add Child
          </Button>
        </div>

        {/* Login Email Display - Show after successful account creation */}
        {createdLoginEmail && (
          <Card className="border-2 border-secondary bg-secondary/10">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-secondary">
                    ✓ Child Account Created!
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Save this login information for your child
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCreatedLoginEmail(null)}
                  title="Dismiss"
                >
                  ✕
                </Button>
              </div>

              <div className="bg-background p-3 rounded-lg border">
                <p className="text-sm font-medium mb-1">Login Email:</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-muted px-2 py-1 rounded flex-1">
                    {createdLoginEmail}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(createdLoginEmail);
                      toast.custom((t) => (
                        <Toast
                          type="success"
                          message="Login email copied to clipboard!"
                          onClose={() => toast.dismiss(t.id)}
                        />
                      ));
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>

              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                <p className="font-medium mb-1">
                  📧 How Email Plus Addressing Works:
                </p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>All emails for child accounts go to YOUR email inbox</li>
                  <li>Your child uses this full email to log in</li>
                  <li>
                    The &quot;+username&quot; part makes each child&apos;s login
                    unique
                  </li>
                  <li>You control everything through your parent account</li>
                </ul>
              </div>
            </div>
          </Card>
        )}

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
                  onChange={handleChildNameInputChange}
                  placeholder="Enter child's name"
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
                    onChange={handleUsernameInputChange}
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
                  />
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
                  onChange={handleChildPasswordInputChange}
                  placeholder="At least 6 characters"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input"
                  required
                  minLength={6}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={createChild.isPending || Boolean(usernameError)}
                >
                  {createChild.isPending
                    ? "Creating..."
                    : "Create Child Account"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelAddForm}
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
                onDeleteCancel={handleClearDeleteConfirm}
                onEditClick={handleEditChild}
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
