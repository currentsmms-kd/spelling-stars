import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import { Link, useNavigate } from "react-router-dom";
import { Headphones, Mic, TrendingUp, type LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/app/supabase";
import { useAuth } from "@/app/hooks/useAuth";

interface ListProgress {
  id: string;
  title: string;
  word_count: number;
  progress_percentage: number;
  last_mode?: "listen-type" | "say-spell";
}

function GameCard({
  icon: Icon,
  title,
  description,
  href,
  bgColor,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  bgColor: string;
}) {
  return (
    <Card variant="child">
      <div className="text-center space-y-6">
        <div
          className={`w-24 h-24 ${bgColor} rounded-full flex items-center justify-center mx-auto`}
        >
          <Icon
            className={bgColor.replace("bg-", "text-").replace("-100", "-700")}
            size={48}
          />
        </div>
        <div>
          <h3 className="text-3xl font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-xl text-gray-600">{description}</p>
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
    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
      <div
        className="bg-primary-500 h-2 rounded-full transition-all"
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
  const progressContent = (
    <>
      <div className="flex-1">
        <p className="text-xl font-semibold">{list.title}</p>
        <div className="flex items-center gap-4 mt-2 text-gray-600">
          <span className="text-lg">
            {list.word_count} {list.word_count === 1 ? "word" : "words"}
          </span>
          <div className="flex items-center gap-2">
            <TrendingUp size={18} />
            <span className="text-lg font-medium">
              {list.progress_percentage}% complete
            </span>
          </div>
        </div>
        <ProgressBar percentage={list.progress_percentage} />
      </div>
      {list.last_mode && list.word_count > 0 && (
        <Button
          size="child"
          onClick={() => onContinue(list.id, list.last_mode as string)}
          className="ml-4"
        >
          Continue
        </Button>
      )}
    </>
  );

  return (
    <div className="p-4 bg-gray-50 rounded-xl border hover:border-primary-300 transition-colors">
      <div className="flex items-center justify-between">{progressContent}</div>
    </div>
  );
}

export function ChildHome() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Get lists with progress calculation based on attempts from last 7 days
  const { data: lists } = useQuery<ListProgress[]>({
    queryKey: ["child-lists", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      // Get all lists with word count
      const { data: listsData, error: listsError } = await supabase
        .from("word_lists")
        .select(
          `
          id,
          title,
          list_words (
            word_id
          )
        `
        )
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
          const lastMode =
            attempts && attempts.length > 0
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

  const handleContinueList = (listId: string, mode: string) => {
    navigate(`/child/play/${mode}?list=${listId}`);
  };

  return (
    <AppShell title="SpellStars" variant="child">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-primary-700 mb-4">
            Ready to practice spelling?
          </h2>
          <p className="text-2xl text-gray-600">Choose a game to play!</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <GameCard
            icon={Headphones}
            title="Listen & Type"
            description="Hear the word and type it out"
            href="/child/play/listen-type"
            bgColor="bg-primary-100"
          />
          <GameCard
            icon={Mic}
            title="Say & Spell"
            description="Say the spelling out loud"
            href="/child/play/say-spell"
            bgColor="bg-secondary-100"
          />
        </div>

        {lists && lists.length > 0 && (
          <Card variant="child">
            <h3 className="text-2xl font-bold mb-4">Your Spelling Lists</h3>
            <div className="space-y-3">
              {lists.map((list) => (
                <ListProgressCard
                  key={list.id}
                  list={list}
                  onContinue={handleContinueList}
                />
              ))}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
