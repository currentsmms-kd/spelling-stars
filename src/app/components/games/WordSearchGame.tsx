import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";
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
  onSettingsClick?: () => void;
  listTitle?: string;
  usingDemoList?: boolean;
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
  onSettingsClick,
  listTitle = "",
  usingDemoList = false,
}: WordSearchGameProps) {
  const [internalSeed, setInternalSeed] = useState(() => seed ?? Date.now());
  const [dragStart, setDragStart] = useState<CellCoord | null>(null);
  const [dragPath, setDragPath] = useState<CellCoord[]>([]);
  const [startTimestamp, setStartTimestamp] = useState(() => Date.now());
  const [foundPlacements, setFoundPlacements] = useState<
    Record<string, WordPlacement>
  >({});
  const [hasCompleted, setHasCompleted] = useState(false);
  const [cellSize, setCellSize] = useState(48);

  const pointerActiveRef = useRef(false);
  const dragPathRef = useRef<CellCoord[]>([]);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

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

  const gridDimension = puzzle?.grid.length ?? size;

  useEffect(() => {
    if (!gridDimension) {
      return;
    }

    const updateCellSize = () => {
      const container = gridContainerRef.current;
      if (!container) {
        return;
      }

      const containerWidth = container.clientWidth - 16; // account for padding
      const { top } = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const availableHeight = viewportHeight - top - 40; // leave more breathing room to avoid scrolling
      const limitingAxis = Math.max(
        0,
        Math.min(containerWidth, availableHeight)
      );
      if (!limitingAxis) {
        return;
      }
      const proposed = Math.floor(limitingAxis / gridDimension);
      const nextSize = Math.max(28, Math.min(proposed, 56)); // slightly smaller max to ensure visibility
      setCellSize((prev) => (Number.isFinite(nextSize) ? nextSize : prev));
    };

    updateCellSize();

    const container = gridContainerRef.current;
    const supportsResizeObserver = typeof ResizeObserver !== "undefined";
    let resizeObserver: ResizeObserver | null = null;

    if (supportsResizeObserver) {
      resizeObserver = new ResizeObserver(updateCellSize);
      if (container) {
        resizeObserver.observe(container);
      }
    }

    window.addEventListener("resize", updateCellSize);
    return () => {
      if (container && resizeObserver) {
        resizeObserver.unobserve(container);
      }
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateCellSize);
    };
  }, [gridDimension]);

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

  const gridStyles: CSSProperties | undefined = gridDimension
    ? {
        gridTemplateColumns: `repeat(${gridDimension}, ${cellSize}px)`,
        gridAutoRows: `${cellSize}px`,
        maxWidth: gridDimension * cellSize,
      }
    : undefined;

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
    <Card
      variant="child"
      className="p-3 flex flex-col gap-3 h-[calc(100vh-8rem)]"
      aria-live="polite"
    >
      {/* Header with actions */}
      <div className="flex flex-wrap items-center gap-2 justify-between flex-shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSettingsClick}
            className="flex items-center gap-1.5"
            title="Puzzle settings"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="hidden sm:inline">Settings</span>
          </Button>
          <p className="text-sm text-child-foreground/80">
            Find the hidden words • Drag across letters to highlight
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={handleRestart}>
            Restart
          </Button>
          <Button size="sm" onClick={handleNewPuzzle}>
            New Puzzle
          </Button>
        </div>
      </div>

      {/* Main content area with grid and word list */}
      <div className="flex-1 min-h-0 flex gap-3">
        {/* Grid Area */}
        <div
          ref={gridContainerRef}
          className="flex-1 min-w-0 min-h-0 flex items-center justify-center"
        >
          <div
            role="grid"
            aria-label="Word search grid"
            className="grid gap-1.5 sm:gap-2 touch-none select-none bg-child-surface/40 p-2 rounded-xl"
            style={gridStyles}
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
                      "rounded-lg border-2 border-border font-bold uppercase transition-colors shadow-sm",
                      "flex items-center justify-center child-card focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      "text-base sm:text-lg leading-none",
                      isFound && "bg-primary text-primary-foreground",
                      !isFound &&
                        isDragging &&
                        "bg-secondary text-secondary-foreground",
                      !isFound &&
                        !isDragging &&
                        "bg-background text-foreground/80"
                    )}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      fontSize: Math.max(16, Math.min(cellSize * 0.5, 28)),
                    }}
                  >
                    {letter}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Word List Sidebar - inside main card */}
        <div className="w-48 xl:w-56 flex-shrink-0 flex flex-col min-h-0 bg-child-surface/20 rounded-lg p-2">
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <h3 className="text-sm font-bold">Words</h3>
            <span className="text-xs font-semibold text-muted-foreground">
              {foundWordCount}/{totalPlaceable}
            </span>
          </div>
          <ul className="space-y-0.5 overflow-y-auto flex-1 min-h-0 pr-1">
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
                    "rounded px-2 py-1 text-xs font-semibold transition-colors",
                    isFound
                      ? "bg-primary/20 line-through text-primary"
                      : "bg-background/40 hover:bg-background/60"
                  )}
                >
                  {entry.label}
                  {!isPlaced && (
                    <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                      (skip)
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {Boolean(puzzle?.unplaced?.length) && (
            <p className="text-[10px] text-muted-foreground mt-1.5 pt-1.5 border-t border-border flex-shrink-0">
              Skipped: {puzzle?.unplaced.join(", ")}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
