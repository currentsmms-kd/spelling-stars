import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import { AnalyticsDashboard } from "@/app/components/AnalyticsDashboard";
import { useAuth } from "@/app/hooks/useAuth";
import { Link } from "react-router-dom";
import { Plus, List, TrendingUp, AlertTriangle } from "lucide-react";
import { useHardestWords, useMostLapsedWords } from "@/app/api/supa";

export function Dashboard() {
  const { profile } = useAuth();

  // Get SRS insights
  const { data: hardestWords } = useHardestWords(5);
  const { data: mostLapsedWords } = useMostLapsedWords(5);

  return (
    <AppShell title="SpellStars" variant="parent">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome back
            {profile?.display_name ? `, ${profile.display_name}` : ""}!
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

        {/* SRS Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Hardest Words */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-orange-600" size={24} />
              <h3 className="text-xl font-bold">Hardest Words</h3>
            </div>
            {hardestWords && hardestWords.length > 0 ? (
              <div className="space-y-2">
                {hardestWords.map(
                  (entry: {
                    id: string;
                    word: { text: string };
                    ease: number;
                    lapses: number;
                    reps: number;
                  }) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-2 bg-orange-50 rounded"
                    >
                      <div>
                        <p className="font-semibold">{entry.word.text}</p>
                        <p className="text-xs text-gray-600">
                          {entry.reps} reps, {entry.lapses} lapses
                        </p>
                      </div>
                      <div className="text-sm text-orange-600 font-bold">
                        Ease: {entry.ease.toFixed(1)}
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                No SRS data yet. Words will appear here after practice.
              </p>
            )}
          </Card>

          {/* Most Lapsed Words */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-red-600" size={24} />
              <h3 className="text-xl font-bold">Most Lapsed Words</h3>
            </div>
            {mostLapsedWords && mostLapsedWords.length > 0 ? (
              <div className="space-y-2">
                {mostLapsedWords.map(
                  (entry: {
                    id: string;
                    word: { text: string };
                    ease: number;
                    lapses: number;
                    reps: number;
                  }) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-2 bg-red-50 rounded"
                    >
                      <div>
                        <p className="font-semibold">{entry.word.text}</p>
                        <p className="text-xs text-gray-600">
                          {entry.reps} reps, Ease: {entry.ease.toFixed(1)}
                        </p>
                      </div>
                      <div className="text-sm text-red-600 font-bold">
                        {entry.lapses} {entry.lapses === 1 ? "lapse" : "lapses"}
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                No SRS data yet. Words will appear here after practice.
              </p>
            )}
          </Card>
        </div>

        <Card>
          <h3 className="text-xl font-bold mb-4">Recent Activity</h3>
          <AnalyticsDashboard childId={profile?.id} />
        </Card>
      </div>
    </AppShell>
  );
}
