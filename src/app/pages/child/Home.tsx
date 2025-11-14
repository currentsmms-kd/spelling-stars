import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import { VisuallyHidden } from "@/app/components/VisuallyHidden";
import { Link, useNavigate } from "react-router-dom";
import {
  Headphones,
  Mic,
  TrendingUp,
  Calendar,
  ArrowLeft,
  Target,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/app/supabase";
import { useAuth } from "@/app/hooks/useAuth";
import { useDueWords, useNextBatch } from "@/app/api/supa";
import { cn } from "@/lib/utils";
import { useCallback } from "react";

interface ListProgress {
  id: string;
  title: string;
  word_count: number;
  progress_percentage: number;
  last_mode?: "listen-type" | "say-spell";
}

// Color mapping to avoid dynamic class construction (which Tailwind purges)
type GameCardColor = "primary" | "secondary" | "accent";

interface GameCardColorClasses {
  background: string;
  icon: string;
}

const GAME_CARD_COLOR_MAP: Record<GameCardColor, GameCardColorClasses> = {
  primary: {
    background: "bg-primary/20",
    icon: "text-primary",
  },
  secondary: {
    background: "bg-secondary/20",
    icon: "text-secondary",
  },
  accent: {
    background: "bg-accent/20",
    icon: "text-accent",
  },
} as const;

function GameCard({
  icon: Icon,
  title,
  description,
  href,
  color,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  color: GameCardColor;
}) {
  const colorClasses = GAME_CARD_COLOR_MAP[color];

  return (
    <Card variant="child">
      <div className="text-center space-y-3 sm:space-y-4 md:space-y-6">
        <div
          className={cn(
            "w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mx-auto",
            colorClasses.background
          )}
        >
          <Icon className={cn(colorClasses.icon)} size={36} />
        </div>
        <div>
          <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1 sm:mb-2">
            {title}
          </h3>
          <p className="text-sm sm:text-base md:text-xl text-muted-foreground">
            {description}
          </p>
        </div>
        <Link to={href} className="block">
          <Button size="child" className="w-full">
            Play
          </Button>
        </Link>
      </div>
    </Card>
  );
}

function ProgressBar({ percentage }: { percentage: number }) {
  if (percentage === 0) return null;

  return (
    <div className="mt-2 w-full bg-muted rounded-full h-2">
      <div
        className="bg-primary h-2 rounded-full transition-all"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

function ListProgressCard({
  list,
  onContinue,
}: {
  list: ListProgress;
  onContinue: (listId: string, mode: string) => void;
}) {
  const handleContinue = useCallback(() => {
    onContinue(list.id, list.last_mode as string);
  }, [list.id, list.last_mode, onContinue]);

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <ListProgressInfo list={list} />
      {list.last_mode && list.word_count > 0 && (
        <Button
          size="child"
          onClick={handleContinue}
          className="w-full sm:w-auto sm:ml-4 shrink-0"
          aria-label={`Continue practicing ${list.title} in ${list.last_mode} mode`}
        >
          Continue
        </Button>
      )}
    </div>
  );
}

function ListProgressInfo({ list }: { list: ListProgress }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-base sm:text-lg md:text-xl font-semibold truncate">
        {list.title}
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-2 text-muted-foreground">
        <span className="text-sm sm:text-base md:text-lg">
          {list.word_count} {list.word_count === 1 ? "word" : "words"}
        </span>
        <div className="flex items-center gap-2">
          <TrendingUp size={16} />
          <span className="text-sm sm:text-base md:text-lg font-medium">
            {list.progress_percentage}% complete
          </span>
        </div>
      </div>
      <ProgressBar percentage={list.progress_percentage} />
    </div>
  );
}

function DueWordCard({
  dueWord,
}: {
  dueWord: {
    id: string;
    word: { text: string };
    lists: Array<{ title: string }>;
    ease: number;
    reps: number;
  };
}) {
  return (
    <div className="flex items-center justify-between p-2 sm:p-3 bg-primary/10 rounded-lg">
      <div className="min-w-0 flex-1">
        <p className="text-base sm:text-lg md:text-xl font-semibold truncate">
          {dueWord.word.text}
        </p>
        <p className="text-xs sm:text-sm text-muted-foreground truncate">
          {dueWord.lists.length > 0
            ? dueWord.lists.map((l: { title: string }) => l.title).join(", ")
            : "No list"}
        </p>
      </div>
      <div className="text-right text-xs sm:text-sm text-muted-foreground ml-2">
        <div>Ease: {dueWord.ease.toFixed(1)}</div>
        <div>Reps: {dueWord.reps}</div>
      </div>
    </div>
  );
}

function DueWordsSection({
  dueWords,
}: {
  dueWords: Array<{
    id: string;
    word: { text: string };
    lists: Array<{ title: string }>;
    ease: number;
    reps: number;
  }>;
}) {
  if (!dueWords || dueWords.length === 0) return null;

  return (
    <Card variant="child">
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <Calendar className="text-primary" size={24} aria-hidden="true" />
        <h3 className="text-xl sm:text-2xl font-bold">Due Today</h3>
      </div>
      <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-3 sm:mb-4">
        {dueWords.length} {dueWords.length === 1 ? "word" : "words"} ready for
        review
      </p>
      <div className="space-y-2">
        {dueWords.slice(0, 5).map((dueWord) => (
          <DueWordCard key={dueWord.id} dueWord={dueWord} />
        ))}
      </div>
      {dueWords.length > 5 && (
        <p className="text-center text-sm sm:text-base text-muted-foreground mt-3">
          And {dueWords.length - 5} more...
        </p>
      )}
    </Card>
  );
}

function ListsSection({
  lists,
  onContinue,
}: {
  lists: ListProgress[] | undefined;
  onContinue: (listId: string, mode: string) => void;
}) {
  if (!lists || lists.length === 0) return null;

  return (
    <Card variant="child">
      <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
        Your Spelling Lists
      </h3>
      <div className="space-y-3">
        {lists.map((list) => (
          <div
            key={list.id}
            className="p-3 sm:p-4 bg-muted/50 rounded-xl border border-border hover:border-primary transition-colors"
          >
            <ListProgressCard list={list} onContinue={onContinue} />
          </div>
        ))}
      </div>
    </Card>
  );
}

// Next Up Counter Component
function NextUpCounter({ childId }: { childId: string }) {
  const { data: nextBatch } = useNextBatch(childId, undefined, 15, false);

  if (!nextBatch || nextBatch.length === 0) return null;

  // Count by batch type
  const counts = nextBatch.reduce(
    (acc, word) => {
      acc[word.batch_type] = (acc[word.batch_type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const totalDue = nextBatch.length;
  const dueCount = counts.due || 0;
  const leechCount = counts.leech || 0;
  const reviewCount = counts.review || 0;
  const newCount = counts.new || 0;

  return (
    <Card variant="child">
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4">
        <Target className="text-primary" size={24} aria-hidden="true" />
        <h3 className="text-xl sm:text-2xl md:text-3xl font-bold">Next Up</h3>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
        <div className="text-center p-2 sm:p-3 md:p-4 bg-primary/10 rounded-xl">
          <VisuallyHidden>{dueCount} words due for review</VisuallyHidden>
          <div
            className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary"
            aria-hidden="true"
          >
            {dueCount}
          </div>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground mt-1">
            Due
          </p>
        </div>

        {leechCount > 0 && (
          <div className="text-center p-2 sm:p-3 md:p-4 bg-destructive/10 rounded-xl">
            <VisuallyHidden>{leechCount} words need work</VisuallyHidden>
            <div
              className="text-2xl sm:text-3xl md:text-4xl font-bold text-destructive"
              aria-hidden="true"
            >
              {leechCount}
            </div>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground mt-1">
              Needs Work
            </p>
          </div>
        )}

        {reviewCount > 0 && (
          <div className="text-center p-2 sm:p-3 md:p-4 bg-secondary/10 rounded-xl">
            <VisuallyHidden>{reviewCount} words for review</VisuallyHidden>
            <div
              className="text-2xl sm:text-3xl md:text-4xl font-bold text-secondary"
              aria-hidden="true"
            >
              {reviewCount}
            </div>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground mt-1">
              Review
            </p>
          </div>
        )}

        {newCount > 0 && (
          <div className="text-center p-2 sm:p-3 md:p-4 bg-accent/10 rounded-xl">
            <VisuallyHidden>{newCount} new words</VisuallyHidden>
            <div
              className="text-2xl sm:text-3xl md:text-4xl font-bold text-accent"
              aria-hidden="true"
            >
              {newCount}
            </div>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground mt-1">
              New
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 sm:mt-4 text-center">
        <p className="text-base sm:text-lg md:text-xl text-muted-foreground">
          <span className="font-bold text-foreground">{totalDue}</span> words
          ready to practice
        </p>
      </div>
    </Card>
  );
}

export function ChildHome() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Get due words
  const { data: dueWords } = useDueWords(profile?.id);

  // Get lists with progress calculation based on attempts from last 7 days
  const { data: lists } = useQuery<ListProgress[]>({
    queryKey: ["child-lists", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      // Get all lists with word count
      const { data: listsData, error: listsError } = await supabase
        .from("word_lists")
        .select("id, title, list_words (word_id)")
        .order("created_at", { ascending: false });

      if (listsError) throw listsError;

      // Calculate progress for each list
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const listsWithProgress = await Promise.all(
        (listsData || []).map(async (list) => {
          const wordIds =
            list.list_words?.map((lw: { word_id: string }) => lw.word_id) || [];
          const wordCount = wordIds.length;

          if (wordCount === 0) {
            return {
              id: list.id,
              title: list.title,
              word_count: 0,
              progress_percentage: 0,
            };
          }

          // Get attempts for these words in the last 7 days
          const { data: attempts } = await supabase
            .from("attempts")
            .select("word_id, correct, mode, started_at")
            .eq("child_id", profile.id)
            .in("word_id", wordIds)
            .gte("started_at", sevenDaysAgo.toISOString())
            .order("started_at", { ascending: false });

          // Calculate unique words with at least one correct attempt
          const correctWords = new Set(
            (attempts || [])
              .filter((a: { correct: boolean }) => a.correct)
              .map((a: { word_id: string }) => a.word_id)
          );

          const progress = (correctWords.size / wordCount) * 100;

          // Get the most recent mode used
          const lastMode = attempts?.length
            ? (attempts[0].mode as "listen-type" | "say-spell")
            : undefined;

          return {
            id: list.id,
            title: list.title,
            word_count: wordCount,
            progress_percentage: Math.round(progress),
            last_mode: lastMode,
          };
        })
      );

      return listsWithProgress;
    },
    enabled: Boolean(profile?.id),
  });

  const handleContinueList = useCallback(
    (listId: string, mode: string) => {
      navigate(`/child/play/${mode}?listId=${listId}`);
    },
    [navigate]
  );

  const handleBackToParent = useCallback(() => {
    navigate("/parent/dashboard");
  }, [navigate]);

  return (
    <AppShell title="SpellStars" variant="child">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 md:space-y-8">
        {/* Back to Parent Button */}
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleBackToParent}
            className="bg-muted hover:bg-muted/90 text-muted-foreground text-xs sm:text-sm"
          >
            <ArrowLeft size={14} className="mr-1 sm:mr-2" />
            Back to Parent Dashboard
          </Button>
        </div>

        <div className="text-center px-2">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary mb-2 sm:mb-3 md:mb-4">
            Ready to practice spelling?
          </h2>
          <p className="text-base sm:text-lg md:text-2xl text-muted-foreground">
            Choose a game to play!
          </p>
        </div>

        {/* Next Up Counter */}
        {profile?.id && <NextUpCounter childId={profile.id} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 lg:gap-8">
          <GameCard
            icon={Headphones}
            title="Listen & Type"
            description="Hear the word and type it out"
            href="/child/play/listen-type"
            color="primary"
          />
          <GameCard
            icon={Mic}
            title="Say & Spell"
            description="Say the spelling out loud"
            href="/child/play/say-spell"
            color="secondary"
          />
          <GameCard
            icon={Search}
            title="Word Search"
            description="Find your spelling words in a grid"
            href="/child/play/word-search"
            color="accent"
          />
        </div>

        <DueWordsSection dueWords={dueWords || []} />

        <ListsSection lists={lists} onContinue={handleContinueList} />
      </div>
    </AppShell>
  );
}
