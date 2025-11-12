# SpellStars ⭐

A Progressive Web App (PWA) for kids to practice spelling, built with Vite, React, and TypeScript.

## Features

- 🎮 **Two Game Modes**
  - **Listen & Type**: Hear the word and type it out
  - **Say & Spell**: Record yourself spelling the word out loud

- 👨‍👩‍👧 **Dual Interfaces**
  - Parent dashboard for managing spelling lists
  - Kid-friendly interface with big touch targets

- � **Parental Controls** (NEW!)
  - PIN lock protection for parent area
  - Configurable game settings (hints, case sensitivity, auto-readback)
  - Daily session time limits with gentle stop screen

- 📊 **Analytics Dashboard** (NEW!)
  - Track session length, words practiced, accuracy
  - Time-range filters (7 days, 30 days, all time)
  - Visual progress tracking in parent dashboard

- 🎖️ **Sticker Book** (NEW!)
  - Earn badges for achievements
  - Track star totals and milestones
  - 10+ unique badges to collect

- 🔊 **TTS Voice Picker** (NEW!)
  - Choose text-to-speech voice per word or set default
  - Multiple English variants (US, UK, Australian, Indian)

- ♿ **Enhanced Accessibility** (NEW!)
  - Larger touch targets (88px child, 44px parent)
  - Enhanced focus indicators (4px rings)
  - Comprehensive ARIA labels
  - Respects prefers-reduced-motion

- �📱 **Progressive Web App**
  - Installable on any device
  - Works offline
  - Background sync for queued data

- 🎤 **Audio Recording**
  - Record pronunciation attempts
  - Waveform visualization with ARIA labels
  - Auto-upload to cloud storage

- 🌟 **Rewards System**
  - Earn stars for correct answers
  - Track progress and streaks
  - Spaced repetition system (SRS)

## Tech Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router DOM
- **State Management**: Zustand
- **Server State**: TanStack React Query
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with class-variance-authority
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod
- **Backend**: Supabase (Auth, Database, Storage)
- **PWA**: vite-plugin-pwa (Workbox)
- **Offline Storage**: Dexie (IndexedDB)
- **Audio**: WaveSurfer.js, MediaRecorder API

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase account and project

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Set Up Supabase Database

Run the following SQL in your Supabase SQL editor to create the required tables:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create profiles table
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  role text not null check (role in ('parent', 'child')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create spelling_lists table
create table spelling_lists (
  id uuid default uuid_generate_v4() primary key,
  parent_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create words table
create table words (
  id uuid default uuid_generate_v4() primary key,
  list_id uuid references spelling_lists(id) on delete cascade not null,
  word text not null,
  audio_url text,
  "order" integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create attempts table
create table attempts (
  id uuid default uuid_generate_v4() primary key,
  child_id uuid references profiles(id) on delete cascade not null,
  word_id uuid references words(id) on delete cascade not null,
  list_id uuid references spelling_lists(id) on delete cascade not null,
  is_correct boolean not null,
  typed_answer text,
  audio_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table profiles enable row level security;
alter table spelling_lists enable row level security;
alter table words enable row level security;
alter table attempts enable row level security;

-- Profiles policies
create policy "Users can view their own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Spelling lists policies
create policy "Parents can view their own lists"
  on spelling_lists for select
  using (auth.uid() = parent_id);

create policy "Parents can create lists"
  on spelling_lists for insert
  with check (auth.uid() = parent_id);

create policy "Parents can update their own lists"
  on spelling_lists for update
  using (auth.uid() = parent_id);

create policy "Parents can delete their own lists"
  on spelling_lists for delete
  using (auth.uid() = parent_id);

-- Words policies
create policy "Users can view words from lists"
  on words for select
  using (true);

create policy "Parents can insert words"
  on words for insert
  with check (exists (
    select 1 from spelling_lists
    where spelling_lists.id = words.list_id
    and spelling_lists.parent_id = auth.uid()
  ));

-- Attempts policies
create policy "Users can view their own attempts"
  on attempts for select
  using (auth.uid() = child_id);

create policy "Users can create attempts"
  on attempts for insert
  with check (auth.uid() = child_id);

-- Create function to handle new user profile creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'parent')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger for new user
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### 4. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 5. Build for Production

```bash
npm run build
```

The build output will be in the `dist/` directory.

### 6. Preview Production Build

```bash
npm run preview
```

## Project Structure

```
spelling-stars/
├── src/
│   ├── app/
│   │   ├── components/        # UI components
│   │   │   ├── AppShell.tsx
│   │   │   ├── AudioRecorder.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Navigation.tsx
│   │   │   └── RewardStar.tsx
│   │   ├── hooks/            # Custom React hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useAudioRecorder.ts
│   │   │   └── useOnline.ts
│   │   ├── pages/            # Page components
│   │   │   ├── auth/
│   │   │   │   └── Login.tsx
│   │   │   ├── parent/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Lists.tsx
│   │   │   │   └── ListEditor.tsx
│   │   │   └── child/
│   │   │       ├── Home.tsx
│   │   │       ├── PlayListenType.tsx
│   │   │       ├── PlaySaySpell.tsx
│   │   │       └── Rewards.tsx
│   │   ├── store/            # Zustand stores
│   │   │   ├── auth.ts
│   │   │   └── audioQueue.ts
│   │   ├── main.tsx          # App entry point
│   │   ├── router.tsx        # Route configuration
│   │   ├── queryClient.ts    # React Query setup
│   │   └── supabase.ts       # Supabase client
│   ├── data/
│   │   └── db.ts             # Dexie IndexedDB schema
│   ├── lib/
│   │   └── utils.ts          # Utility functions
│   ├── styles/
│   │   └── index.css         # Global styles
│   └── vite-env.d.ts         # TypeScript definitions
├── index.html
├── vite.config.ts            # Vite configuration
├── tailwind.config.js        # Tailwind configuration
├── tsconfig.json             # TypeScript configuration
└── package.json
```

## PWA Features

### Offline Support

The app caches essential routes and assets for offline use:

- All child routes (`/child/*`) are cached for offline play
- Static assets (JS, CSS, images) are cached
- Supabase API calls use NetworkFirst strategy

### Background Sync

When offline, audio recordings and spelling attempts are queued in IndexedDB. When the device comes back online, the service worker automatically syncs the queued data to Supabase.

### Installation

Users can install the app on their device:

- **iOS**: Safari > Share > Add to Home Screen
- **Android**: Chrome menu > Install App
- **Desktop**: Browser address bar > Install icon

## Development

### Error Handling & User Feedback

The app includes comprehensive error handling and user feedback mechanisms:

**React Error Boundaries**

- App-wide error boundary catches component errors without full crash
- Fallback UI with error details and recovery options (reload page, go home)
- Automatic error logging and telemetry tracking

**Network Status Indicator**

- Persistent offline notification with variant styling for parent/child interfaces
- Parent variant: Dismissible banner with "You're offline" message
- Child variant: Non-dismissible, friendly "📡 Offline - Your work is being saved!" message
- Smooth slide-up animations when network status changes

**Loading States**

- All mutations show loading states with disabled inputs and "Saving..." indicators
- Prevents duplicate submissions during async operations
- Visual feedback with spinner icons on buttons

**Error Telemetry**

- Centralized error tracking via `logger.metrics.errorCaptured()`
- Tracks context, message, stack traces, severity, timestamps
- Circular buffer storage (max 50 errors) prevents memory issues
- Event listener pattern for subscribing to error events
- Integration points:
  - `useAudioRecorder`: Microphone access and recording errors
  - Game pages: Attempt save and list loading errors
  - Parent pages: List management and child account errors
  - Error boundaries: Component rendering errors

**Enhanced Error Messages**

- Browser-specific guidance (Safari microphone permissions)
- Actionable instructions (click lock icon, close other apps)
- User-friendly explanations for technical errors
- SetupError component with type-specific troubleshooting:
  - Environment variable configuration
  - Network connectivity issues
  - Database connection problems
  - Permission/authorization errors
  - General errors with fallback guidance

**Retry Mechanisms**

- Offline queue with automatic retry on reconnection
- Manual retry buttons in error states
- Exponential backoff for failed sync operations

### Troubleshooting

**Common Issues:**

1. **"Microphone not found" error**
   - Ensure microphone is connected and recognized by OS
   - Check browser permissions: Click lock icon in address bar
   - Close other apps using microphone (Zoom, Teams, etc.)
   - Safari users: May need to grant permission in browser settings

2. **"Cannot connect to database" error**
   - Verify Supabase credentials in `.env` file
   - Check Supabase project status at dashboard
   - Ensure network connectivity
   - Disable VPN if causing connection issues

3. **App won't install as PWA**
   - HTTPS required (localhost works for dev)
   - Check manifest.json is accessible
   - Clear browser cache and retry
   - Some browsers require user gesture to prompt install

4. **Offline sync not working**
   - Check IndexedDB is enabled in browser
   - Verify service worker is registered (DevTools > Application > Service Workers)
   - Clear site data and re-cache if corrupted
   - Check browser console for sync errors

5. **Loading states stuck**
   - Check network tab for failed requests
   - Review error telemetry: `logger.metrics.getErrors()`
   - Clear React Query cache: `queryClient.clear()`
   - Reload page to reset mutation states

**Debugging Tips:**

- Open browser DevTools console to see detailed error logs
- Check Application > IndexedDB for queued offline data
- Review Network tab for failed API requests
- Use `logger.metrics.getErrors()` in console to view error telemetry
- Check Supabase dashboard logs for server-side errors

### Database Health Monitoring

The project includes PowerShell scripts for database health monitoring:

- **`check-db-health.ps1`** - General database health metrics (unused indexes, missing FK indexes, table sizes)
- **`check-db-advisor.ps1`** - Application-specific health checks (critical indexes, RLS policies, security)

**Usage:**

```powershell
doppler run -- pwsh .\check-db-health.ps1
doppler run -- pwsh .\check-db-advisor.ps1
```

**Best Practices:**

- Run health checks weekly during active development
- When creating indexes, remember that UNIQUE constraints automatically create indexes
- Avoid creating standalone indexes on columns that are always filtered with other columns
- Use composite indexes when queries filter by multiple columns together
- Monitor index usage after schema changes to verify they're being used

**Documentation:**

- See `docs/DATABASE_ADVISOR_REPORT.md` for detailed database optimization findings
- See `docs/SRS_IMPLEMENTATION.md` for SRS-specific schema details

### Key Concepts

1. **Route Protection**: Routes are protected based on user authentication and role (parent/child)
2. **Offline Queue**: Uses Dexie to queue attempts and audio when offline
3. **Audio Recording**: Uses MediaRecorder API with WaveSurfer.js for visualization
4. **Responsive Design**: Child UI uses larger touch targets and fonts

### Adding New Features

1. Create components in `src/app/components/`
2. Add pages in `src/app/pages/`
3. Define routes in `src/app/router.tsx`
4. Add database queries using React Query
5. Update Supabase schema as needed

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- iOS Safari 14+
- Chrome Android 90+

## License

MIT

## Support

For issues and questions, please open an issue on the GitHub repository.
