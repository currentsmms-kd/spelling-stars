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
  // listTitle = "",
  // usingDemoList = false,
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
  const [recentlyFoundWord, setRecentlyFoundWord] = useState<string | null>(
    null
  );

  const pointerActiveRef = useRef(false);
  const dragPathRef = useRef<CellCoord[]>([]);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const voicesLoadedRef = useRef(false);

  const isSeedControlled = typeof seed === "number";

  // Load and cache the voice once
  useEffect(() => {
    const loadVoice = () => {
      if (voicesLoadedRef.current) return;

      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return; // Voices not loaded yet

      // Look for Microsoft Ava Online (Natural) first, then any Ava variant
      const preferredVoice =
        voices.find(
          (voice) => voice.name === "Microsoft Ava Online (Natural)"
        ) ||
        voices.find((voice) => voice.name.includes("Ava")) ||
        voices.find(
          (voice) =>
            voice.lang.startsWith("en-US") && voice.name.includes("Google")
        ) ||
        voices.find((voice) => voice.lang.startsWith("en-US"));

      if (preferredVoice) {
        selectedVoiceRef.current = preferredVoice;
        voicesLoadedRef.current = true;
        console.log(
          "Voice locked to:",
          preferredVoice.name,
          preferredVoice.lang
        );
      }
    };

    // Try to load immediately
    loadVoice();

    // Also listen for voiceschanged event
    if ("speechSynthesis" in window) {
      window.speechSynthesis.addEventListener("voiceschanged", loadVoice);
      return () => {
        window.speechSynthesis.removeEventListener("voiceschanged", loadVoice);
      };
    }
  }, []);

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

      const containerWidth = container.clientWidth - 24; // account for padding and margins
      const { top } = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const availableHeight = viewportHeight - top - 48; // more breathing room
      const limitingAxis = Math.max(
        0,
        Math.min(containerWidth, availableHeight)
      );
      if (!limitingAxis) {
        return;
      }
      const proposed = Math.floor(limitingAxis / gridDimension);
      const nextSize = Math.max(28, Math.min(proposed, 52)); // slightly smaller for better fit
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

          // Trigger animation
          setRecentlyFoundWord(placement.word);
          setTimeout(() => setRecentlyFoundWord(null), 600);

          // Speak the word aloud using the cached voice for consistency
          if ("speechSynthesis" in window && selectedVoiceRef.current) {
            const utterance = new SpeechSynthesisUtterance(placement.word);
            utterance.rate = 1.0;
            utterance.pitch = 1.3;
            utterance.volume = 1.0;
            utterance.voice = selectedVoiceRef.current;
            utterance.lang = "en-US";

            window.speechSynthesis.speak(utterance);
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
      className="p-4 flex gap-4 h-[calc(100vh-8rem)]"
      aria-live="polite"
    >
      {/* Left Sidebar - Instructions & Word List */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-4">
        {/* Instructions */}
        <div className="bg-child-surface/30 rounded-lg p-4">
          <h3 className="text-lg font-bold text-child-foreground mb-2">
            How to Play
          </h3>
          <p className="text-base text-child-foreground/90 leading-relaxed">
            Find the hidden words by dragging across the letters to highlight
            each spelling word.
          </p>
        </div>

        {/* Word List */}
        <div className="flex-1 min-h-0 bg-child-surface/30 rounded-lg p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-child-foreground">Words</h3>
            <span className="text-sm font-semibold text-muted-foreground bg-background/50 px-2 py-0.5 rounded-full">
              {foundWordCount}/{totalPlaceable}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 space-y-2">
            {normalizedEntries.map((entry) => {
              const isPlaced = Boolean(
                (puzzle?.placements ?? []).find(
                  (placement) => placement.word === entry.normalized
                )
              );
              const isFound = Boolean(foundPlacements[entry.normalized]);
              const isAnimating = recentlyFoundWord === entry.normalized;
              return (
                <button
                  key={entry.normalized}
                  disabled
                  className={cn(
                    "w-full px-3 py-2 rounded-full text-sm font-semibold transition-all duration-300",
                    "border-2 text-left",
                    isAnimating && "animate-word-burst",
                    isFound
                      ? "bg-primary border-primary text-primary-foreground scale-95 opacity-70"
                      : "bg-background/60 border-border hover:bg-background/80 hover:border-primary/50"
                  )}
                >
                  {isFound && (
                    <span className="inline-block mr-1.5 animate-bounce">
                      ✓
                    </span>
                  )}
                  {entry.label}
                  {!isPlaced && (
                    <span className="ml-1.5 text-xs opacity-60">(skip)</span>
                  )}
                </button>
              );
            })}
          </div>
          {Boolean(puzzle?.unplaced?.length) && (
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
              Skipped: {puzzle?.unplaced.join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* Center - Game Grid */}
      <div
        ref={gridContainerRef}
        className="flex-1 min-w-0 min-h-0 flex items-center justify-center"
      >
        <div
          role="grid"
          aria-label="Word search grid"
          className="grid gap-1.5 sm:gap-2 touch-none select-none bg-child-surface/20 p-3 rounded-2xl"
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

      {/* Right Sidebar - Action Buttons */}
      <div className="w-32 flex-shrink-0 flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSettingsClick}
          className="flex flex-col items-center gap-2 h-auto py-4 px-3"
          title="Puzzle settings"
        >
          <svg
            className="w-8 h-8"
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
          <span className="text-xs font-semibold">Settings</span>
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleRestart}
          className="flex flex-col items-center gap-2 h-auto py-4 px-3"
        >
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span className="text-xs font-semibold">Restart</span>
        </Button>

        <Button
          size="sm"
          onClick={handleNewPuzzle}
          className="flex flex-col items-center gap-2 h-auto py-4 px-3"
        >
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span className="text-xs font-semibold">New Puzzle</span>
        </Button>
      </div>
    </Card>
  );
}
