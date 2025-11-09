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

// Extracted Action Button Component
function ActionButton({
  buttonLabel,
  buttonProps,
  linkTo,
}: {
  buttonLabel: string;
  buttonProps?: React.ComponentProps<typeof Button>;
  linkTo?: string;
}) {
  if (linkTo) {
    return (
      <Link to={linkTo}>
        <Button size="sm" {...buttonProps}>
          {buttonLabel}
        </Button>
      </Link>
    );
  }

  return (
    <Button size="sm" {...buttonProps}>
      {buttonLabel}
    </Button>
  );
}

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
        <IconBadge icon={icon} bgClass={iconBgClass} />
        <CardContent title={title} description={description}>
          <ActionButton
            buttonLabel={buttonLabel}
            buttonProps={buttonProps}
            linkTo={linkTo}
          />
        </CardContent>
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

// Extracted SRS Words List Component
function SrsWordsList({
  words,
  EntryComponent,
}: {
  words: SrsEntry[];
  EntryComponent: React.ComponentType<{
    word: string;
    ease: number;
    reps: number;
    lapses: number;
  }>;
}) {
  return (
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
  );
}

// Extracted Empty State Component
function EmptyState({ message }: { message: string }) {
  return <p className="text-muted-foreground text-center py-4">{message}</p>;
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
  const hasNoWords = !words || words.length === 0;
  const EntryComponent =
    type === "hardest" ? SrsWordEntry : MostLapsedWordEntry;

  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <AlertTriangle className="text-destructive" size={24} />
        <h3 className="text-xl font-bold">{title}</h3>
      </div>
      {hasNoWords ? (
        <EmptyState message="No SRS data yet. Words will appear here after practice." />
      ) : (
        <SrsWordsList words={words} EntryComponent={EntryComponent} />
      )}
    </Card>
  );
}

// Extracted Welcome Header Component
function WelcomeHeader({ displayName }: { displayName?: string | null }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-2">
        Welcome back{displayName ? `, ${displayName}` : ""}!
      </h2>
      <p className="text-muted-foreground">
        Manage your child&apos;s spelling lists and track their progress.
      </p>
    </div>
  );
}

// Extracted Quick Actions Grid Component
function QuickActionsGrid() {
  return (
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
  );
}

// Extracted Icon Badge Component
function IconBadge({
  icon,
  bgClass,
}: {
  icon: React.ReactNode;
  bgClass: string;
}) {
  return <div className={`p-3 ${bgClass} rounded-lg`}>{icon}</div>;
}

// Extracted Card Content Component
function CardContent({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1">
      <h3 className="font-semibold text-lg mb-1">{title}</h3>
      <p className="text-muted-foreground text-sm mb-3">{description}</p>
      {children}
    </div>
  );
}

// Extracted Child View Access Card Component
function ChildViewAccessCard({ onNavigate }: { onNavigate: () => void }) {
  return (
    <Card className="bg-muted border-primary">
      <div className="flex items-start gap-4">
        <IconBadge
          icon={<Play className="text-primary" size={24} />}
          bgClass="bg-primary/20"
        />
        <CardContent
          title="Preview Child Mode"
          description="See how your child experiences the spelling activities"
        >
          <Button size="sm" onClick={onNavigate} variant="secondary">
            Switch to Child View
          </Button>
        </CardContent>
      </div>
    </Card>
  );
}

// Extracted SRS Insights Section Component
function SrsInsightsSection({
  hardestWords,
  mostLapsedWords,
}: {
  hardestWords: SrsEntry[] | undefined;
  mostLapsedWords: SrsEntry[] | undefined;
}) {
  return (
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
  );
}

// Extracted Recent Activity Card Component
function RecentActivityCard({ profileId }: { profileId?: string }) {
  return (
    <Card>
      <h3 className="text-xl font-bold mb-4">Recent Activity</h3>
      <AnalyticsDashboard childId={profileId} />
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
      <WelcomeHeader displayName={profile?.display_name} />
      <QuickActionsGrid />
      <ChildViewAccessCard onNavigate={() => navigate("/child/home")} />
      <SrsInsightsSection
        hardestWords={hardestWords}
        mostLapsedWords={mostLapsedWords}
      />
      <RecentActivityCard profileId={profile?.id} />
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
