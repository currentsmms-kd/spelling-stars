# SpellStars Database Schema

This document describes the Supabase database schema for SpellStars.

## Tables

### profiles

Stores user profile information.

| Column     | Type      | Description                        |
| ---------- | --------- | ---------------------------------- |
| id         | uuid      | Primary key, references auth.users |
| email      | text      | User email (unique)                |
| role       | text      | 'parent' or 'child'                |
| created_at | timestamp | When profile was created           |
| updated_at | timestamp | When profile was last updated      |

### spelling_lists

Stores spelling word lists created by parents.

| Column      | Type      | Description                |
| ----------- | --------- | -------------------------- |
| id          | uuid      | Primary key                |
| parent_id   | uuid      | Foreign key to profiles    |
| title       | text      | List title                 |
| description | text      | Optional description       |
| created_at  | timestamp | When list was created      |
| updated_at  | timestamp | When list was last updated |

### words

Stores individual words in spelling lists.

| Column     | Type      | Description                         |
| ---------- | --------- | ----------------------------------- |
| id         | uuid      | Primary key                         |
| list_id    | uuid      | Foreign key to spelling_lists       |
| word       | text      | The spelling word                   |
| audio_url  | text      | Optional URL to audio pronunciation |
| order      | integer   | Display order in list               |
| created_at | timestamp | When word was added                 |

### attempts

Stores child spelling attempts.

| Column       | Type      | Description                           |
| ------------ | --------- | ------------------------------------- |
| id           | uuid      | Primary key                           |
| child_id     | uuid      | Foreign key to profiles               |
| word_id      | uuid      | Foreign key to words                  |
| list_id      | uuid      | Foreign key to spelling_lists         |
| is_correct   | boolean   | Whether attempt was correct           |
| typed_answer | text      | What child typed (for Listen & Type)  |
| audio_url    | text      | Audio recording URL (for Say & Spell) |
| created_at   | timestamp | When attempt was made                 |

## Storage Buckets

### audio-recordings

Stores audio files uploaded by children during "Say & Spell" mode.

- Public access: No
- File size limit: 10MB
- Allowed MIME types: audio/webm, audio/mp4, audio/wav

## Row Level Security (RLS)

All tables have RLS enabled with appropriate policies:

- Users can only view/edit their own data
- Parents can manage their own lists and words
- Children can create attempts for any word
- Parents can view their children's attempts (requires additional parent-child relationship)

## Triggers

### on_auth_user_created

Automatically creates a profile entry when a new user signs up.
