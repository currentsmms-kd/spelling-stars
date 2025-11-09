import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import { useAuth } from "@/app/hooks/useAuth";
import { Link } from "react-router-dom";
import { Plus, List, TrendingUp } from "lucide-react";

export function Dashboard() {
  const { profile } = useAuth();

  return (
    <AppShell title="SpellStars" variant="parent">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome back, {profile?.email?.split("@")[0]}!
          </h2>
          <p className="text-gray-600">
            Manage your child&apos;s spelling lists and track their progress.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary-100 rounded-lg">
                <List className="text-primary-700" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">Spelling Lists</h3>
                <p className="text-gray-600 text-sm mb-3">
                  Create and manage spelling word lists
                </p>
                <Link to="/parent/lists">
                  <Button size="sm">View Lists</Button>
                </Link>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-secondary-100 rounded-lg">
                <TrendingUp className="text-secondary-700" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">Progress</h3>
                <p className="text-gray-600 text-sm mb-3">
                  View your child&apos;s spelling progress
                </p>
                <Button size="sm" disabled>
                  Coming Soon
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Plus className="text-green-700" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">Quick Actions</h3>
                <p className="text-gray-600 text-sm mb-3">
                  Create a new spelling list
                </p>
                <Link to="/parent/lists/new">
                  <Button size="sm">New List</Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <h3 className="text-xl font-bold mb-4">Recent Activity</h3>
          <div className="text-center py-8 text-gray-500">
            <p>No recent activity yet</p>
            <p className="text-sm mt-2">
              Activity will appear here once your child starts practicing
            </p>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
