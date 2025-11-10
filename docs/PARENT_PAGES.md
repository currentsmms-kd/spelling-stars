# Parent Pages Implementation

This document describes the implementation of the parent-facing word list management pages.

## Pages

### 1. `/parent/lists` - Lists Overview

**Features:**

- Table view with sortable columns (title, week_start_date, word_count, created_at)
- Search functionality to filter lists by title
- Action buttons: Edit, Duplicate, Delete
- Click column headers to sort (ascending/descending)
- Delete confirmation to prevent accidental deletions

**Components Used:**

- `AppShell` for consistent layout
- `Card` for container styling
- `Button` for actions
- Custom table with hover states

### 2. `/parent/lists/new` & `/parent/lists/:id` - List Editor

**Layout:** Three-panel responsive layout

#### Left Panel: List Metadata

- Title (required)
- Week start date (optional)
- Save button with unsaved changes indicator
- Bulk import textarea
  - Paste newline-separated words
  - Automatic deduplication against existing words
  - Shows count of words added

#### Middle Panel: Words Table

- Drag-and-drop reordering (HTML5 native)
- Columns:
  - Grip handle for dragging
  - Order number
  - Word text (editable inline)
  - Phonetic spelling (optional, editable inline)
  - Play button (if audio exists)
  - Delete button
- Add word button (+ keyboard shortcut: Enter key)
- Click row to select for audio recording
- Selected row highlighted

#### Right Panel: Audio Recorder

- Shows selected word details
- `AudioRecorder` component integration
- Waveform visualization
- Upload to Supabase Storage at `lists/{listId}/words/{wordId}.webm`
- Updates `words.prompt_audio_url` with public URL
- Shows current audio status and play button

## Data Layer

### React Query Hooks (in `src/app/api/supa.ts`)

**List Management:**

- `useWordLists(userId)` - Fetch all lists with word counts
- `useWordList(listId)` - Fetch single list with all words
- `useCreateWordList()` - Create new list
- `useUpdateWordList()` - Update list metadata
- `useDeleteWordList()` - Delete list and all associations
- `useDuplicateWordList()` - Clone existing list with all words

**Word Management:**

- `useCreateWord()` - Create new word
- `useUpdateWord()` - Update word (text, phonetic, etc.)
- `useAddWordToList()` - Add word to list
- `useDeleteWordFromList()` - Remove word from list
- `useReorderWords()` - Update sort indices with optimistic updates

**Audio Management:**

- `useUploadAudio()` - Upload audio to Supabase Storage and update word

### Optimistic Updates

The `useReorderWords` hook implements optimistic updates:

1. Immediately updates local state
2. Shows new order to user
3. Sends update to server in background
4. Rolls back on error

## Storage Configuration

### Bucket: `word-audio`

**Location:** Supabase Storage
**Access:** Private bucket with signed URLs (1 hour TTL)
**Path Structure:** `lists/{listId}/words/{wordId}.webm`
**Migration:** `20241109000001_add_word_audio_bucket.sql` (initial), `20251109170000_secure_prompt_audio_private.sql` (security update)

**Policies:**

- Parents can upload, update, and delete audio
- All authenticated users can read (requires signed URLs for access)
- Signed URLs generated via `getSignedPromptAudioUrl()` in `supa.ts`

## UX Features

### Form Validation

- Zod schemas for type-safe validation
- React Hook Form integration
- Inline error messages
- Required fields marked with asterisk

### Unsaved Changes Protection

- Tracks form and word list changes
- Browser `beforeunload` warning
- Visual indicator when changes pending

### Keyboard Shortcuts

- **Enter** in word input: Add new word
- Native drag-and-drop: Reorder words

### Toast Notifications

- Success: Green toast with checkmark
- Error: Red toast with error icon
- Auto-dismiss after 3 seconds
- Positioned top-right

### Loading States

- Skeleton/loading text during data fetch
- Disabled buttons during mutations
- Upload progress indicators

## Database Schema

### Tables Used

**word_lists:**

- `id` (uuid, PK)
- `title` (text)
- `week_start_date` (date, nullable)
- `created_by` (uuid, FK to profiles)
- `created_at` (timestamp)

**words:**

- `id` (uuid, PK)
- `text` (text)
- `phonetic` (text, nullable)
- `prompt_audio_url` (text, nullable)
- `tts_voice` (text, nullable)
- `created_at` (timestamp)

**list_words:** (junction table)

- `list_id` (uuid, FK)
- `word_id` (uuid, FK)
- `sort_index` (integer)
- Composite PK: (list_id, word_id)

## Implementation Notes

### Drag-and-Drop

Uses HTML5 native drag API:

- `draggable` attribute on word rows
- `onDragStart`, `onDragOver`, `onDrop`, `onDragEnd` handlers
- Visual feedback with border styling during drag
- Immediate local update, then persisted to database

### Audio Recording

Leverages existing `AudioRecorder` component:

- Records in WebM format
- Displays waveform with WaveSurfer.js
- Uploads to Supabase Storage
- Returns public URL for persistence

### Bulk Import

- Text area for pasting multiple words
- Splits by newline
- Trims whitespace
- Deduplicates case-insensitively against existing words
- Shows count of newly added words

## Error Handling

All mutations include try-catch blocks with:

- Console logging for debugging
- Toast notifications for user feedback
- Graceful degradation (partial success where possible)

## Accessibility

- Semantic HTML elements
- Proper button labeling (title attributes)
- Keyboard navigation support
- Focus management in forms
- ARIA labels on interactive elements

## Future Enhancements

Potential improvements:

- Batch word operations (multi-select)
- Import from CSV/Excel
- Export functionality
- Word statistics/analytics
- Audio waveform editing
- Shared lists between parents
- List templates
