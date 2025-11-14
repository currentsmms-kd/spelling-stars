import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import { cn } from "@/lib/utils";
import {
  CellCoord,
  Direction,
  generateGrid,
  getLineCells,
  normalizeWord,
  WordPlacement,
} from "@/lib/wordsearch";

export interface WordSearchSummary {
  foundWords: string[];
  totalPlaced: number;
  totalRequested: number;
  secondsElapsed: number;
  seed: number;
  unplaced: string[];
}

export interface WordSearchGameProps {
  words: string[];
  size?: number;
  allowDiagonals?: boolean;
  allowBackwards?: boolean;
  seed?: number;
  onComplete?: (summary: WordSearchSummary) => void;
  onRestart?: () => void;
  onNewPuzzleRequest?: () => void;
}

interface NormalizedWord {
  normalized: string;
  label: string;
}

const DEFAULT_WORDS: string[] = [];

const cellKey = (cell: CellCoord) => `${cell.row},${cell.col}`;

const computeDirection = (
  start: CellCoord,
  end: CellCoord
): Direction | null => {
  const deltaRow = end.row - start.row;
  const deltaCol = end.col - start.col;

  if (deltaRow === 0 && deltaCol === 0) {
    return null;
  }

  const isStraight = deltaRow === 0 || deltaCol === 0;
  const isDiagonal = Math.abs(deltaRow) === Math.abs(deltaCol);

  if (!isStraight && !isDiagonal) {
    return null;
  }

  const dy = deltaRow === 0 ? 0 : deltaRow / Math.abs(deltaRow);
  const dx = deltaCol === 0 ? 0 : deltaCol / Math.abs(deltaCol);

  return {
    dx,
    dy,
    name: "selection",
    diagonal: isDiagonal,
  };
};

const buildPathKey = (cells: CellCoord[]) =>
  cells.map((cell) => cellKey(cell)).join("|");

export function WordSearchGame({
  words = DEFAULT_WORDS,
  size = 10,
  allowDiagonals = true,
  allowBackwards = true,
  seed,
  onComplete,
  onRestart,
  onNewPuzzleRequest,
}: WordSearchGameProps) {
  const [internalSeed, setInternalSeed] = useState(() => seed ?? Date.now());
  const [dragStart, setDragStart] = useState<CellCoord | null>(null);
  const [dragPath, setDragPath] = useState<CellCoord[]>([]);
  const [startTimestamp, setStartTimestamp] = useState(() => Date.now());
  const [foundPlacements, setFoundPlacements] = useState<
    Record<string, WordPlacement>
  >({});
  const [hasCompleted, setHasCompleted] = useState(false);

  const pointerActiveRef = useRef(false);
  const dragPathRef = useRef<CellCoord[]>([]);

  const isSeedControlled = typeof seed === "number";

  useEffect(() => {
    if (isSeedControlled && seed !== internalSeed && typeof seed === "number") {
      setInternalSeed(seed);
    }
  }, [isSeedControlled, seed, internalSeed]);

  useEffect(() => {
    dragPathRef.current = dragPath;
  }, [dragPath]);

  const normalizedEntries = useMemo(() => {
    const seen = new Set<string>();
    const entries: NormalizedWord[] = [];

    words.forEach((rawWord) => {
      const trimmed = rawWord.trim();
      const normalized = normalizeWord(trimmed);
      if (!normalized || seen.has(normalized)) {
        return;
      }
      seen.add(normalized);
      entries.push({
        normalized,
        label: trimmed || normalized,
      });
    });

    return entries;
  }, [words]);

  const playableWords = useMemo(
    () => normalizedEntries.map((entry) => entry.normalized),
    [normalizedEntries]
  );

  const playableWordsKey = playableWords.join("|");

  const puzzle = useMemo(() => {
    if (playableWords.length === 0) {
      return null;
    }

    return generateGrid(
      playableWords,
      size,
      allowDiagonals,
      allowBackwards,
      internalSeed
    );
  }, [playableWords, size, allowDiagonals, allowBackwards, internalSeed]);

  const puzzleKey = [
    internalSeed,
    playableWordsKey,
    size,
    allowDiagonals ? "1" : "0",
    allowBackwards ? "1" : "0",
  ].join(":");

  useEffect(() => {
    setFoundPlacements({});
    setHasCompleted(false);
    setDragStart(null);
    setDragPath([]);
    setStartTimestamp(Date.now());
  }, [puzzleKey]);

  const placementLookup = useMemo(() => {
    const map = new Map<string, WordPlacement>();
    (puzzle?.placements ?? []).forEach((placement) => {
      const key = buildPathKey(placement.cells);
      map.set(key, placement);
      const reversedKey = buildPathKey([...placement.cells].reverse());
      map.set(reversedKey, placement);
    });
    return map;
  }, [puzzle]);

  const foundWordCount = Object.keys(foundPlacements).length;
  const totalPlaceable = puzzle?.placements.length ?? 0;
  const totalRequested = playableWords.length;

  useEffect(() => {
    if (
      !hasCompleted &&
      totalPlaceable > 0 &&
      foundWordCount === totalPlaceable
    ) {
      setHasCompleted(true);
      onComplete?.({
        foundWords: Object.keys(foundPlacements),
        totalPlaced: totalPlaceable,
        totalRequested,
        secondsElapsed: Math.max(
          1,
          Math.floor((Date.now() - startTimestamp) / 1000)
        ),
        seed: internalSeed,
        unplaced: puzzle?.unplaced ?? [],
      });
    }
  }, [
    foundPlacements,
    foundWordCount,
    hasCompleted,
    totalPlaceable,
    totalRequested,
    onComplete,
    startTimestamp,
    internalSeed,
    puzzle?.unplaced,
  ]);

  const foundCells = useMemo(() => {
    const set = new Set<string>();
    Object.values(foundPlacements).forEach((placement) => {
      placement.cells.forEach((cell) => {
        set.add(cellKey(cell));
      });
    });
    return set;
  }, [foundPlacements]);

  const dragSet = useMemo(
    () => new Set(dragPath.map((cell) => cellKey(cell))),
    [dragPath]
  );

  const handlePointerDown = useCallback((cell: CellCoord) => {
    pointerActiveRef.current = true;
    setDragStart(cell);
    setDragPath([cell]);
  }, []);

  const handlePointerEnter = useCallback(
    (next: CellCoord) => {
      if (!pointerActiveRef.current || !dragStart) {
        return;
      }

      const direction = computeDirection(dragStart, next);
      if (!direction) {
        return;
      }

      const length =
        Math.max(
          Math.abs(next.row - dragStart.row),
          Math.abs(next.col - dragStart.col)
        ) + 1;
      const cells = getLineCells(
        dragStart.row,
        dragStart.col,
        length,
        direction
      );
      setDragPath(cells);
    },
    [dragStart]
  );

  const finalizeSelection = useCallback(
    (path: CellCoord[]) => {
      pointerActiveRef.current = false;

      if (!path || path.length < 2) {
        setDragStart(null);
        setDragPath([]);
        return;
      }

      const key = buildPathKey(path);
      const placement = placementLookup.get(key);

      if (placement) {
        setFoundPlacements((prev) => {
          if (prev[placement.word]) {
            return prev;
          }
          return {
            ...prev,
            [placement.word]: placement,
          };
        });
      }

      setDragStart(null);
      setDragPath([]);
    },
    [placementLookup]
  );

  useEffect(() => {
    const handlePointerEnd = () => {
      if (pointerActiveRef.current) {
        finalizeSelection(dragPathRef.current);
      }
    };

    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
    return () => {
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [finalizeSelection]);

  const handleRestart = useCallback(() => {
    setFoundPlacements({});
    setDragStart(null);
    setDragPath([]);
    setHasCompleted(false);
    setStartTimestamp(Date.now());
    onRestart?.();
  }, [onRestart]);

  const handleNewPuzzle = useCallback(() => {
    onNewPuzzleRequest?.();
    if (!isSeedControlled) {
      setInternalSeed(Date.now());
    }
  }, [isSeedControlled, onNewPuzzleRequest]);

  if (playableWords.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-lg font-semibold">
          Add at least one valid spelling word to play.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Puzzle: {internalSeed}
        </div>
        <div className="ml-auto flex flex-wrap gap-3">
          <Button variant="secondary" size="child" onClick={handleRestart}>
            Restart
          </Button>
          <Button size="child" onClick={handleNewPuzzle}>
            New Puzzle
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <Card
          variant="child"
          className="p-4 flex flex-col gap-4"
          aria-live="polite"
        >
          <div className="flex flex-col gap-2">
            <p className="text-2xl font-bold text-child-foreground">
              Find the hidden words
            </p>
            <p className="text-base text-child-foreground/80">
              Drag across the letters to highlight each spelling word. You can
              drag in either direction.
            </p>
          </div>

          <div
            role="grid"
            aria-label="Word search grid"
            className="grid gap-0.5 sm:gap-1 touch-none select-none mx-auto max-w-full"
            style={{
              gridTemplateColumns: `repeat(${Math.max(
                puzzle?.grid.length ?? 0,
                1
              )}, minmax(0, 1fr))`,
              maxWidth: "min(100%, 600px)",
            }}
          >
            {puzzle?.grid.map((row, rowIndex) =>
              row.map((letter, colIndex) => {
                const key = `${rowIndex}-${colIndex}`;
                const coord: CellCoord = { row: rowIndex, col: colIndex };
                const isFound = foundCells.has(cellKey(coord));
                const isDragging = dragSet.has(cellKey(coord));
                return (
                  <button
                    key={key}
                    type="button"
                    role="gridcell"
                    aria-label={`Row ${rowIndex + 1} column ${
                      colIndex + 1
                    }, letter ${letter}`}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      handlePointerDown(coord);
                    }}
                    onPointerEnter={(event) => {
                      event.preventDefault();
                      handlePointerEnter(coord);
                    }}
                    className={cn(
                      "aspect-square rounded border-2 border-border font-bold uppercase transition-colors",
                      "flex items-center justify-center child-card focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      "text-lg leading-none",
                      isFound && "bg-primary text-primary-foreground",
                      !isFound &&
                        isDragging &&
                        "bg-secondary text-secondary-foreground",
                      !isFound &&
                        !isDragging &&
                        "bg-background text-foreground/80"
                    )}
                  >
                    {letter}
                  </button>
                );
              })
            )}
          </div>
        </Card>

        <Card
          variant="child"
          className="p-4 space-y-4 flex flex-col"
        >
          <div className="flex items-center justify-between flex-shrink-0">
            <h3 className="text-xl font-semibold">Word List</h3>
            <span className="text-sm text-muted-foreground">
              {foundWordCount}/{totalPlaceable}
            </span>
          </div>
          <ul className="space-y-2 overflow-y-auto flex-1 max-h-[600px]">
            {normalizedEntries.map((entry) => {
              const isPlaced = Boolean(
                (puzzle?.placements ?? []).find(
                  (placement) => placement.word === entry.normalized
                )
              );
              const isFound = Boolean(foundPlacements[entry.normalized]);
              return (
                <li
                  key={entry.normalized}
                  className={cn(
                    "rounded-md px-3 py-2 text-lg font-semibold",
                    isFound
                      ? "bg-primary/20 line-through text-primary"
                      : "bg-background/40"
                  )}
                >
                  {entry.label}
                  {!isPlaced && (
                    <span className="ml-2 text-xs uppercase text-muted-foreground">
                      (not placed)
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {Boolean(puzzle?.unplaced?.length) && (
            <p className="text-sm text-muted-foreground">
              Could not place: {puzzle?.unplaced.join(", ")}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
