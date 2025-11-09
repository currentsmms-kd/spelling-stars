# Schema Update Implementation Summary

## ✅ Completed Tasks

### 1. Database Migration (`20241108000001_update_schema.sql`)

**New Schema Structure:**

#### Tables Created

- **`profiles`**: Updated with `display_name` and `avatar_url` fields (removed `email` field as it's in auth.users)
- **`word_lists`**: Renamed from `spelling_lists`, added `week_start_date`, renamed `parent_id` to `created_by`
- **`words`**: Separated from lists, added `phonetic`, `tts_voice`, `prompt_audio_url` fields
- **`list_words`**: New junction table connecting word_lists and words with `sort_index`
- **`attempts`**: Updated with `mode` field (listen_type/say_spell/flash), renamed `is_correct` to `correct`, added `duration_ms`, renamed `created_at` to `started_at`
- **`rewards`**: New table with `child_id`, `stars_total`, `streak_current`, `badges` (JSONB)

#### Indexes

- `idx_attempts_child_word_started` on attempts(child_id, word_id, started_at DESC)
- `idx_list_words_list_sort` on list_words(list_id, sort_index)
- `idx_word_lists_created_by` on word_lists(created_by)

#### Row Level Security (RLS)

- **Profiles**: Parents can read all (placeholder), children can read only their own
- **word_lists, words, list_words**: All authenticated users can read; only parents can insert/update/delete
- **attempts**: Children can insert/read their own; parents can read all (placeholder)
- **rewards**: Children can read/update their own; parents can read/update all (placeholder)

#### SQL Functions

- **`fn_add_stars(p_child UUID, p_amount INTEGER)`**: Increments rewards.stars_total and returns new total
- **`handle_new_user()`**: Auto-creates profile on user signup
- **`update_updated_at_column()`**: Auto-updates updated_at timestamps

### 2. Seed Data (`20241108000002_seed_data.sql`)

**Test Data Created:**

- 1 parent profile (Demo Parent)
- 2 child profiles (Emma, Noah)
- Rewards entries for both children
- 1 demo word list ("Week 1 - Short Vowels")
- 10 words (cat, dog, sun, hat, bed, pen, top, big, run, sit)
- list_words mappings with sort indices 1-10

**Note**: The seed data uses fixed UUIDs for testing. In production, you'll need to create actual auth users through Supabase Auth.

### 3. TypeScript Types (`src/types/database.types.ts`)

Updated to reflect the new schema with:

- All new tables (word_lists, list_words, rewards)
- Updated field names (e.g., `correct` instead of `is_correct`)
- New function definition for `fn_add_stars`

### 4. TypeScript API Client (`src/app/api/supa.ts`)

**Helper Functions Implemented:**

- **`getProfilesMe()`**: Get current user's profile
- **`getLists()`**: Get all word lists
- **`getListWithWords(id)`**: Get a list with all its words (joined and sorted)
- **`upsertList(list)`**: Create or update a word list
- **`insertAttempt(attempt)`**: Insert a new attempt
- **`uploadAudio(file)`**: Upload audio file and return public URL
- **`getRewards(childId)`**: Get rewards for a child
- **`addStars(childId, amount)`**: Add stars using SQL function
- **`createWord(word)`**: Create a new word
- **`addWordToList(listId, wordId, sortIndex)`**: Add word to list
- **`removeWordFromList(listId, wordId)`**: Remove word from list
- **`getAttempts(childId)`**: Get all attempts for a child
- **`getAttemptsForWord(childId, wordId)`**: Get attempts for specific word

### 5. Updated Supabase Exports (`src/app/supabase.ts`)

Exported type helpers for all new tables:

- WordList, WordListInsert, WordListUpdate
- ListWord, ListWordInsert, ListWordUpdate
- Reward, RewardInsert, RewardUpdate

## 🔄 Next Steps

1. **Apply Migrations**: Run the migrations in your Supabase project:

   ```bash
   supabase db push
   ```

   Or apply them manually through the Supabase dashboard.

2. **Create Auth Users**: The seed data references fixed UUIDs. You'll need to:
   - Create actual users through Supabase Auth
   - Update the profile entries to match real user IDs
   - Or use the auth trigger to auto-create profiles

3. **Update Application Code**: Review existing code that references:
   - `spelling_lists` → should use `word_lists`
   - `is_correct` → should use `correct`
   - `created_at` in attempts → should use `started_at`
   - Direct word-list relationships → should use `list_words` junction

4. **Test the API**: Use the new helper functions from `src/app/api/supa.ts` in your components

## 📝 Key Differences from Original Schema

- **Word Lists**: Renamed table, added week_start_date
- **Words**: Now separate from lists with many-to-many relationship via `list_words`
- **Profiles**: Added display_name and avatar_url
- **Attempts**: Added mode field, duration_ms, better naming
- **Rewards**: Completely new table for gamification
- **RLS**: More granular policies with parent/child role checks

## 🔐 Security Notes

The current RLS policies use placeholders for family grouping. In production, you should:

- Add a `family_id` column to profiles
- Update policies to scope parents' access to their own family
- Ensure children can only access their family's data

## 📚 Usage Example

```typescript
import * as api from "./app/api/supa";

// Get current user profile
const profile = await api.getProfilesMe();

// Get a list with words
const list = await api.getListWithWords("list-id");

// Record an attempt
const attempt = await api.insertAttempt({
  child_id: "child-uuid",
  word_id: "word-uuid",
  mode: "listen_type",
  correct: true,
  typed_answer: "cat",
  duration_ms: 3500,
});

// Add stars
const newTotal = await api.addStars("child-uuid", 10);
```
