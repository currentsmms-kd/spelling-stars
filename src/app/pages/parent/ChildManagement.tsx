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

export function ChildManagement() {
  const { user, profile, signUp } = useAuth();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [childEmail, setChildEmail] = useState("");
  const [childPassword, setChildPassword] = useState("");
  const [childName, setChildName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
      email,
      password,
      displayName,
      parentId,
    }: {
      email: string;
      password: string;
      displayName: string;
      parentId: string;
    }) => {
      // Sign up child account
      const { data: authData, error: authError } = await signUp(
        email,
        password,
        "child"
      );

      if (authError) throw authError;
      if (!authData.user) throw new Error("No user created");

      // Update profile with parent_id and display_name
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          parent_id: parentId,
          display_name: displayName,
        })
        .eq("id", authData.user.id);

      if (profileError) throw profileError;

      return authData.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["children"] });
      setShowAddForm(false);
      setChildEmail("");
      setChildPassword("");
      setChildName("");
      logger.info("Child account created successfully");
    },
    onError: (error) => {
      logger.error("Error creating child account:", error);
      alert(`Failed to create child account: ${error.message}`);
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
      alert(`Failed to delete child account: ${error.message}`);
    },
  });

  const handleCreateChild = (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      alert("You must be logged in to create a child account");
      return;
    }

    if (!childEmail || !childPassword || !childName) {
      alert("Please fill in all fields");
      return;
    }

    if (childPassword.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    createChild.mutate({
      email: childEmail,
      password: childPassword,
      displayName: childName,
      parentId: user.id,
    });
  };

  const handleDeleteChild = (childId: string) => {
    deleteChild.mutate(childId);
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
                <label className="block text-sm font-medium mb-1">
                  Child's Name
                </label>
                <input
                  type="text"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder="Enter child's name"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={childEmail}
                  onChange={(e) => setChildEmail(e.target.value)}
                  placeholder="child@example.com"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use a unique email for each child
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Password
                </label>
                <input
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
                <Button type="submit" disabled={createChild.isPending}>
                  {createChild.isPending
                    ? "Creating..."
                    : "Create Child Account"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
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
        ) : children && children.length > 0 ? (
          <div className="grid gap-4">
            {children.map((child) => (
              <Card key={child.id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="text-primary" size={24} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">
                        {child.display_name || "Unnamed Child"}
                      </h3>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>⭐ {child.stars || 0} stars</p>
                        <p>🔥 {child.streak_days || 0} day streak</p>
                        {child.created_at && (
                          <p>
                            Created:{" "}
                            {new Date(child.created_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {deleteConfirm === child.id ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleDeleteChild(child.id)}
                          disabled={deleteChild.isPending}
                          className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                          Confirm Delete
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleteConfirm(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeleteConfirm(child.id)}
                        title="Delete child account"
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No child accounts yet
              </p>
              <p className="text-sm text-muted-foreground">
                Click "Add Child" to create your first child account
              </p>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
