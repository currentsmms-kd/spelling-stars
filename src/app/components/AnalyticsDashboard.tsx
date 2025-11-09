import { useEffect, useState } from "react";
import { Card } from "./Card";
import { supabase } from "../supabase";
import { TrendingUp, Target, Award, Clock } from "lucide-react";

interface AnalyticsSummary {
  totalSessions: number;
  totalMinutes: number;
  totalWordsPracticed: number;
  averageAccuracy: number;
  recentSessions: {
    date: string;
    duration: number;
    wordsPracticed: number;
    accuracy: number;
  }[];
}

interface AnalyticsDashboardProps {
  childId?: string;
}

export function AnalyticsDashboard({ childId }: AnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "all">("7d");

  useEffect(() => {
    const loadData = async () => {
      if (!childId) {
        setIsLoading(false);
        return;
      }

      try {
        const today = new Date();
        let startDate = new Date();

        if (timeRange === "7d") {
          startDate.setDate(today.getDate() - 7);
        } else if (timeRange === "30d") {
          startDate.setDate(today.getDate() - 30);
        } else {
          startDate = new Date(0); // All time
        }

        const { data, error } = await supabase
          .from("session_analytics")
          .select("*")
          .eq("child_id", childId)
          .gte("session_date", startDate.toISOString().split("T")[0])
          .order("session_date", { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          const totalMinutes = data.reduce(
            (sum, s) => sum + Math.floor(s.session_duration_seconds / 60),
            0
          );
          const totalWordsPracticed = data.reduce(
            (sum, s) => sum + s.words_practiced,
            0
          );
          const totalCorrect = data.reduce(
            (sum, s) => sum + s.correct_on_first_try,
            0
          );
          const totalAttempts = data.reduce(
            (sum, s) => sum + s.total_attempts,
            0
          );

          setAnalytics({
            totalSessions: data.length,
            totalMinutes,
            totalWordsPracticed,
            averageAccuracy:
              totalAttempts > 0 ? (totalCorrect / totalAttempts) * 100 : 0,
            recentSessions: data.slice(0, 5).map((s) => ({
              date: s.session_date,
              duration: Math.floor(s.session_duration_seconds / 60),
              wordsPracticed: s.words_practiced,
              accuracy:
                s.total_attempts > 0
                  ? (s.correct_on_first_try / s.total_attempts) * 100
                  : 0,
            })),
          });
        } else {
          setAnalytics(null);
        }
      } catch (err) {
        console.error("Error loading analytics:", err);
        setAnalytics(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [childId, timeRange]);

  if (isLoading) {
    return (
      <Card>
        <div className="text-center py-8 text-gray-500">
          Loading analytics...
        </div>
      </Card>
    );
  }

  if (!childId) {
    return (
      <Card>
        <div className="text-center py-8 text-gray-500">
          Select a child to view analytics
        </div>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <div className="text-center py-8 text-gray-500">
          No analytics data available yet
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Practice Analytics</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setTimeRange("7d")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              timeRange === "7d"
                ? "bg-primary-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setTimeRange("30d")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              timeRange === "30d"
                ? "bg-primary-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => setTimeRange("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              timeRange === "all"
                ? "bg-primary-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <TrendingUp className="text-primary-700" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {analytics.totalSessions}
              </div>
              <div className="text-sm text-gray-600">Sessions</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="text-blue-700" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold">{analytics.totalMinutes}</div>
              <div className="text-sm text-gray-600">Minutes</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Award className="text-green-700" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {analytics.totalWordsPracticed}
              </div>
              <div className="text-sm text-gray-600">Words Practiced</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-secondary-100 rounded-lg">
              <Target className="text-secondary-700" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {analytics.averageAccuracy.toFixed(0)}%
              </div>
              <div className="text-sm text-gray-600">Accuracy</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Sessions */}
      <Card>
        <h3 className="text-xl font-bold mb-4">Recent Sessions</h3>
        <div className="space-y-3">
          {analytics.recentSessions.map((session, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div>
                <div className="font-semibold">
                  {new Date(session.date).toLocaleDateString()}
                </div>
                <div className="text-sm text-gray-600">
                  {session.wordsPracticed} words · {session.duration} min
                </div>
              </div>
              <div
                className={`text-lg font-bold ${
                  session.accuracy >= 80
                    ? "text-green-600"
                    : session.accuracy >= 60
                      ? "text-yellow-600"
                      : "text-red-600"
                }`}
              >
                {session.accuracy.toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
