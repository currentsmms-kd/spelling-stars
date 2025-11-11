import { Card } from "./Card";
import { TrendingUp, Target, Award, Clock } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface AnalyticsDashboardProps {
  childId?: string;
  _dateFrom?: Date;
  _dateTo?: Date;
  overview?: ParentOverviewData;
}

// Type for parent overview RPC response
interface ParentOverviewData {
  summary: {
    total_words_mastered: number;
    current_streak_days: number;
    avg_accuracy_7d: number;
    avg_accuracy_30d: number;
    total_time_on_task_minutes: number;
    total_sessions: number;
  };
  accuracy_over_time: Array<{
    date: string;
    accuracy: number;
    attempts: number;
  }>;
  attempts_by_mode: Record<string, number>;
  mastery_by_list: Array<{
    list_id: string;
    list_title: string;
    mastered_count: number;
    total_words: number;
    mastery_percentage: number;
    accuracy: number;
  }>;
  hardest_words: Array<{
    word: string;
    word_id: string;
    ease: number;
    error_rate: number;
    last_attempted: string;
  }>;
  common_mistake_patterns: Array<{
    pattern: string;
    common_error: string;
    occurrences: number;
    last_seen: string;
  }>;
}

// Add type for Recharts pie label props
interface PieLabelProps {
  payload?: {
    list_title: string;
    mastery_percentage: number;
  };
  list_title?: string;
  mastery_percentage?: number;
}

// Add formatter function outside components - Updated to match Recharts types
const formatPieLabel = (props: PieLabelProps) => {
  const entry = props.payload || props;
  return `${entry.list_title}: ${entry.mastery_percentage}%`;
};

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

// Extracted Mastery List Detail Component
function MasteryListDetail({
  list,
  index,
  colors,
}: {
  list: {
    list_title: string;
    mastered_count: number;
    total_words: number;
    mastery_percentage: number;
  };
  index: number;
  colors: string[];
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: colors[index % colors.length] }}
        />
        <span className="font-medium">{list.list_title}</span>
      </div>
      <div className="text-right">
        <div className="font-bold">{list.mastery_percentage}%</div>
        <div className="text-xs text-muted-foreground">
          {list.mastered_count}/{list.total_words} words
        </div>
      </div>
    </div>
  );
}

// Mastery Section Component
function MasterySection({
  masteryData,
  colors,
}: {
  masteryData: Array<{
    list_id: string;
    list_title: string;
    mastered_count: number;
    total_words: number;
    mastery_percentage: number;
  }>;
  colors: string[];
}) {
  if (masteryData.length === 0) {
    return null;
  }

  return (
    <>
      <h3 className="text-xl font-bold mb-4">Mastery by List</h3>
      <div className="grid md:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <MasteryPieChart masteryData={masteryData} colors={colors} />

        {/* Table View */}
        <MasteryTableView masteryData={masteryData} colors={colors} />
      </div>
    </>
  );
}

// Label formatter for pie chart
const formatPieLabel = (entry: { list_title: string; mastery_percentage: number }) =>
  `${entry.list_title}: ${entry.mastery_percentage}%`;

// Pie Chart Component
function MasteryPieChart({
  masteryData,
  colors,
}: {
  masteryData: Array<{
    list_id: string;
    list_title: string;
    mastery_percentage: number;
  }>;
  colors: string[];
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={masteryData}
          dataKey="mastery_percentage"
          nameKey="list_title"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={formatPieLabel}
        >
          {masteryData.map((entry, index: number) => (
            <Cell
              key={`cell-${entry.list_id}`}
              fill={colors[index % colors.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Table View Component
function MasteryTableView({
  masteryData,
  colors,
}: {
  masteryData: Array<{
    list_id: string;
    list_title: string;
    mastered_count: number;
    total_words: number;
    mastery_percentage: number;
  }>;
  colors: string[];
}) {
  return (
    <div className="space-y-2">
      <h4 className="font-semibold mb-3">Details</h4>
      {masteryData.map(
        (
          list: {
            list_id: string;
            list_title: string;
            mastered_count: number;
            total_words: number;
            mastery_percentage: number;
          },
          index: number
        ) => (
          <MasteryListDetail
            key={list.list_id}
            list={list}
            index={index}
            colors={colors}
          />
        )
      )}
    </div>
  );
}

export function AnalyticsDashboard({
  childId,
  overview,
}: AnalyticsDashboardProps) {
  // If overview data not provided, return placeholder
  if (!childId) {
    return (
      <Card>
        <div className="text-center py-8 text-muted-foreground">
          Select a child to view analytics
        </div>
      </Card>
    );
  }

  if (!overview) {
    return (
      <Card>
        <div className="text-center py-8 text-muted-foreground">
          Loading analytics...
        </div>
      </Card>
    );
  }

  const { summary, accuracy_over_time, attempts_by_mode, mastery_by_list } =
    overview;

  // Prepare data for charts
  const accuracyData = accuracy_over_time || [];

  const modeData = attempts_by_mode
    ? Object.entries(attempts_by_mode).map(([mode, count]) => ({
        mode: mode === "listen-type" ? "Listen & Type" : "Say & Spell",
        count: count as number,
      }))
    : [];

  const masteryData = mastery_by_list || [];

  // Chart colors from theme
  const COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--secondary))",
    "hsl(var(--accent))",
    "hsl(var(--destructive))",
    "hsl(var(--muted))",
  ];

  return (
    <AnalyticsDashboardContent
      summary={summary}
      accuracyData={accuracyData}
      modeData={modeData}
      masteryData={masteryData}
      colors={COLORS}
    />
  );
}

// Dashboard Content Component
function AnalyticsDashboardContent({
  summary,
  accuracyData,
  modeData,
  masteryData,
  colors,
}: {
  summary: ParentOverviewData["summary"];
  accuracyData: ParentOverviewData["accuracy_over_time"];
  modeData: Array<{ mode: string; count: number }>;
  masteryData: ParentOverviewData["mastery_by_list"];
  colors: string[];
}) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Award className="text-secondary" size={24} />}
          iconColor="bg-secondary/10"
          value={summary?.total_words_mastered || 0}
          label="Words Mastered"
        />
        <SummaryCard
          icon={<TrendingUp className="text-primary" size={24} />}
          iconColor="bg-primary/10"
          value={`${summary?.current_streak_days || 0} days`}
          label="Current Streak"
        />
        <SummaryCard
          icon={<Target className="text-accent" size={24} />}
          iconColor="bg-accent/10"
          value={`${summary?.avg_accuracy_7d?.toFixed(0) || 0}%`}
          label="7-Day Accuracy"
        />
        <SummaryCard
          icon={<Clock className="text-secondary" size={24} />}
          iconColor="bg-secondary/10"
          value={`${Math.floor(summary?.total_time_on_task_minutes || 0)} min`}
          label="Time on Task"
        />
      </div>

      <AccuracyChart accuracyData={accuracyData} />
      <AttemptsModeChart modeData={modeData} />
      <MasterySection masteryData={masteryData} colors={colors} />

      {/* Empty State */}
      {accuracyData.length === 0 &&
        modeData.length === 0 &&
        masteryData.length === 0 && (
          <Card>
            <div className="text-center py-8 text-muted-foreground">
              No practice data available for the selected time range.
            </div>
          </Card>
        )}
    </div>
  );
}

// Accuracy Chart Component
function AccuracyChart({
  accuracyData,
}: {
  accuracyData: ParentOverviewData["accuracy_over_time"];
}) {
  if (accuracyData.length === 0) {
    return null;
  }

  return (
    <Card>
      <h3 className="text-xl font-bold mb-4">Accuracy Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={accuracyData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            stroke="hsl(var(--foreground))"
            tick={{ fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis
            stroke="hsl(var(--foreground))"
            tick={{ fill: "hsl(var(--muted-foreground))" }}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="accuracy"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ fill: "hsl(var(--primary))", r: 4 }}
            activeDot={{ r: 6 }}
            name="Accuracy (%)"
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

// Attempts by Mode Chart Component
function AttemptsModeChart({
  modeData,
}: {
  modeData: Array<{ mode: string; count: number }>;
}) {
  if (modeData.length === 0) {
    return null;
  }

  return (
    <Card>
      <h3 className="text-xl font-bold mb-4">Practice Modes</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={modeData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="mode"
            stroke="hsl(var(--foreground))"
            tick={{ fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis
            stroke="hsl(var(--foreground))"
            tick={{ fill: "hsl(var(--muted-foreground))" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
          />
          <Legend />
          <Bar dataKey="count" fill="hsl(var(--secondary))" name="Attempts" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
