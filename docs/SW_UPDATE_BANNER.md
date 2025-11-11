# Service Worker Update Banner Implementation

## Overview

Replaced automatic page reload on service worker update with a user-friendly banner that gives users control over when to apply updates.

## Changes Made

### 1. New Component: `UpdateBanner.tsx`

Created a reusable banner component that:

- Displays at the bottom center of the screen with a friendly message
- Offers two actions:
  - **Refresh Now** - Immediately applies the update
  - **Later** - Dismisses the banner (user can continue using current version)
- Includes a close button (X) for quick dismissal
- Uses existing SpellStars design system (Button component, CVA patterns)
- Fully accessible with proper ARIA labels

### 2. Modified: `main.tsx`

Updated service worker registration to:

- **Default behavior**: Show UpdateBanner instead of auto-reload
- **Force update flag**: Set `VITE_FORCE_UPDATE=true` environment variable for critical releases that require immediate reload
- Event-driven architecture: Dispatches `sw-update-available` custom event when new SW activates
- New `App` wrapper component manages banner visibility state

### 3. User Experience Flow

**Standard Update (default):**

```
1. New service worker detected and activated
2. Custom event "sw-update-available" dispatched
3. UpdateBanner appears at bottom of screen
4. User can:
   - Click "Refresh Now" → reload immediately
   - Click "Later" or X → dismiss banner, continue using app
   - Update will auto-apply on next navigation or page load
```

**Critical Update (VITE_FORCE_UPDATE=true):**

```
1. New service worker detected and activated
2. Immediate reload (old behavior) - bypasses banner
3. Ensures critical security/bug fixes are applied immediately
```

## Environment Variable

Add to `.env` or Doppler for critical releases:

```bash
VITE_FORCE_UPDATE=true  # Force immediate reload (emergency use only)
```

Default (not set): Show UpdateBanner for user-controlled updates

## Benefits

1. **Better UX**: Users aren't interrupted mid-task with sudden reload
2. **User Control**: Users decide when to apply updates
3. **Flexibility**: Force flag available for critical security patches
4. **Visibility**: Clear notification that update is available
5. **Non-Disruptive**: Update applies naturally on next navigation if dismissed

## Technical Details

### Event Communication

- Service worker activation triggers `CustomEvent('sw-update-available')`
- React App component listens for event and updates state
- State change renders UpdateBanner component

### State Management

- Local React state in App component (not Zustand)
- Banner visibility controlled by `showBanner` boolean
- No persistence needed (updates should be applied eventually)

### Styling

- Positioned fixed at `bottom-4` with responsive centering
- Uses theme colors (`bg-primary`, `text-primary-foreground`)
- High z-index (50) ensures visibility over content
- Shadow and border for visual prominence

### Logging

- All update events logged via `logger` utility
- Tracks: SW activation, banner display, user actions (refresh/dismiss)
- Production-safe with existing logger configuration

## Testing

### Manual Testing

1. **Local Development:**

   ```powershell
   npm run build
   npm run preview
   # Make a code change
   npm run build
   # Reload preview - banner should appear
   ```

2. **Force Update:**

   ```powershell
   $env:VITE_FORCE_UPDATE="true"
   npm run build
   npm run preview
   # Should auto-reload without banner
   ```

3. **Production:**
   - Deploy new version
   - Keep old version open in browser
   - Wait for hourly update check (or manually trigger with DevTools)
   - Verify banner appears

### DevTools Testing

1. Open DevTools > Application > Service Workers
2. Check "Update on reload"
3. Make changes and reload - banner should appear
4. Test both "Refresh Now" and "Later" buttons
5. Verify console logs for update events

## Rollback Plan

If issues occur, revert to auto-reload by:

1. Set `VITE_FORCE_UPDATE=true` in environment
2. Or revert commits and redeploy

## Future Enhancements

Potential improvements:

- Auto-apply update after X hours of inactivity
- Show update notes/changelog in banner
- Progress indicator during reload
- Offline banner hiding (only show when online)
- Snooze functionality with configurable timeout

## Related Files

- `src/app/components/UpdateBanner.tsx` - Banner component
- `src/app/main.tsx` - SW registration and App wrapper
- `vite.config.ts` - PWA plugin configuration
- `src/lib/logger.ts` - Logging utility
