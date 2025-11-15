import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import { AnalyticsDashboard } from "@/app/components/AnalyticsDashboard";
import { ExportButton } from "@/app/components/ExportButton";
import { useAuth } from "@/app/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  List,
  TrendingUp,
  AlertTriangle,
  Play,
  Calendar,
  Users,
} from "lucide-react";
import { useParentOverview } from "@/app/api/supa";

// Type for n-gram error patterns returned by the RPC
interface NgramErrorPattern {
  pattern: string;
  common_error: string;
  occurrences: number;
  last_seen: string;
}

// Component for mistake pattern row
function MistakePatternRow({ pattern }: { pattern: NgramErrorPattern }) {
  return (
    <tr className="border-b border-border hover:bg-muted">
      <td className="py-2 px-2 sm:px-3 font-mono text-xs sm:text-sm font-semibold text-primary break-all">
        {pattern.pattern}
      </td>
      <td className="py-2 px-2 sm:px-3 font-mono text-xs sm:text-sm text-destructive break-all">
        {pattern.common_error}
      </td>
      <td className="py-2 px-2 sm:px-3 text-center text-xs sm:text-sm font-bold">
        {pattern.occurrences}
      </td>
      <td className="py-2 px-2 sm:px-3 text-xs sm:text-sm text-muted-foreground hidden sm:table-cell">
        {new Date(pattern.last_seen).toLocaleDateString()}
      </td>
    </tr>
  );
}

// Component for N-gram Error Patterns Table
function CommonMistakesTable({ patterns }: { patterns: NgramErrorPattern[] }) {
  return (
    <Card>
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <AlertTriangle className="text-destructive" size={20} />
        <h3 className="text-base sm:text-lg md:text-xl font-bold">
          Common Spelling Mistakes
        </h3>
      </div>
      <MistakePatternTable patterns={patterns} />
    </Card>
  );
}

// Table component for mistake patterns
function MistakePatternTable({ patterns }: { patterns: NgramErrorPattern[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <MistakePatternTableHeader />
        <tbody>
          {patterns.slice(0, 10).map((pattern) => (
            <MistakePatternRow
              key={`${pattern.pattern}-${pattern.common_error}-${pattern.last_seen}`}
              pattern={pattern}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Table header component
function MistakePatternTableHeader() {
  return (
    <thead>
      <tr className="border-b-2 border-border">
        <th className="text-left py-2 px-2 sm:px-3 text-xs sm:text-sm font-semibold">
          Pattern
        </th>
        <th className="text-left py-2 px-2 sm:px-3 text-xs sm:text-sm font-semibold">
          Error
        </th>
        <th className="text-center py-2 px-2 sm:px-3 text-xs sm:text-sm font-semibold">
          #
        </th>
        <th className="text-left py-2 px-2 sm:px-3 text-xs sm:text-sm font-semibold hidden sm:table-cell">
          Last Seen
        </th>
      </tr>
    </thead>
  );
}

// Component for Hardest Words Section
function HardestWordsSection({
  hardestWords,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hardestWords: any[];
}) {
  return (
    <Card>
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <AlertTriangle className="text-destructive" size={20} />
        <h3 className="text-base sm:text-lg md:text-xl font-bold">
          Hardest Words
        </h3>
      </div>
      <div className="space-y-2">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {hardestWords.map((entry: any) => (
          <div
            key={entry.word_id}
            className="flex items-center justify-between p-2 bg-destructive/10 rounded text-sm sm:text-base"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{entry.word}</p>
              <p className="text-xs text-muted-foreground">
                Error rate: {entry.error_rate?.toFixed(0)}%
              </p>
            </div>
            <div className="text-xs sm:text-sm text-destructive font-bold ml-2">
              Ease: {entry.ease.toFixed(1)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Helper component for Quick Action cards
function QuickActionCard({
  icon,
  iconBgClass,
  title,
  description,
  buttonLabel,
  buttonProps,
  linkTo,
}: {
  icon: React.ReactNode;
  iconBgClass: string;
  title: string;
  description: string;
  buttonLabel: string;
  buttonProps?: React.ComponentProps<typeof Button>;
  linkTo?: string;
}) {
  return (
    <Card>
      <div className="flex items-start gap-3 sm:gap-4">
        <div className={`p-2 sm:p-3 ${iconBgClass} rounded-lg shrink-0`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm sm:text-base md:text-lg mb-1">
            {title}
          </h3>
          <p className="text-muted-foreground text-xs sm:text-sm mb-2 sm:mb-3">
            {description}
          </p>
          {linkTo ? (
            <Link to={linkTo}>
              <Button size="sm" {...buttonProps}>
                {buttonLabel}
              </Button>
            </Link>
          ) : (
            <Button size="sm" {...buttonProps}>
              {buttonLabel}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// Component for Child View Preview Card
function ChildViewPreview({ onSwitch }: { onSwitch: () => void }) {
  return (
    <Card className="bg-muted border-primary">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-primary/20 rounded-lg">
          <Play className="text-primary" size={24} />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-1">Preview Child Mode</h3>
          <p className="text-muted-foreground text-sm mb-3">
            See how your child experiences the spelling activities
          </p>
          <Button size="sm" onClick={onSwitch} variant="secondary">
            Switch to Child View
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Component for Quick Actions Grid
function QuickActionsGrid({
  onSwitchToChild,
}: {
  onSwitchToChild: () => void;
}) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        <QuickActionCard
          icon={<List className="text-primary" size={20} />}
          iconBgClass="bg-primary/20"
          title="Spelling Lists"
          description="Create and manage spelling word lists"
          buttonLabel="View Lists"
          linkTo="/parent/lists"
        />
        <QuickActionCard
          icon={<Users className="text-secondary" size={20} />}
          iconBgClass="bg-secondary/20"
          title="Child Accounts"
          description="Manage your children's accounts"
          buttonLabel="Manage Children"
          linkTo="/parent/children"
        />
        <QuickActionCard
          icon={<Plus className="text-accent-foreground" size={20} />}
          iconBgClass="bg-accent/20"
          title="Quick Actions"
          description="Create a new spelling list"
          buttonLabel="New List"
          linkTo="/parent/lists/new"
        />
      </div>

      <ChildViewPreview onSwitch={onSwitchToChild} />
    </>
  );
}

// Component for Analytics Filters
function AnalyticsFilters({
  timeRange,
  onTimeRangeChange,
  selectedChildId,
  dateFrom,
  dateTo,
}: {
  timeRange: "7d" | "30d" | "90d" | "all";
  onTimeRangeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  selectedChildId: string;
  dateFrom: Date;
  dateTo: Date;
}) {
  return (
    <Card>
      <h3 className="text-xl font-bold mb-4">Analytics Filters</h3>
      <FiltersContent
        timeRange={timeRange}
        onTimeRangeChange={onTimeRangeChange}
        selectedChildId={selectedChildId}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />
    </Card>
  );
}

// Content for filters
function FiltersContent({
  timeRange,
  onTimeRangeChange,
  selectedChildId,
  dateFrom,
  dateTo,
}: {
  timeRange: "7d" | "30d" | "90d" | "all";
  onTimeRangeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  selectedChildId: string;
  dateFrom: Date;
  dateTo: Date;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Time Range Selector */}
      <div>
        <label
          htmlFor="time-range-select"
          className="block text-sm font-medium mb-2"
        >
          <Calendar className="inline w-4 h-4 mr-1" />
          Time Range
        </label>
        <select
          id="time-range-select"
          value={timeRange}
          onChange={onTimeRangeChange}
          className="w-full px-3 py-2 bg-background border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {/* Export Button */}
      <div className="flex items-end">
        <ExportButton
          childId={selectedChildId}
          dateFrom={dateFrom}
          dateTo={dateTo}
          variant="parent"
        />
      </div>
    </div>
  );
}

export function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // State for filters - use parent ID as default (testing without child relationship)
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "all">(
    "30d",
  );
  const [dateFrom, setDateFrom] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  });
  const [dateTo, setDateTo] = useState<Date>(new Date());

  // Handler for switching to child view
  const handleSwitchToChild = useCallback(() => {
    navigate("/child/home");
  }, [navigate]);

  // Handler for time range change
  const handleTimeRangeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setTimeRange(e.target.value as typeof timeRange);
    },
    [],
  );

  // Auto-select parent ID for testing (in production would use actual child selector)
  useEffect(() => {
    if (profile?.id && !selectedChildId) {
      setSelectedChildId(profile.id);
    }
  }, [profile, selectedChildId]);

  // Update date range when timeRange changes
  useEffect(() => {
    const today = new Date();
    const from = new Date();

    switch (timeRange) {
      case "7d":
        from.setDate(today.getDate() - 7);
        break;
      case "30d":
        from.setDate(today.getDate() - 30);
        break;
      case "90d":
        from.setDate(today.getDate() - 90);
        break;
      case "all":
        from.setFullYear(2000);
        break;
      default:
        // Default to 30 days
        from.setDate(today.getDate() - 30);
        break;
    }

    setDateFrom(from);
    setDateTo(today);
  }, [timeRange]);

  // Fetch overview analytics
  const { data: overview, isLoading: isLoadingOverview } = useParentOverview(
    profile?.id,
    dateFrom,
    dateTo,
  );

  // Type assertion for overview (RPC returns Json type)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedOverview = overview as any;

  return (
    <AppShell title="SpellStars" variant="parent">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Welcome Section */}
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
            Welcome back
            {profile?.display_name ? `, ${profile.display_name}` : ""}!
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage your child&apos;s spelling lists and track their progress.
          </p>
        </div>

        {/* Quick Actions */}
        <QuickActionsGrid onSwitchToChild={handleSwitchToChild} />

        {/* Filters Section */}
        <AnalyticsFilters
          timeRange={timeRange}
          onTimeRangeChange={handleTimeRangeChange}
          selectedChildId={selectedChildId}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />

        {/* N-gram Error Patterns */}
        {typedOverview?.common_mistake_patterns?.length > 0 && (
          <CommonMistakesTable
            patterns={typedOverview.common_mistake_patterns}
          />
        )}

        {/* Hardest Words Section */}
        {typedOverview?.hardest_words?.length > 0 && (
          <HardestWordsSection hardestWords={typedOverview.hardest_words} />
        )}

        {/* Analytics Dashboard with Charts */}
        {isLoadingOverview ? (
          <Card>
            <div className="text-center py-8 text-muted-foreground">
              Loading analytics...
            </div>
          </Card>
        ) : (
          <AnalyticsDashboard
            childId={selectedChildId}
            overview={typedOverview}
          />
        )}
      </div>
    </AppShell>
  );
}
