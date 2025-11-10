import { useEffect, useState } from "react";
import { Card } from "./Card";
import { supabase } from "../supabase";
import { TrendingUp, Target, Award, Clock } from "lucide-react";
import { logger } from "@/lib/logger";

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

// Extracted Summary Card Component
function SummaryCard({
  icon,
  iconColor,
  value,
  label,
}: {
  icon: React.ReactNode;
  iconColor: string;
  value: string | number;
  label: string;
}) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className={`p-2 ${iconColor} rounded-lg`}>{icon}</div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </div>
      </div>
    </Card>
  );
}

// Extracted Session Entry Component
function SessionEntry({
  date,
  wordsPracticed,
  duration,
  accuracy,
}: {
  date: string;
  wordsPracticed: number;
  duration: number;
  accuracy: number;
}) {
  const accuracyColor =
    accuracy >= 80
      ? "text-secondary"
      : accuracy >= 60
        ? "text-accent"
        : "text-destructive";

  return (
    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
      <div>
        <div className="font-semibold">
          {new Date(date).toLocaleDateString()}
        </div>
        <div className="text-sm text-muted-foreground">
          {wordsPracticed} words · {duration} min
        </div>
      </div>
      <div className={`text-lg font-bold ${accuracyColor}`}>
        {accuracy.toFixed(0)}%
      </div>
    </div>
  );
}

// Extracted Time Range Button Component
function TimeRangeButton({
  isActive,
  onClick,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-foreground hover:bg-muted/80"
      }`}
    >
      {children}
    </button>
  );
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
        logger.error("Error loading analytics:", err);
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
        <div className="text-center py-8 text-muted-foreground">
          Loading analytics...
        </div>
      </Card>
    );
  }

  if (!childId) {
    return (
      <Card>
        <div className="text-center py-8 text-muted-foreground">
          Select a child to view analytics
        </div>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <div className="text-center py-8 text-muted-foreground">
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
          <TimeRangeButton
            isActive={timeRange === "7d"}
            onClick={() => setTimeRange("7d")}
          >
            7 Days
          </TimeRangeButton>
          <TimeRangeButton
            isActive={timeRange === "30d"}
            onClick={() => setTimeRange("30d")}
          >
            30 Days
          </TimeRangeButton>
          <TimeRangeButton
            isActive={timeRange === "all"}
            onClick={() => setTimeRange("all")}
          >
            All Time
          </TimeRangeButton>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={<TrendingUp className="text-primary" size={24} />}
          iconColor="bg-primary/10"
          value={analytics.totalSessions}
          label="Sessions"
        />
        <SummaryCard
          icon={<Clock className="text-secondary" size={24} />}
          iconColor="bg-secondary/10"
          value={analytics.totalMinutes}
          label="Minutes"
        />
        <SummaryCard
          icon={<Award className="text-secondary" size={24} />}
          iconColor="bg-secondary/10"
          value={analytics.totalWordsPracticed}
          label="Words Practiced"
        />
        <SummaryCard
          icon={<Target className="text-accent" size={24} />}
          iconColor="bg-accent/10"
          value={`${analytics.averageAccuracy.toFixed(0)}%`}
          label="Accuracy"
        />
      </div>

      {/* Recent Sessions */}
      <Card>
        <h3 className="text-xl font-bold mb-4">Recent Sessions</h3>
        <div className="space-y-3">
          {analytics.recentSessions.map((session, i) => (
            <SessionEntry
              key={i}
              date={session.date}
              wordsPracticed={session.wordsPracticed}
              duration={session.duration}
              accuracy={session.accuracy}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
