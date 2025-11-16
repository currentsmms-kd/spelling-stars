# SpellStars Database Schema

> **Schema Version:** November 2025 (Production)
> **Last Updated:** November 15, 2025

This document describes the Supabase database schema for SpellStars. For migration history, see `supabase/migrations/` directory.

## Tables

### profiles

Stores user profile information.

| Column       | Type      | Description                        |
| ------------ | --------- | ---------------------------------- |
| id           | uuid      | Primary key, references auth.users |
| role         | text      | 'parent' or 'child'                |
| display_name | text      | User display name (optional)       |
| avatar_url   | text      | URL to user avatar (optional)      |
| created_at   | timestamp | When profile was created           |
| updated_at   | timestamp | When profile was last updated      |

**Note:** The `email` column was removed in favor of using `auth.users.email` directly.

### word_lists

Stores spelling word lists created by parents (renamed from `spelling_lists`).

| Column          | Type      | Description                |
| --------------- | --------- | -------------------------- |
| id              | uuid      | Primary key                |
| created_by      | uuid      | Foreign key to profiles    |
| title           | text      | List title                 |
| week_start_date | date      | Optional week start date   |
| created_at      | timestamp | When list was created      |
| updated_at      | timestamp | When list was last updated |

**Changes from original schema:**

- Renamed from `spelling_lists` to `word_lists`
- Renamed `parent_id` to `created_by`
- Removed `description` field
- Added `week_start_date` field

### words

Stores individual vocabulary words (no longer directly linked to lists).

| Column           | Type      | Description                                    |
| ---------------- | --------- | ---------------------------------------------- |
| id               | uuid      | Primary key                                    |
| text             | text      | The spelling word                              |
| prompt_audio_url | text      | Storage path to audio pronunciation (optional) |
| phonetic         | text      | Phonetic spelling (optional)                   |
| tts_voice        | text      | Text-to-speech voice preference (optional)     |
| created_at       | timestamp | When word was added                            |

**Changes from original schema:**

- Removed `list_id` column (now uses `list_words` junction table)
- Renamed `word` to `text`
- Renamed `audio_url` to `prompt_audio_url`
- Removed `order` field (now in `list_words.sort_index`)
- Added `phonetic` and `tts_voice` fields

**Important:** The same word can now appear in multiple lists, avoiding duplication.

### list_words

Junction table enabling many-to-many relationship between lists and words.

| Column     | Type    | Description                     |
| ---------- | ------- | ------------------------------- |
| list_id    | uuid    | Foreign key to word_lists       |
| word_id    | uuid    | Foreign key to words            |
| sort_index | integer | Display order within the list   |
|            |         | Primary key: (list_id, word_id) |

**Purpose:** Allows the same word to exist in multiple lists without duplication.

### attempts

Stores child spelling attempts.

| Column       | Type      | Description                                                     |
| ------------ | --------- | --------------------------------------------------------------- |
| id           | uuid      | Primary key                                                     |
| child_id     | uuid      | Foreign key to profiles                                         |
| word_id      | uuid      | Foreign key to words                                            |
| list_id      | uuid      | Foreign key to word_lists (for list-scoped analytics)           |
| mode         | text      | Game mode: 'listen-type', 'say-spell', or 'flash'               |
| correct      | boolean   | Whether attempt was correct                                     |
| quality      | integer   | Quality score (0-5) based on correctness, first-try, hints used |
| typed_answer | text      | What child typed (for Listen & Type)                            |
| audio_url    | text      | Audio recording path in storage (for Say & Spell)               |
| duration_ms  | integer   | Duration of attempt in milliseconds                             |
| started_at   | timestamp | When attempt was started                                        |

**Note:** The `audio_url` field stores the storage path, not a full URL. Signed URLs are generated on-demand for playback using `getSignedAudioUrl()` from `supa.ts`. The `list_id` field is required for list-scoped analytics and tracking which list a word was practiced from.

### srs

Stores spaced repetition system (SRS) data for tracking word difficulty and review scheduling.

| Column        | Type      | Description                                     |
| ------------- | --------- | ----------------------------------------------- |
| id            | uuid      | Primary key                                     |
| child_id      | uuid      | Foreign key to profiles                         |
| word_id       | uuid      | Foreign key to words                            |
| ease          | real      | Ease factor (≥1.3), higher = easier             |
| interval_days | integer   | Days until next review (0 = due now)            |
| due_date      | date      | Date when word should be reviewed next          |
| reps          | integer   | Number of successful repetitions                |
| lapses        | integer   | Number of times word was missed (not first-try) |
| created_at    | timestamp | When SRS entry was created                      |
| updated_at    | timestamp | When SRS entry was last updated                 |

**Algorithm**: Uses SM-2-lite algorithm:

- On first-try correct: ease increases by 0.1, interval = (interval == 0) ? 1 : round(interval \* ease), due_date = now() + interval, reps += 1
- On miss (not first try): ease decreases by 0.2 (min 1.3), interval = 0, due_date = now(), lapses += 1

## Storage Buckets

### audio-recordings

Stores audio files uploaded by children during "Say & Spell" mode.

- Public access: No
- File size limit: 10MB
- Allowed MIME types: audio/webm, audio/mp4, audio/wav

## Indexes

Performance indexes are created on frequently queried columns:

- `idx_word_lists_created_by` - Lookup lists by creator
- `idx_list_words_list_sort` - Ordered words within a list
- `idx_attempts_child_word_started` - Child's attempt history for a word
- `idx_attempts_list_id` - Analytics queries for specific lists
- `idx_srs_child_due` - Find due words for a child
- `idx_srs_child_word` - Lookup SRS status for a specific word

## Row Level Security (RLS)

All tables have RLS enabled with appropriate policies:

### Profiles

- **Parents** can read all profiles (to view child accounts)
- **Children** can read only their own profile
- **All users** can update their own profile

### Word Lists

- **All authenticated users** can read word lists
- **Parents only** can insert, update, and delete word lists

### Words & List Words

- **All authenticated users** can read words and list-word associations
- **Parents only** can insert, update, and delete words and list-word associations

### Attempts

- **Children** can insert and read their own attempts
- **Parents** can read attempts for words in their own lists (via `list_id` foreign key)

### SRS

- **Children** can fully manage (insert, update, delete, read) their own SRS entries
- **Parents** can read all SRS entries (for reporting/analytics)

## Triggers

### on_auth_user_created

Automatically creates a profile entry when a new user signs up, using:

- `id` from `auth.users.id`
- `role` from user metadata (defaults to 'parent')
- `display_name` from user metadata (defaults to email username)

### update_updated_at_column

Updates the `updated_at` timestamp on profiles, word_lists, and srs tables before each UPDATE operation.
