import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import { AnalyticsDashboard } from "@/app/components/AnalyticsDashboard";
import { useAuth } from "@/app/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { Plus, List, TrendingUp, AlertTriangle, Play } from "lucide-react";
import { useHardestWords, useMostLapsedWords } from "@/app/api/supa";
import type { Database } from "@/types/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type SrsEntry = Database["public"]["Tables"]["srs"]["Row"] & {
  word: { text: string };
};

// Extracted Quick Action Card Component
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
      <div className="flex items-start gap-4">
        <div className={`p-3 ${iconBgClass} rounded-lg`}>{icon}</div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-1">{title}</h3>
          <p className="text-muted-foreground text-sm mb-3">{description}</p>
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

// Extracted SRS Word Entry Component
function SrsWordEntry({
  word,
  ease,
  reps,
  lapses,
}: {
  word: string;
  ease: number;
  reps: number;
  lapses: number;
}) {
  return (
    <div className="flex items-center justify-between p-2 bg-destructive/10 rounded">
      <div>
        <p className="font-semibold">{word}</p>
        <p className="text-xs text-muted-foreground">
          {reps} reps, {lapses} lapses
        </p>
      </div>
      <div className="text-sm text-destructive font-bold">
        Ease: {ease.toFixed(1)}
      </div>
    </div>
  );
}

// Extracted Most Lapsed Word Entry Component
function MostLapsedWordEntry({
  word,
  ease,
  reps,
  lapses,
}: {
  word: string;
  ease: number;
  reps: number;
  lapses: number;
}) {
  return (
    <div className="flex items-center justify-between p-2 bg-destructive/10 rounded">
      <div>
        <p className="font-semibold">{word}</p>
        <p className="text-xs text-muted-foreground">
          {reps} reps, Ease: {ease.toFixed(1)}
        </p>
      </div>
      <div className="text-sm text-destructive font-bold">
        {lapses} {lapses === 1 ? "lapse" : "lapses"}
      </div>
    </div>
  );
}

// Extracted SRS Insights Card Component
function SrsInsightsCard({
  title,
  words,
  type,
}: {
  title: string;
  words: SrsEntry[] | undefined;
  type: "hardest" | "lapsed";
}) {
  const EntryComponent =
    type === "hardest" ? SrsWordEntry : MostLapsedWordEntry;

  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <AlertTriangle className="text-destructive" size={24} />
        <h3 className="text-xl font-bold">{title}</h3>
      </div>
      {words && words.length > 0 ? (
        <div className="space-y-2">
          {words.map((entry) => (
            <EntryComponent
              key={entry.id}
              word={entry.word.text}
              ease={entry.ease}
              reps={entry.reps}
              lapses={entry.lapses}
            />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-4">
          No SRS data yet. Words will appear here after practice.
        </p>
      )}
    </Card>
  );
}

// Extracted Dashboard Content Component
function DashboardContent({
  profile,
  navigate,
  hardestWords,
  mostLapsedWords,
}: {
  profile: Profile | null;
  navigate: ReturnType<typeof useNavigate>;
  hardestWords: SrsEntry[] | undefined;
  mostLapsedWords: SrsEntry[] | undefined;
}) {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Welcome back
          {profile?.display_name ? `, ${profile.display_name}` : ""}!
        </h2>
        <p className="text-muted-foreground">
          Manage your child&apos;s spelling lists and track their progress.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <QuickActionCard
          icon={<List className="text-primary" size={24} />}
          iconBgClass="bg-primary/20"
          title="Spelling Lists"
          description="Create and manage spelling word lists"
          buttonLabel="View Lists"
          linkTo="/parent/lists"
        />
        <QuickActionCard
          icon={<TrendingUp className="text-secondary" size={24} />}
          iconBgClass="bg-secondary/20"
          title="Progress"
          description="View your child's spelling progress"
          buttonLabel="Coming Soon"
          buttonProps={{ disabled: true }}
        />
        <QuickActionCard
          icon={<Plus className="text-accent-foreground" size={24} />}
          iconBgClass="bg-accent/20"
          title="Quick Actions"
          description="Create a new spelling list"
          buttonLabel="New List"
          linkTo="/parent/lists/new"
        />
      </div>

      {/* Child View Access */}
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
            <Button
              size="sm"
              onClick={() => navigate("/child/home")}
              variant="secondary"
            >
              Switch to Child View
            </Button>
          </div>
        </div>
      </Card>

      {/* SRS Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SrsInsightsCard
          title="Hardest Words"
          words={hardestWords}
          type="hardest"
        />
        <SrsInsightsCard
          title="Most Lapsed Words"
          words={mostLapsedWords}
          type="lapsed"
        />
      </div>

      <Card>
        <h3 className="text-xl font-bold mb-4">Recent Activity</h3>
        <AnalyticsDashboard childId={profile?.id} />
      </Card>
    </div>
  );
}

export function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Get SRS insights - parent can view their own data or need a child selector
  const { data: hardestWords } = useHardestWords(profile?.id, 5);
  const { data: mostLapsedWords } = useMostLapsedWords(profile?.id, 5);

  return (
    <AppShell title="SpellStars" variant="parent">
      <DashboardContent
        profile={profile}
        navigate={navigate}
        hardestWords={hardestWords}
        mostLapsedWords={mostLapsedWords}
      />
    </AppShell>
  );
}
