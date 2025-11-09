import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import { Link } from "react-router-dom";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/app/supabase";
import { useAuth } from "@/app/hooks/useAuth";

export function Lists() {
  const { user } = useAuth();

  const { data: lists, isLoading } = useQuery({
    queryKey: ["lists", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("spelling_lists")
        .select("*")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: Boolean(user),
  });

  return (
    <AppShell title="Spelling Lists" variant="parent">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Your Lists</h2>
            <p className="text-gray-600">
              Create and manage spelling word lists
            </p>
          </div>
          <Link to="/parent/lists/new">
            <Button className="flex items-center gap-2">
              <Plus size={20} />
              New List
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading lists...</p>
          </div>
        ) : lists && lists.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lists.map((list) => (
              <Card key={list.id}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-900">
                      {list.title}
                    </h3>
                    {list.description && (
                      <p className="text-gray-600 text-sm mt-1">
                        {list.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link to={`/parent/lists/${list.id}`} className="flex-1">
                    <Button
                      size="sm"
                      className="w-full flex items-center justify-center gap-2"
                    >
                      <Edit size={16} />
                      Edit
                    </Button>
                  </Link>
                  <Button size="sm" disabled>
                    <Trash2 size={16} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">No spelling lists yet</p>
              <Link to="/parent/lists/new">
                <Button>Create Your First List</Button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
