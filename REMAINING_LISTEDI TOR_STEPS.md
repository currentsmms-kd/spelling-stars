# Remaining Implementation Steps for ListEditor.tsx

## Current Status

### ✅ Completed

1. All new hook files created (useDebounce, useBulkSelection, useKeyboardShortcuts)
2. All new component files created (AutoSaveIndicator, BulkActionToolbar, ListStatistics)
3. AudioRecorder enhanced with instructions and better UX
4. useBulkDeleteWords mutation added to supa.ts
5. All imports added to ListEditor.tsx
6. State declarations added for auto-save, CSV import, selection mode
7. Auto-save effect implemented
8. Keyboard shortcuts set up
9. CSV import handlers implemented
10. Bulk delete handler implemented
11. handleUpdateWord modified for auto-save
12. AutoSaveIndicator and ListStatistics added to render
13. Keyboard shortcuts help text added to render

### ❌ Remaining Tasks

## 1. Update WordsListSection Component Props and Implementation

**Location:** Line 353 in ListEditor.tsx

**Changes needed:**

### Add new props to interface

```typescript
function WordsListSection({
  // ... existing props ...
  isSelectionMode,
  onToggleSelectionMode,
  bulkSelection,
  onBulkDelete,
  isBulkDeleting,
}: {
  // ... existing types ...
  isSelectionMode: boolean;
  onToggleSelectionMode: () => void;
  bulkSelection: {
    selectedIds: Set<string>;
    isSelected: (id: string) => boolean;
    toggleSelection: (id: string) => void;
    selectAll: () => void;
    clearSelection: () => void;
    selectedCount: number;
    isAllSelected: boolean;
  };
  onBulkDelete: () => void;
  isBulkDeleting: boolean;
}) {
```

### Update header section (replace lines 397-407)

```typescript
<div className="flex items-center justify-between mb-4">
  <div className="flex items-center gap-3">
    {isSelectionMode && (
      <input
        type="checkbox"
        checked={bulkSelection.isAllSelected}
        onChange={() => {
          if (bulkSelection.isAllSelected) {
            bulkSelection.clearSelection();
          } else {
            bulkSelection.selectAll();
          }
        }}
        className="h-5 w-5 rounded border-2 border-border bg-background text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-label="Select all words"
      />
    )}
    <h3 className="text-lg font-semibold">
      Words ({words.length})
      {bulkSelection.selectedCount > 0 && ` - ${bulkSelection.selectedCount} selected`}
    </h3>
  </div>
  <div className="flex gap-2">
    {!isNewList && words.length > 0 && (
      <Button
        variant={isSelectionMode ? "default" : "ghost"}
        size="sm"
        onClick={onToggleSelectionMode}
      >
        {isSelectionMode ? "Cancel" : "Select"}
      </Button>
    )}
    <Button
      onClick={handleAddWord}
      disabled={isNewList || addWordPending}
      size="sm"
      className="flex items-center gap-2"
    >
      <Plus size={16} />
      Add Word
    </Button>
  </div>
</div>
```

### Add BulkActionToolbar (after header, before word list)

```typescript
{bulkSelection.selectedCount > 0 && (
  <BulkActionToolbar
    selectedCount={bulkSelection.selectedCount}
    totalCount={words.length}
    onDelete={onBulkDelete}
    onClear={() => bulkSelection.clearSelection()}
    isDeleting={isBulkDeleting}
  />
)}
```

### Update WordRow rendering (replace lines 419-437)

```typescript
<WordRow
  key={word.id}
  word={word}
  index={index}
  isSelected={selectedWordId === word.id}
  isDragOver={
    dragState.dragOverIndex === index &&
    dragState.draggedIndex !== index
  }
  isDragging={dragState.draggedIndex === index}
  isSelectionMode={isSelectionMode}
  isBulkSelected={bulkSelection.isSelected(word.id)}
  onDragStart={() => handleDragStart(index)}
  onDragOver={(e) => handleDragOver(e, index)}
  onDrop={(e) => handleDrop(e, index)}
  onDragEnd={handleDragEnd}
  onSelect={() => setSelectedWordId(word.id)}
  onToggleSelect={() => bulkSelection.toggleSelection(word.id)}
  onUpdateWord={handleUpdateWord}
  onKeyDown={handleKeyDown}
  onPlayAudio={handlePlayAudio}
  onDelete={handleDeleteWord}
  isDeleting={deleteWordPending}
  availableVoices={availableVoices}
/>
```

## 2. Add CSV Import Section Component

**Location:** Insert before WordsListSection function definition (around line 352)

```typescript
function CSVImportSection({
  listId,
  onFileSelect,
  csvData,
  onImportComplete,
  importProgress,
  addWordPending,
}: {
  listId: string | undefined;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  csvData: Array<{ text: string; phonetic?: string; tts_voice?: string }>;
  onImportComplete: () => void;
  importProgress: { current: number; total: number } | null;
  addWordPending: boolean;
}) {
  return (
    <Card className="mt-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Upload size={20} />
        Import from CSV
      </h3>

      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-3">
            Upload a CSV file with words (one per line, or columns: word, phonetic, voice)
          </p>
          <input
            id="csv-file-input"
            type="file"
            accept=".csv"
            onChange={onFileSelect}
            className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            disabled={!listId || addWordPending}
          />
        </div>

        {csvData.length > 0 && (
          <div className="border rounded-lg p-3 bg-muted">
            <p className="text-sm font-medium mb-2">Preview (first 5 words):</p>
            <ul className="text-sm space-y-1">
              {csvData.slice(0, 5).map((word, i) => (
                <li key={i} className="text-muted-foreground">
                  {word.text}
                  {word.phonetic && ` (${word.phonetic})`}
                  {word.tts_voice && ` - ${word.tts_voice}`}
                </li>
              ))}
            </ul>
            {csvData.length > 5 && (
              <p className="text-xs text-muted-foreground mt-2">
                ...and {csvData.length - 5} more
              </p>
            )}
          </div>
        )}

        {importProgress && (
          <div className="text-sm text-muted-foreground">
            Importing {importProgress.current} of {importProgress.total}...
          </div>
        )}

        <Button
          onClick={onImportComplete}
          disabled={csvData.length === 0 || addWordPending}
          className="w-full flex items-center justify-center gap-2"
        >
          <Upload size={18} />
          Import {csvData.length} Words
        </Button>
      </div>
    </Card>
  );
}
```

## 3. Update ListDetailsSection to Include CSV Import

**Location:** Line 284 (ListDetailsSection function)

### Add new props to interface

```typescript
  csvFile: File | null;
  csvData: Array<{ text: string; phonetic?: string; tts_voice?: string }>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCSVImport: () => void;
  importProgress: { current: number; total: number } | null;
```

### Add CSVImportSection render (after bulk import Card)

```typescript
{!isNewList && (
  <CSVImportSection
    listId={listId}
    onFileSelect={handleFileSelect}
    csvData={csvData}
    onImportComplete={handleCSVImport}
    importProgress={importProgress}
    addWordPending={addWordPending}
  />
)}
```

## 4. Update ListDetailsSection Call in Main Render

**Location:** Line 1148 (in main return statement)

### Add new props to the call

```typescript
<ListDetailsSection
  isNewList={isNewList}
  register={register}
  errors={errors}
  handleSubmit={handleSubmit}
  onSubmitMeta={onSubmitMeta}
  createListPending={createList.isPending}
  updateListPending={updateList.isPending}
  hasUnsavedChanges={hasUnsavedChanges}
  bulkImportText={bulkImportText}
  setBulkImportText={setBulkImportText}
  handleBulkImport={handleBulkImport}
  addWordPending={addWord.isPending}
  csvFile={csvFile}
  csvData={csvData}
  handleFileSelect={handleFileSelect}
  handleCSVImport={handleCSVImport}
  importProgress={importProgress}
  listId={id}
/>
```

## 5. Update WordsListSection Call in Main Render

**Location:** Line 1163 (in main return statement)

### Add new props to the call

```typescript
<WordsListSection
  isNewList={isNewList}
  words={words}
  handleAddWord={handleAddWord}
  addWordPending={addWord.isPending}
  selectedWordId={selectedWordId}
  dragState={dragState}
  handleDragStart={handleDragStart}
  handleDragOver={handleDragOver}
  handleDrop={handleDrop}
  handleDragEnd={handleDragEnd}
  setSelectedWordId={setSelectedWordId}
  handleUpdateWord={handleUpdateWord}
  handleKeyDown={handleKeyDown}
  handlePlayAudio={handlePlayAudio}
  handleDeleteWord={handleDeleteWord}
  deleteWordPending={deleteWord.isPending}
  availableVoices={availableVoices}
  isSelectionMode={isSelectionMode}
  onToggleSelectionMode={() => setIsSelectionMode(!isSelectionMode)}
  bulkSelection={bulkSelection}
  onBulkDelete={handleBulkDelete}
  isBulkDeleting={bulkDeleteWords.isPending}
/>
```

## 6. Update AudioRecorderSection Call

**Location:** Line 1182 (in main return statement)

### Add showInstructions prop

```typescript
<AudioRecorderSection
  selectedWord={selectedWord}
  handleAudioRecorded={handleAudioRecorded}
  uploadingAudio={uploadingAudio}
  handlePlayAudio={handlePlayAudio}
  showInstructions={true}
/>
```

### Update AudioRecorderSection Props

```typescript
function AudioRecorderSection({
  selectedWord,
  handleAudioRecorded,
  uploadingAudio,
  handlePlayAudio,
  showInstructions = true,
}: {
  // ... existing props ...
  showInstructions?: boolean;
}) {
```

### Update AudioRecorder render

```typescript
<AudioRecorder
  onRecordingComplete={handleAudioRecorded}
  showInstructions={showInstructions}
/>
```

## Final Checklist

Once all above changes are made:

- [ ] No TypeScript errors
- [ ] All imports used
- [ ] All props passed correctly
- [ ] Auto-save indicator appears
- [ ] List statistics appear
- [ ] Selection mode toggle works
- [ ] Bulk selection with checkboxes works
- [ ] Bulk delete works
- [ ] CSV file selection works
- [ ] CSV import works
- [ ] Keyboard shortcuts work
- [ ] AudioRecorder instructions appear

## Testing Steps

1. Open an existing list
2. Verify statistics display at top
3. Edit a word - verify auto-save indicator shows "saving" then "saved"
4. Click "Select" button - verify checkboxes appear
5. Check some words - verify BulkActionToolbar appears
6. Click "Delete Selected" - verify confirmation and deletion
7. Press Ctrl+A - verify all words selected
8. Press Escape - verify selection cleared
9. Upload CSV file - verify preview appears
10. Click Import - verify words added with progress
11. Verify AudioRecorder shows instructions
