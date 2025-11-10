# Setup Instructions for Parent Pages

## Database Migration

Before using the parent pages, you need to apply the storage bucket migration:

```powershell
# Apply the word-audio bucket migration
supabase db push

# Or if using the migration scripts:
.\push-migration.ps1
```

This will create:

- `word-audio` storage bucket (private, accessed via signed URLs)
- RLS policies for parent upload/update/delete access
- Authenticated read access (requires signed URLs for playback)

## Verify Storage Bucket

1. Go to your Supabase Dashboard
2. Navigate to Storage
3. Verify `word-audio` bucket exists
4. Check that policies are in place

## Usage

### Creating a List

1. Navigate to `/parent/lists`
2. Click "New List"
3. Enter title and optional week start date
4. Click "Create List"
5. You'll be redirected to the list editor

### Adding Words

**Option 1: Add One-by-One**

- Click "+ Add Word" button
- Type word text and optional phonetic
- Press Enter to add another word quickly

**Option 2: Bulk Import**

- Paste words in the bulk import textarea (one per line)
- Click "Import Words"
- Duplicates are automatically filtered out
- Shows count of newly added words

### Recording Audio

1. Click on a word row to select it
2. In the right panel, you'll see the selected word
3. Click "Start Recording"
4. Speak the word pronunciation
5. Click stop when done
6. The audio is automatically uploaded to Supabase Storage
7. A play button appears next to the word in the table

### Reordering Words

- Click and drag the grip handle (⋮⋮) on the left of each word
- Drop at desired position
- Changes are saved automatically with optimistic updates

### Editing List Metadata

- Update title or week start date in the left panel
- Click "Save Changes"
- Toast notification confirms save

### Duplicating a List

- From the lists table, click the copy icon
- A duplicate is created with "(Copy)" appended to title
- All words and their data are copied (except audio URLs)

### Deleting a List

- Click the delete icon
- Click "Confirm" to permanently delete
- This also removes all list_words associations

## Keyboard Shortcuts

- **Enter** in word input field: Add new word row

## Unsaved Changes Warning

The editor tracks changes and warns you if you try to leave with unsaved edits:

- Browser navigation warning
- Visual indicator in the metadata panel

## Troubleshooting

### Audio Upload Fails

- Check Supabase Storage bucket exists
- Verify RLS policies are in place
- Check browser console for errors
- Ensure microphone permissions granted

### Words Not Appearing

- Verify list is saved first (not a "new" list)
- Check React Query DevTools for query status
- Refresh the page

### Drag-and-Drop Not Working

- Ensure you're grabbing the grip handle (⋮⋮)
- Some browsers may require clicking and holding briefly
- Check browser console for errors

## Performance Considerations

- Lists with 100+ words may experience slower drag-and-drop
- Bulk import is more efficient than individual adds
- Audio files are cached by browser for faster playback

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (may need to enable microphone)
- Mobile browsers: Touch events may vary for drag-and-drop
