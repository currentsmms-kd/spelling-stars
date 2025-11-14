import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import {
  WordSearchGame,
  WordSearchSummary,
} from "@/app/components/games/WordSearchGame";
import { useAuth } from "@/app/hooks/useAuth";
import { supabase } from "@/app/supabase";
import {
  getListWithWords,
  WordListWithWords,
  useAwardStars,
} from "@/app/api/supa";
import { logger } from "@/lib/logger";
import { toast } from "react-hot-toast";

interface BasicList {
  id: string;
  title: string;
  word_count?: number;
}

const DEMO_WORDS = [
  "galaxy",
  "orbit",
  "comet",
  "rocket",
  "planet",
  "asteroid",
  "meteor",
  "satellite",
  "nebula",
  "gravity",
  "telescope",
  "lunar",
];

interface WordSearchResultPayload {
  listId: string | null;
  seed: number;
  seconds: number;
  total: number;
  found: number;
  metadata?: Record<string, unknown>;
}

async function recordWordSearchResult(
  payload: WordSearchResultPayload
): Promise<void> {
  const { error } = await supabase.rpc("record_word_search_result", {
    p_list_id: payload.listId,
    p_seed: payload.seed,
    p_duration_seconds: payload.seconds,
    p_total_words: payload.total,
    p_found_words: payload.found,
    p_metadata: payload.metadata ?? {},
  });

  if (error) {
    throw error;
  }
}

export function PlayWordSearch() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [seed, setSeed] = useState(() => Date.now());
  const [gridSize, setGridSize] = useState(12);
  const [allowDiagonals, setAllowDiagonals] = useState(true);
  const [allowBackwards, setAllowBackwards] = useState(true);
  const [seedInput, setSeedInput] = useState(() => seed.toString());
  const [showSettings, setShowSettings] = useState(false);
  const awardStars = useAwardStars();

  const listIdParam = searchParams.get("listId");
  const [selectedListId, setSelectedListId] = useState<string | null>(
    listIdParam
  );

  useEffect(() => {
    setSelectedListId(listIdParam);
  }, [listIdParam]);

  const {
    data: availableLists = [],
    isLoading: isLoadingLists,
    error: listError,
  } = useQuery<BasicList[]>({
    queryKey: ["word_lists_for_child", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("word_lists")
        .select("id, title, list_words(count)")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []).map((entry) => {
        const listWords = entry.list_words as unknown;
        let wordCount = 0;
        if (Array.isArray(listWords) && listWords.length > 0) {
          const countObj = listWords[0] as { count?: number };
          wordCount = countObj?.count ?? 0;
        }
        return {
          id: entry.id,
          title: entry.title,
          word_count: wordCount,
        };
      });
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (
      !selectedListId &&
      availableLists.length > 0 &&
      !searchParams.get("listId")
    ) {
      const defaultId = availableLists[0]?.id;
      if (defaultId) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set("listId", defaultId);
          return next;
        });
      }
    }
  }, [availableLists, selectedListId, searchParams, setSearchParams]);

  const {
    data: activeList,
    isLoading: isLoadingActiveList,
    error: activeListError,
  } = useQuery<WordListWithWords | null>({
    queryKey: ["word_search_list", selectedListId],
    enabled: Boolean(selectedListId),
    queryFn: () => {
      if (!selectedListId) return Promise.resolve(null);
      return getListWithWords(selectedListId);
    },
  });

  const usingDemoList = availableLists.length === 0;
  const puzzleWords = useMemo(() => {
    if (activeList?.words?.length) {
      return activeList.words.map((word) => word.text);
    }
    if (usingDemoList) {
      return DEMO_WORDS;
    }
    return [];
  }, [activeList?.words, usingDemoList]);

  const listTitle =
    activeList?.title ?? (usingDemoList ? "Space Demo List" : "");

  const handleListChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextId = event.target.value || null;
    setSelectedListId(nextId);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (nextId) {
        params.set("listId", nextId);
      } else {
        params.delete("listId");
      }
      return params;
    });
  };

  const handleApplySeed = () => {
    const numericSeed = Number(seedInput);
    if (Number.isFinite(numericSeed) && numericSeed > 0) {
      setSeed(numericSeed);
    } else {
      toast.error("Enter a valid seed number greater than 0");
    }
  };

  const handleRandomSeed = () => {
    const randomSeed = Date.now();
    setSeed(randomSeed);
    setSeedInput(randomSeed.toString());
  };

  const handleComplete = async (summary: WordSearchSummary) => {
    if (!profile?.id) return;
    try {
      if (summary.foundWords.length > 0) {
        await awardStars.mutateAsync({
          userId: profile.id,
          amount: summary.foundWords.length,
          reason: "word_search_complete",
        });
      }
      await recordWordSearchResult({
        listId: selectedListId,
        seed: summary.seed,
        seconds: summary.secondsElapsed,
        total: summary.totalPlaced,
        found: summary.foundWords.length,
        metadata: {
          totalRequested: summary.totalRequested,
          unplaced: summary.unplaced,
          gridSize,
          allowDiagonals,
          allowBackwards,
        },
      });
      toast.success("Great job! Stars awarded for your puzzle.");
    } catch (error) {
      logger.error("Word search completion error:", error);
      toast.error(
        "You finished the puzzle, but we could not save the reward yet."
      );
    }
  };

  return (
    <AppShell title="Word Search" variant="child">
      <div className="space-y-3">
        <Card variant="child" className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-2xl font-bold">Practice Word Search</h2>
              <p className="text-sm text-child-foreground/80 mt-1">
                {usingDemoList
                  ? "Practice with a fun space-themed demo list."
                  : "Playing: {listTitle}"}
              </p>
            </div>
            <Button
              variant="outline"
              size="default"
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2"
            >
              {showSettings ? (
                <>
                  <span>Hide Settings</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </>
              ) : (
                <>
                  <span>Settings</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </Button>
          </div>

          {showSettings && (
            <div className="mt-4 pt-4 border-t border-border space-y-4">
              <div className="grid gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5 md:space-y-2">
              <label
                htmlFor="word-search-list"
                className="text-xs md:text-sm font-semibold uppercase text-muted-foreground"
              >
                Spelling List
              </label>
              {isLoadingLists ? (
                <p className="text-base md:text-lg">Loading lists…</p>
              ) : availableLists.length > 0 ? (
                <select
                  id="word-search-list"
                  value={selectedListId ?? ""}
                  onChange={handleListChange}
                  className="w-full rounded-lg border border-border bg-background px-2 md:px-3 py-1.5 md:py-2 text-base md:text-lg"
                >
                  {availableLists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.title} ({list.word_count ?? 0} words)
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-base md:text-lg font-semibold text-muted-foreground">
                  No lists yet — using demo words.
                </p>
              )}
              {listError && (
                <p className="text-xs md:text-sm text-destructive">
                  {listError instanceof Error
                    ? listError.message
                    : "Could not load word lists."}
                </p>
              )}
            </div>

            <div className="space-y-1.5 md:space-y-2">
              <label
                htmlFor="word-search-size"
                className="text-xs md:text-sm font-semibold uppercase text-muted-foreground"
              >
                Grid Size ({gridSize} × {gridSize})
              </label>
              <input
                id="word-search-size"
                type="range"
                min={8}
                max={16}
                value={gridSize}
                onChange={(event) => setGridSize(Number(event.target.value))}
                className="w-full"
              />
            </div>

            <div className="space-y-1.5 md:space-y-2">
              <label
                htmlFor="word-search-seed"
                className="text-xs md:text-sm font-semibold uppercase text-muted-foreground"
              >
                Puzzle Seed
              </label>
              <div className="flex gap-1.5 md:gap-2">
                <input
                  id="word-search-seed"
                  type="number"
                  value={seedInput}
                  onChange={(event) => setSeedInput(event.target.value)}
                  className="flex-1 rounded-lg border border-border bg-background px-2 md:px-3 py-1.5 md:py-2 text-base md:text-lg"
                  min={1}
                />
                <Button size="child" onClick={handleApplySeed}>
                  Apply
                </Button>
                <Button
                  size="child"
                  variant="outline"
                  onClick={handleRandomSeed}
                >
                  New
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-2 md:gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 md:gap-3 rounded-lg border border-border bg-background px-3 md:px-4 py-2 md:py-3">
              <input
                type="checkbox"
                checked={allowDiagonals}
                onChange={(event) => setAllowDiagonals(event.target.checked)}
                className="h-4 w-4 md:h-5 md:w-5 rounded"
              />
              <div>
                <p className="text-sm md:text-base font-semibold">
                  Allow diagonals
                </p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Words can appear in diagonal directions.
                </p>
              </div>
            </label>
            <label className="flex items-center gap-2 md:gap-3 rounded-lg border border-border bg-background px-3 md:px-4 py-2 md:py-3">
              <input
                type="checkbox"
                checked={allowBackwards}
                onChange={(event) => setAllowBackwards(event.target.checked)}
                className="h-4 w-4 md:h-5 md:w-5 rounded"
              />
              <div>
                <p className="text-sm md:text-base font-semibold">
                  Allow backwards words
                </p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Words may appear right-to-left or bottom-to-top.
                </p>
              </div>
              </div>
            </div>
          )}
        </Card>

        {activeListError && (
          <Card variant="child" className="p-4">
            <p className="text-destructive">
              {activeListError instanceof Error
                ? activeListError.message
                : "Could not load the selected list."}
            </p>
          </Card>
        )}

        {isLoadingActiveList && !usingDemoList ? (
          <Card variant="child" className="p-4">
            <p className="text-lg">Loading words…</p>
          </Card>
        ) : (
          <WordSearchGame
                words={puzzleWords}
                size={gridSize}
                allowBackwards={allowBackwards}
                allowDiagonals={allowDiagonals}
                seed={seed}
                onComplete={handleComplete}
                onNewPuzzleRequest={handleRandomSeed}
          />
        )
        }
      </div>
    </AppShell>
  );
}
