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

## Recent Updates (November 2025)

### 🎯 Core Functionality Fixes

- **Game Progression**: Fixed critical bug where games wouldn't advance to next word after answering
- **Voice Recording**: Fixed microphone access and recording flow in Say & Spell mode
- **Auto-Save**: Added debounced auto-save in List Editor with visual indicator

### 🎨 UI/UX Improvements

- **Lists Page Redesign**: Transformed table layout to card-based grid with better visual hierarchy
- **Bulk Operations**: Added multi-select and bulk delete for words in List Editor
- **CSV Import**: Added file upload for importing word lists from CSV
- **Toast Notifications**: Integrated react-hot-toast for user feedback on all actions

### ♿ Accessibility Enhancements

- **WCAG 2.1 AA Compliance**: Full keyboard navigation and screen reader support
- **Error Boundaries**: App-wide error catching with graceful fallback UI
- **Network Status**: Persistent offline indicator with variant styling
- **Focus Management**: Auto-focus on inputs, focus trapping in modals
- **ARIA Labels**: Comprehensive labeling of all interactive elements

### 🗄️ Database Optimizations

- **Index Cleanup**: Removed 2 unused indexes on SRS table for better write performance
- **Health Monitoring**: Added PowerShell scripts for database health checks
- **Documentation**: Comprehensive database advisor report with optimization findings

### 📝 Code Quality

- **JSDoc Comments**: Added documentation to complex game logic functions
- **Variable Naming**: Improved clarity (e.g., `hasTriedOnce` → `isFirstAttempt`)
- **Error Telemetry**: Centralized error tracking with `logger.metrics.errorCaptured()`
- **Inline Comments**: Explained game flow logic in complex functions

## Accessibility

SpellStars is built with **WCAG 2.1 Level AA** compliance in mind, ensuring all children and parents can use the application effectively.

### Keyboard Navigation

All interactive elements are fully accessible via keyboard:

- **Tab / Shift+Tab**: Navigate between interactive elements
- **Enter / Space**: Activate buttons and submit forms
- **Escape**: Close modals and dialogs (if supported)
- **Arrow Keys**: Navigate list items and select options

Focus indicators are always visible with a 3px ring and distinct outline, making navigation clear for keyboard users.

### Screen Reader Support

The app provides comprehensive support for screen readers (NVDA, JAWS, VoiceOver):

- **Semantic HTML**: Proper heading hierarchy (h1, h2, h3), landmark roles (header, main, navigation)
- **ARIA Labels**: All buttons and interactive elements have descriptive aria-labels
- **Live Regions**: Game status updates, error messages, and loading states are announced in real-time
- **Visually Hidden Text**: Additional context provided for screen reader users without cluttering the visual interface
- **Skip Links**: Keyboard users can skip directly to main content without tabbing through navigation

Example screen reader announcements:

- Button: "Continue playing Listen and Type mode with 5 words due"
- Error: "Incorrect. Please try again" (announced immediately)
- Status: "Preparing export. Please wait." (announced while exporting)

### Visual Accessibility

**Focus Indicators**: 3px ring with 2px offset around focused elements for high visibility

**Touch Targets**:

- Child interface: 88px minimum height (exceeds WCAG AAA)
- Parent interface: 44px minimum height (meets WCAG AA)
- Icon buttons: Accompanied by descriptive text labels

**Color Contrast**:

- All text meets WCAG AA standard (4.5:1 for normal text, 3:1 for large text)
- Color is never the only way to convey information
- 30+ theme options with verified contrast ratios

**Motion Preferences**:

- Respects `prefers-reduced-motion` system setting
- Animations disabled for users who prefer reduced motion
- No autoplaying videos or animated GIFs

### Game Accessibility

#### Listen & Type Mode

- Word pronunciation provided via text-to-speech
- Live announcement of correct/incorrect answers
- Hints clearly labeled and associated with input field
- Focus automatically placed on answer input for efficient typing

#### Say & Spell Mode

- Record button clearly labeled: "Start recording your spelling"
- Recording status announced in real-time ("Recording... Press stop when done")
- Playback controls fully keyboard accessible
- Visual recording indicator with accessible status text

#### Child Home Page

- Due word count announced to screen readers
- Game progress displayed with context (e.g., "5 words due today")
- All buttons have full context in labels ("Continue playing Listen and Type with 5 words due")
- Icon decorations marked as decorative (aria-hidden="true")

### Parent Interface Accessibility

#### Lists Management

- Search input has associated label for screen readers
- Action buttons clearly indicate their target ("Edit Spelling Word List" not just "Edit")
- Sort dropdown properly labeled
- Empty state messaging is semantic and descriptive
- Delete confirmation requires explicit re-confirmation

#### Export Dialog

- Modal dialog is properly announced to screen readers
- Focus trap prevents keyboard navigation outside modal
- Modal title clearly labels the purpose
- Loading state announced in real-time: "Preparing export. Please wait."
- Close button has descriptive label: "Close export dialog"

### Implementation Details

**Core Accessibility Components**:

1. **VisuallyHidden**: Provides screen reader text without visual display

```tsx
<VisuallyHidden>{dueCount} words due for review</VisuallyHidden>
```

2. **SkipLink**: Allows keyboard users to skip navigation and go directly to main content
   - Visually hidden by default
   - Appears on focus for keyboard navigation

3. **FocusTrap**: Manages focus within modals to prevent tabbing to background content
   - Automatically moves focus to first focusable element when opened
   - Cycles focus within modal when Tab pressed at the end
   - Restores focus to trigger element when closed

**ARIA Patterns Used**:

- `role="dialog"` + `aria-modal="true"` for modals
- `aria-live="polite"/"assertive"` for status updates
- `aria-label` for buttons with icon + text
- `aria-describedby` for form hints and descriptions
- `aria-current="page"` for active navigation items
- `aria-hidden="true"` for decorative icons

### Testing Accessibility

**Automated Testing**:

- TypeScript strict mode catches missing accessibility attributes
- Build validates all components have proper ARIA attributes
- Tests verify focus management and keyboard navigation

**Manual Testing**:

1. **Keyboard Navigation**:

```bash
Open DevTools > Unplug mouse > Tab through entire app
Verify: All interactive elements reachable, focus visible, logical tab order
```

2. **Screen Reader Testing**:
   - **macOS**: VoiceOver (Cmd+F5)
   - **Windows**: NVDA (free) or JAWS
   - **Test**: Disable CSS to verify semantic HTML structure
   - **Test**: Close eyes and navigate entire app

3. **Color Contrast**:
   - Use browser DevTools color contrast analyzer
   - Verify all text meets WCAG AA (4.5:1 normal, 3:1 large)
   - Test with color blindness simulator

4. **Motion**:
   - DevTools > Rendering > Emulate CSS media feature prefers-reduced-motion
   - Verify animations are disabled

### Browser Accessibility Support

- **Chrome/Edge**: Full support with modern accessibility APIs
- **Firefox**: Full support with ARIA and semantic HTML
- **Safari**: Full support on macOS and iOS
- **Mobile VoiceOver (iOS)**: Full support, including rotor for quick navigation
- **Android TalkBack**: Full support with gesture navigation

### Accessibility Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Keyboard Accessibility](https://webaim.org/articles/keyboard/)
- [Screen Reader Testing](https://www.nvaccess.org/)

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
-- NOTE: This is an illustrative example. The actual production schema includes
-- additional columns (mode, quality, duration_ms) and uses 'correct' instead of 'is_correct'
-- and 'started_at' instead of 'created_at'. See docs/database-schema.md for the complete schema.
create table attempts (
  id uuid default uuid_generate_v4() primary key,
  child_id uuid references profiles(id) on delete cascade not null,
  word_id uuid references words(id) on delete cascade not null,
  list_id uuid references word_lists(id) on delete cascade not null,
  mode text not null check (mode in ('listen-type', 'say-spell', 'flash')),
  correct boolean not null,
  quality integer check (quality >= 0 and quality <= 5),
  typed_answer text,
  audio_url text,
  duration_ms integer,
  started_at timestamp with time zone default timezone('utc'::text, now()) not null
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

### Code Quality

The project maintains high code quality standards:

**Documentation**

- JSDoc comments on all complex functions
- Inline comments explaining non-obvious logic
- Component-level documentation for game pages
- Clear variable naming conventions

**Error Handling**

- Comprehensive error boundaries
- Toast notifications for user-facing errors
- Error telemetry for debugging
- Graceful degradation (offline mode, fallbacks)

**Testing**

- TypeScript strict mode catches type errors
- React Query handles loading/error states
- Manual testing checklist for new features
- Accessibility testing with keyboard and screen readers

**Performance**

- Debounced saves reduce API calls
- Optimized database indexes
- PWA caching for offline performance
- Lazy loading for code splitting

**Maintenance**

- No TODO comments left in code
- Deprecated code documented with removal timeline
- Regular database health monitoring
- Dependency updates tracked

### Code Documentation Standards

The codebase follows these documentation practices:

**JSDoc Comments**

- All complex functions have JSDoc comments explaining purpose, parameters, and behavior
- Game logic functions document the complete flow (correct/incorrect paths)
- Component-level JSDoc explains overall purpose and features

**Inline Comments**

- Complex logic sections have inline comments explaining non-obvious behavior
- State transitions are documented (e.g., record step → type step)
- Async operations note whether they block UI or run in background

**Variable Naming**

- Boolean variables use `is`, `has`, `should` prefixes (e.g., `isFirstAttempt`, `hasUpdatedStreak`)
- State variables include inline comments explaining their purpose
- Avoid ambiguous names like `flag`, `temp`, `data`

**Example Documentation Pattern**:

```typescript
/**
 * Validates user's spelling attempt and updates game state.
 *
 * @remarks
 * Correct Answer Flow:
 * 1. Set feedback to "correct"
 * 2. Award star if first attempt
 * 3. Save attempt (async, non-blocking)
 * 4. Update SRS (async, non-blocking)
 * 5. Auto-advance after 5 seconds
 */
const checkAnswer = useCallback(async () => {
  // Calculate quality score based on correctness and hint usage
  const quality = computeAttemptQuality(correct, isFirstAttempt, usedHint);

  // ... implementation
}, [dependencies]);
```

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

6. **"Game won't advance to next word"**
   - This was a known bug, now fixed in November 2025 update
   - If still experiencing: Clear browser cache and reload
   - Check browser console for JavaScript errors
   - Ensure you're on the latest version of the app

7. **"Auto-save indicator stuck on 'Saving...'"**
   - Check network tab for failed requests
   - Verify Supabase connection is active
   - Try manual save by navigating away and back
   - Clear React Query cache: `queryClient.clear()` in console

8. **"Bulk delete not working in List Editor"**
   - Ensure words are selected (checkboxes checked)
   - Confirm delete action in the confirmation dialog
   - Check browser console for errors
   - Verify you have permission to delete (parent role)

9. **"CSV import fails or imports wrong data"**
   - Ensure CSV format: one word per line, or columns: word,phonetic,voice
   - Check for special characters or encoding issues (use UTF-8)
   - Preview shows first 5 words - verify before importing
   - Large files (>100 words) may take time to import

10. **"Toast notifications not appearing"**
    - Check if browser has notification permissions
    - Verify react-hot-toast is loaded (check Network tab)
    - Try different browser to rule out extension conflicts
    - Check browser console for toast-related errors

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
4. **Responsive Design**: Child UI uses larger touch targets (88px) and fonts
5. **Error Boundaries**: React Error Boundaries catch component errors without full app crash
6. **Auto-Save**: Debounced saves (1 second delay) reduce API calls in List Editor
7. **Bulk Operations**: Multi-select with Set-based state management for O(1) lookups
8. **Accessibility**: WCAG 2.1 AA compliance with keyboard navigation and screen reader support
9. **Error Telemetry**: Centralized error tracking with circular buffer (max 50 errors)
10. **Database Health**: Regular monitoring with PowerShell scripts for index optimization

### Adding New Features

1. **Create components** in `src/app/components/`
   - Add JSDoc comment explaining component purpose
   - Include accessibility attributes (ARIA labels, roles)
   - Use existing components (Button, Card) for consistency

2. **Add pages** in `src/app/pages/`
   - Document complex functions with JSDoc
   - Add inline comments for non-obvious logic
   - Use clear variable names (avoid `hasTriedOnce`, prefer `isFirstAttempt`)

3. **Define routes** in `src/app/router.tsx`
   - Ensure proper route protection (ProtectedRoute, PinProtectedRoute)
   - Add to appropriate navigation (parent or child)

4. **Add database queries** using React Query
   - Use existing patterns from `src/app/api/supa.ts`
   - Add error handling with toast notifications
   - Add error telemetry: `logger.metrics.errorCaptured()`

5. **Update Supabase schema** as needed
   - Create migration file in `supabase/migrations/`
   - Add RLS policies for security
   - Run health checks after schema changes
   - Document index strategy in migration comments

6. **Update documentation**
   - Add feature to README "Recent Updates" section
   - Update relevant docs in `docs/` folder
   - Add troubleshooting tips if applicable

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
