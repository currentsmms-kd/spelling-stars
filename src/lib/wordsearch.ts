export interface CellCoord {
  row: number;
  col: number;
}

export interface Direction {
  dx: number;
  dy: number;
  name: string;
  diagonal: boolean;
}

export interface WordPlacement {
  word: string;
  cells: CellCoord[];
}

export interface GeneratedPuzzle {
  grid: string[][];
  placements: WordPlacement[];
  unplaced: string[];
  size: number;
  seed: number;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Normalizes a single word for placement inside the puzzle.
 * Strips punctuation, whitespace, and converts to uppercase.
 */
export function normalizeWord(word: string): string {
  if (!word) return "";
  return word
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
}

/**
 * Normalizes an array of spelling words for use inside a word search.
 */
export function normalizeWords(words: string[]): string[] {
  return words
    .map((word) => normalizeWord(word))
    .filter((word): word is string => word.length > 0);
}

/**
 * Deterministic pseudo-random generator used to make grids reproducible.
 */
export function mulberry32(seed: number): () => number {
  let t = seed;
  return function random() {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const ALL_DIRECTIONS: Direction[] = [
  { name: "E", dx: 1, dy: 0, diagonal: false },
  { name: "S", dx: 0, dy: 1, diagonal: false },
  { name: "W", dx: -1, dy: 0, diagonal: false },
  { name: "N", dx: 0, dy: -1, diagonal: false },
  { name: "SE", dx: 1, dy: 1, diagonal: true },
  { name: "SW", dx: -1, dy: 1, diagonal: true },
  { name: "NE", dx: 1, dy: -1, diagonal: true },
  { name: "NW", dx: -1, dy: -1, diagonal: true },
];

/**
 * Builds the direction list based on parental settings.
 */
export function buildDirections(
  allowDiagonals: boolean,
  allowBackwards: boolean
): Direction[] {
  return ALL_DIRECTIONS.filter((direction) => {
    if (!allowDiagonals && direction.diagonal) {
      return false;
    }

    const isBackwards = direction.dx < 0 || direction.dy < 0;
    if (!allowBackwards && isBackwards) {
      return false;
    }

    return true;
  });
}

/**
 * Returns the coordinates for a straight line (row/column increments).
 */
export function getLineCells(
  startRow: number,
  startCol: number,
  length: number,
  direction: Direction
): CellCoord[] {
  const cells: CellCoord[] = [];
  for (let i = 0; i < length; i += 1) {
    cells.push({
      row: startRow + direction.dy * i,
      col: startCol + direction.dx * i,
    });
  }
  return cells;
}

/**
 * Ensures that a word fits completely on the board for the given start + direction.
 */
export function fits(
  word: string,
  startRow: number,
  startCol: number,
  direction: Direction,
  size: number
): boolean {
  const endRow = startRow + direction.dy * (word.length - 1);
  const endCol = startCol + direction.dx * (word.length - 1);
  return (
    startRow >= 0 &&
    startCol >= 0 &&
    endRow >= 0 &&
    endCol >= 0 &&
    startRow < size &&
    startCol < size &&
    endRow < size &&
    endCol < size
  );
}

/**
 * Generates a populated word search grid.
 *
 * TODO: Add unit tests for fits(), getLineCells(), and generateGrid() flows once
 * the repo includes a configured test runner (Vitest/Jest).
 */
export function generateGrid(
  words: string[],
  size: number,
  allowDiagonals: boolean,
  allowBackwards: boolean,
  seed: number
): GeneratedPuzzle {
  const clampedSize = Math.max(4, Math.min(26, size));
  const rng = mulberry32(seed);
  const board: string[][] = Array.from({ length: clampedSize }, () =>
    Array.from({ length: clampedSize }, () => "")
  );
  const placements: WordPlacement[] = [];
  const unplaced: string[] = [];
  const directions = buildDirections(allowDiagonals, allowBackwards);

  const candidates = words
    .slice()
    .sort((a, b) => b.length - a.length)
    .filter(Boolean);

  for (const word of candidates) {
    let placed = false;
    const maxAttempts = clampedSize * clampedSize * directions.length;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const direction =
        directions[Math.floor(rng() * directions.length)] ?? directions[0];
      const startRow = Math.floor(rng() * clampedSize);
      const startCol = Math.floor(rng() * clampedSize);

      if (!fits(word, startRow, startCol, direction, clampedSize)) {
        continue;
      }

      const cells = getLineCells(startRow, startCol, word.length, direction);
      const collision = cells.some(({ row, col }, idx) => {
        const cellValue = board[row][col];
        return cellValue !== "" && cellValue !== word[idx];
      });

      if (collision) {
        continue;
      }

      cells.forEach(({ row, col }, idx) => {
        board[row][col] = word[idx];
      });

      placements.push({ word, cells });
      placed = true;
      break;
    }

    if (!placed) {
      unplaced.push(word);
    }
  }

  for (let row = 0; row < clampedSize; row += 1) {
    for (let col = 0; col < clampedSize; col += 1) {
      if (!board[row][col]) {
        board[row][col] = LETTERS[Math.floor(rng() * LETTERS.length)];
      }
    }
  }

  return {
    grid: board,
    placements,
    unplaced,
    size: clampedSize,
    seed,
  };
}
