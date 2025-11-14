# Games Components

## `<WordSearchGame />`

- Props:
  - `words: string[]` – raw spelling words (duplicates/invalid entries are ignored).
  - `size?: number` – grid size (defaults to 10, clamped between 4 and 26).
  - `allowDiagonals?: boolean` – enables diagonal placements (defaults to `true`).
  - `allowBackwards?: boolean` – allows reverse placements (defaults to `true`).
  - `seed?: number` – optional seed for deterministic puzzles (controlled mode).
  - `onComplete?(summary)` – called after all placed words are found.
  - `onRestart?()` – triggered when the Restart button is used.
  - `onNewPuzzleRequest?()` – triggered before generating a new puzzle (parent can update the `seed` prop; in uncontrolled mode the component picks a timestamp seed automatically).

The component exposes restart/new puzzle controls, handles mouse/touch drag selection, and announces completion through `onComplete`. When `seed` is provided you should update it in response to `onNewPuzzleRequest` to keep the puzzle in sync.
