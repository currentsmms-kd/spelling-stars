import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useForm,
  type UseFormRegister,
  type FieldErrors,
  type UseFormHandleSubmit,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import { Toast } from "@/app/components/Toast";
import { AutoSaveIndicator } from "@/app/components/AutoSaveIndicator";
import { BulkActionToolbar } from "@/app/components/BulkActionToolbar";
import { ListStatistics } from "@/app/components/ListStatistics";
import { Plus, Trash2, Save, GripVertical, Play, Upload } from "lucide-react";
import { useAuth } from "@/app/hooks/useAuth";
import { useDebounce } from "@/app/hooks/useDebounce";
import { useBulkSelection } from "@/app/hooks/useBulkSelection";
import { useKeyboardShortcuts } from "@/app/hooks/useKeyboardShortcuts";
import { logger } from "@/lib/logger";
import { toast } from "react-hot-toast";
import {
  useWordList,
  useCreateWordList,
  useUpdateWordList,
  useAddWordToList,
  useDeleteWordFromList,
  useUpdateWord,
  useReorderWords,
  useUploadAudio,
  useBulkDeleteWords,
  type WordWithIndex,
} from "@/app/api/supa";
import { parseCSV, normalizeForDedupe } from "@/lib/csvParser";

const listMetaSchema = z.object({
  title: z.string().min(1, "Title is required"),
  week_start_date: z.string().optional(),
});

type ListMetaFormData = z.infer<typeof listMetaSchema>;

interface DragState {
  draggedIndex: number | null;
  dragOverIndex: number | null;
}

interface WordRowProps {
  word: WordWithIndex;
  index: number;
  isSelected: boolean;
  isDragOver: boolean;
  isDragging: boolean;
  isSelectionMode: boolean;
  isBulkSelected: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onSelect: () => void;
  onToggleSelect: () => void;
  onUpdateWord: (
    wordId: string,
    field: "text" | "phonetic" | "tts_voice",
    value: string
  ) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPlayAudio: (url: string) => void;
  onUploadAudio: (wordId: string, file: File) => void;
  onDelete: (wordId: string) => void;
  isDeleting: boolean;
  showAdvancedOptions: boolean;
  inputRefCallback?: (el: HTMLInputElement | null) => void;
  rowRefCallback?: (el: HTMLDivElement | null) => void;
}

function WordRow({
  word,
  index,
  isSelected,
  isDragOver,
  isDragging,
  isSelectionMode,
  isBulkSelected,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onSelect,
  onToggleSelect,
  onUpdateWord,
  onKeyDown,
  onPlayAudio,
  onUploadAudio,
  onDelete,
  isDeleting,
  showAdvancedOptions,
  inputRefCallback,
  rowRefCallback,
}: WordRowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadAudio(word.id, file);
    }
  };

  return (
    <div className="relative">
      {/* Drop indicator line */}
      {isDragOver && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-primary/70 rounded-t-lg z-10" />
      )}
      <div
        ref={rowRefCallback}
        draggable={!isSelectionMode}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        className={`border-2 rounded-lg transition-all ${
          isSelected
            ? "border-primary bg-primary/10"
            : "border-border hover:border-primary/50"
        } ${isDragOver ? "border-primary bg-primary/5 scale-[1.02]" : ""} ${
          isDragging ? "opacity-50" : ""
        }`}
      >
        {/* Main row */}
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect();
            }
          }}
          className={`flex items-center gap-3 p-3 ${isSelectionMode ? "cursor-pointer" : "cursor-move"}`}
          onClick={onSelect}
        >
          {/* Bulk Selection Checkbox */}
          {isSelectionMode && (
            <input
              type="checkbox"
              checked={isBulkSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect();
              }}
              className="h-5 w-5 rounded border-2 border-border bg-background text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label={`Select word ${word.text || `#${index + 1}`}`}
              onClick={(e) => e.stopPropagation()}
            />
          )}

          {!isSelectionMode && (
            <GripVertical
              size={20}
              className="text-muted-foreground flex-shrink-0"
            />
          )}

          <div className="w-12 text-muted-foreground text-sm flex-shrink-0">
            #{index + 1}
          </div>

          {/* Word text input - PRIMARY FOCUS */}
          <input
            ref={inputRefCallback}
            type="text"
            value={word.text}
            onChange={(e) => onUpdateWord(word.id, "text", e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Enter word"
            className={`flex-1 px-3 py-2 text-base border rounded focus:ring-2 focus:ring-primary focus:border-transparent bg-input ${
              !word.text ? "ring-2 ring-primary/50" : ""
            }`}
            onClick={(e) => e.stopPropagation()}
            autoFocus={!word.text && index === 0}
          />

          {/* Audio actions - SECONDARY */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {word.prompt_audio_url ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (word.prompt_audio_url) {
                      onPlayAudio(word.prompt_audio_url);
                    }
                  }}
                  title="Play audio"
                  aria-label="Play audio pronunciation"
                >
                  <Play size={16} aria-hidden="true" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  title="Change audio"
                  aria-label="Change audio"
                >
                  <Upload size={16} aria-hidden="true" />
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                title="Upload audio"
                aria-label="Upload audio"
              >
                <Upload size={16} aria-hidden="true" />
                <span className="ml-1 text-xs">Audio</span>
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="hidden"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Delete button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(word.id);
            }}
            disabled={isDeleting}
            title="Delete word"
            aria-label="Delete word"
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        </div>

        {/* Advanced options row - collapsed by default */}
        {showAdvancedOptions && (
          <div className="px-3 pb-3 pt-0 flex items-center gap-3 border-t border-border/50">
            <div className="w-12 flex-shrink-0" /> {/* Spacer for alignment */}
            {!isSelectionMode && (
              <div className="w-5 flex-shrink-0" /> // Spacer for grip icon
            )}
            {isSelectionMode && (
              <div className="w-5 flex-shrink-0" /> // Spacer for checkbox
            )}
            <input
              type="text"
              value={word.phonetic || ""}
              onChange={(e) =>
                onUpdateWord(word.id, "phonetic", e.target.value)
              }
              placeholder="Phonetic spelling (optional)"
              className="flex-1 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-ring focus:border-transparent bg-input"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ListMetaForm({
  isNewList,
  register,
  errors,
  handleSubmit,
  onSubmitMeta,
  createListPending,
  updateListPending,
  hasUnsavedChanges,
}: {
  isNewList: boolean;
  register: UseFormRegister<ListMetaFormData>;
  errors: FieldErrors<ListMetaFormData>;
  handleSubmit: UseFormHandleSubmit<ListMetaFormData>;
  onSubmitMeta: (data: ListMetaFormData) => Promise<void>;
  createListPending: boolean;
  updateListPending: boolean;
  hasUnsavedChanges: boolean;
}) {
  return (
    <form onSubmit={handleSubmit(onSubmitMeta)} className="space-y-4">
      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium text-foreground mb-1"
        >
          Title *
        </label>
        <input
          {...register("title")}
          type="text"
          id="title"
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input"
          placeholder="Week 1"
        />
        {errors.title && (
          <p className="mt-1 text-sm text-destructive">
            {errors.title.message}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="week_start_date"
          className="block text-sm font-medium text-foreground mb-1"
        >
          Week Start Date
        </label>
        <input
          {...register("week_start_date")}
          type="date"
          id="week_start_date"
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input"
        />
      </div>

      <Button
        type="submit"
        className="w-full flex items-center justify-center gap-2"
        disabled={createListPending || updateListPending}
      >
        <Save size={18} />
        {isNewList ? "Create List" : "Save Changes"}
      </Button>

      {hasUnsavedChanges && (
        <p className="text-sm text-accent-foreground">
          You have unsaved changes
        </p>
      )}
    </form>
  );
}

function ListDetailsSection({
  isNewList,
  register,
  errors,
  handleSubmit,
  onSubmitMeta,
  createListPending,
  updateListPending,
  hasUnsavedChanges,
  bulkImportText,
  setBulkImportText,
  handleBulkImport,
  addWordPending,
}: {
  isNewList: boolean;
  register: UseFormRegister<ListMetaFormData>;
  errors: FieldErrors<ListMetaFormData>;
  handleSubmit: UseFormHandleSubmit<ListMetaFormData>;
  onSubmitMeta: (data: ListMetaFormData) => Promise<void>;
  createListPending: boolean;
  updateListPending: boolean;
  hasUnsavedChanges: boolean;
  bulkImportText: string;
  setBulkImportText: (text: string) => void;
  handleBulkImport: () => void;
  addWordPending: boolean;
}) {
  return (
    <div className="lg:col-span-3">
      <Card>
        <h3 className="text-lg font-semibold mb-4">List Details</h3>
        <ListMetaForm
          isNewList={isNewList}
          register={register}
          errors={errors}
          handleSubmit={handleSubmit}
          onSubmitMeta={onSubmitMeta}
          createListPending={createListPending}
          updateListPending={updateListPending}
          hasUnsavedChanges={hasUnsavedChanges}
        />
      </Card>

      {!isNewList && (
        <Card className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Bulk Import</h3>
          <textarea
            value={bulkImportText}
            onChange={(e) => setBulkImportText(e.target.value)}
            placeholder="Paste words (one per line)"
            rows={6}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent mb-3 bg-input"
          />
          <Button
            onClick={handleBulkImport}
            disabled={!bulkImportText.trim() || addWordPending}
            className="w-full flex items-center justify-center gap-2"
          >
            <Upload size={18} />
            Import Words
          </Button>
        </Card>
      )}
    </div>
  );
}

function WordsListSection({
  isNewList,
  words,
  handleAddWord,
  addWordPending,
  selectedWordId,
  dragState,
  handleDragStart,
  handleDragOver,
  handleDrop,
  handleDragEnd,
  setSelectedWordId,
  handleUpdateWord,
  handleKeyDown,
  handlePlayAudio,
  handleUploadAudio,
  handleDeleteWord,
  deleteWordPending,
  showAdvancedOptions,
  onToggleAdvancedOptions,
  isSelectionMode,
  onToggleSelectionMode,
  bulkSelection,
  onBulkDelete,
  isBulkDeleting,
  wordInputRefs,
  wordRowRefs,
}: {
  isNewList: boolean;
  words: WordWithIndex[];
  handleAddWord: () => void;
  addWordPending: boolean;
  selectedWordId: string | null;
  dragState: DragState;
  handleDragStart: (index: number) => void;
  handleDragOver: (e: React.DragEvent, index: number) => void;
  handleDrop: (e: React.DragEvent, index: number) => void;
  handleDragEnd: () => void;
  setSelectedWordId: (id: string) => void;
  handleUpdateWord: (
    wordId: string,
    field: "text" | "phonetic" | "tts_voice",
    value: string
  ) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handlePlayAudio: (url: string) => void;
  handleUploadAudio: (wordId: string, file: File) => void;
  handleDeleteWord: (wordId: string) => void;
  deleteWordPending: boolean;
  showAdvancedOptions: boolean;
  onToggleAdvancedOptions: () => void;
  isSelectionMode: boolean;
  onToggleSelectionMode: () => void;
  bulkSelection: ReturnType<typeof useBulkSelection>;
  onBulkDelete: () => void;
  isBulkDeleting: boolean;
  wordInputRefs: React.MutableRefObject<Map<string, HTMLInputElement>>;
  wordRowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}) {
  return (
    <div className="lg:col-span-6">
      <Card>
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
                className="h-5 w-5 rounded border-2"
                aria-label="Select all words"
              />
            )}
            <h3 className="text-lg font-semibold">
              Words ({words.length})
              {bulkSelection.selectedCount > 0 &&
                ` - ${bulkSelection.selectedCount} selected`}
            </h3>
          </div>
          <div className="flex gap-2">
            <Button
              variant={showAdvancedOptions ? "default" : "ghost"}
              size="sm"
              onClick={onToggleAdvancedOptions}
              title="Show/hide phonetic fields"
            >
              Advanced
            </Button>
            <Button
              variant={isSelectionMode ? "default" : "ghost"}
              size="sm"
              onClick={onToggleSelectionMode}
            >
              {isSelectionMode ? "Cancel" : "Select"}
            </Button>
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

        {bulkSelection.selectedCount > 0 && (
          <BulkActionToolbar
            selectedCount={bulkSelection.selectedCount}
            totalCount={words.length}
            onDelete={onBulkDelete}
            onClear={() => bulkSelection.clearSelection()}
            isDeleting={isBulkDeleting}
          />
        )}

        {isNewList ? (
          <p className="text-muted-foreground text-center py-8">
            Save the list first to add words
          </p>
        ) : words.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No words yet. Add your first word or use bulk import.
          </p>
        ) : (
          <div className="space-y-2">
            {words.map((word, index) => (
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
                onUploadAudio={handleUploadAudio}
                onDelete={handleDeleteWord}
                isDeleting={deleteWordPending}
                showAdvancedOptions={showAdvancedOptions}
                inputRefCallback={(el) => {
                  if (el) {
                    wordInputRefs.current.set(word.id, el);
                  } else {
                    wordInputRefs.current.delete(word.id);
                  }
                }}
                rowRefCallback={(el) => {
                  if (el) {
                    wordRowRefs.current.set(word.id, el);
                  } else {
                    wordRowRefs.current.delete(word.id);
                  }
                }}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

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
    <Card>
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Upload size={20} />
        Import from CSV
      </h3>

      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-3">
            Upload a CSV file with words (one per line, or columns: word,
            phonetic, voice)
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

export function ListEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNewList = !id;

  // Queries and mutations
  const { data: list, isLoading } = useWordList(id);
  const createList = useCreateWordList();
  const updateList = useUpdateWordList();
  const addWord = useAddWordToList();
  const deleteWord = useDeleteWordFromList();
  const updateWord = useUpdateWord();
  const reorderWords = useReorderWords();
  const uploadAudio = useUploadAudio();
  const bulkDeleteWords = useBulkDeleteWords();

  // Local state
  const [words, setWords] = useState<WordWithIndex[]>([]);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [bulkImportText, setBulkImportText] = useState("");
  const [dragState, setDragState] = useState<DragState>({
    draggedIndex: null,
    dragOverIndex: null,
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [pendingChanges, setPendingChanges] = useState<
    Map<string, Partial<WordWithIndex>>
  >(new Map());

  // CSV Import state
  const [csvData, setCsvData] = useState<
    Array<{ text: string; phonetic?: string; tts_voice?: string }>
  >([]);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Refs for word inputs and rows (for auto-focus and scroll)
  const wordInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const wordRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Bulk selection hook
  const bulkSelection = useBulkSelection(words);

  // Debounced pending changes for auto-save
  const debouncedPendingChanges = useDebounce(pendingChanges, 1000);

  // Form for list metadata
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<ListMetaFormData>({
    resolver: zodResolver(listMetaSchema),
    defaultValues: {
      title: "",
      week_start_date: "",
    },
  });

  // Watch form changes
  const formValues = watch();

  useEffect(() => {
    if (list) {
      reset({
        title: list.title,
        week_start_date: list.week_start_date || "",
      });
      setWords(list.words);
    }
  }, [list, reset]);

  // Detect unsaved changes
  useEffect(() => {
    if (!list) return;

    const metaChanged =
      formValues.title !== list.title ||
      (formValues.week_start_date || "") !== (list.week_start_date || "");

    const wordsChanged = JSON.stringify(words) !== JSON.stringify(list.words);

    setHasUnsavedChanges(metaChanged || wordsChanged);
  }, [formValues, words, list]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        // Modern browsers use preventDefault() to trigger the native prompt.
        // Setting returnValue is only needed for legacy browser compatibility.
        // Feature-detect and set only if necessary.
        if (typeof e.returnValue !== "undefined") {
          e.returnValue = "";
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const onSubmitMeta = async (data: ListMetaFormData) => {
    if (!user?.id) return;

    try {
      if (isNewList) {
        const newList = await createList.mutateAsync({
          title: data.title,
          week_start_date: data.week_start_date || null,
          created_by: user.id,
        });
        toast.custom((t) => (
          <Toast
            type="success"
            message="List created successfully"
            onClose={() => toast.dismiss(t.id)}
          />
        ));
        navigate(`/parent/lists/${newList.id}`, { replace: true });
      } else if (id) {
        await updateList.mutateAsync({
          id,
          updates: {
            title: data.title,
            week_start_date: data.week_start_date || null,
          },
        });
        toast.custom((t) => (
          <Toast
            type="success"
            message="List updated successfully"
            onClose={() => toast.dismiss(t.id)}
          />
        ));
      }
    } catch (error) {
      logger.error("Error saving list:", error);
      toast.custom((t) => (
        <Toast
          type="error"
          message="Failed to save list"
          onClose={() => toast.dismiss(t.id)}
        />
      ));
    }
  };

  const handleAddWord = async () => {
    if (!id) {
      toast.custom((t) => (
        <Toast
          type="error"
          message="Please save the list first"
          onClose={() => toast.dismiss(t.id)}
        />
      ));
      return;
    }

    try {
      const newSortIndex = words.length;
      const result = await addWord.mutateAsync({
        listId: id,
        word: { text: "" },
        sortIndex: newSortIndex,
      });

      // Auto-select the new word
      if (result.word) {
        setSelectedWordId(result.word.id);

        // Turn off selection mode to avoid drag/selection conflicts
        if (isSelectionMode) {
          setIsSelectionMode(false);
          bulkSelection.clearSelection();
        }

        // Scroll to and focus the new word after a brief delay to allow rendering
        setTimeout(() => {
          const rowElement = wordRowRefs.current.get(result.word.id);
          const inputElement = wordInputRefs.current.get(result.word.id);

          if (rowElement) {
            rowElement.scrollIntoView({ behavior: "smooth", block: "center" });
          }

          if (inputElement) {
            inputElement.focus();
          }
        }, 100);
      }

      toast.custom((t) => (
        <Toast
          type="success"
          message="Word added"
          onClose={() => toast.dismiss(t.id)}
        />
      ));
    } catch (error) {
      logger.error("Error adding word:", error);
      toast.custom((t) => (
        <Toast
          type="error"
          message="Failed to add word"
          onClose={() => toast.dismiss(t.id)}
        />
      ));
    }
  };

  const handleDeleteWord = async (wordId: string) => {
    if (!id) return;

    try {
      await deleteWord.mutateAsync({ listId: id, wordId });
      toast.custom((t) => (
        <Toast
          type="success"
          message="Word deleted"
          onClose={() => toast.dismiss(t.id)}
        />
      ));
    } catch (error) {
      logger.error("Error deleting word:", error);
      toast.custom((t) => (
        <Toast
          type="error"
          message="Failed to delete word"
          onClose={() => toast.dismiss(t.id)}
        />
      ));
    }
  };

  const handleUpdateWord = (
    wordId: string,
    field: "text" | "phonetic" | "tts_voice",
    value: string
  ) => {
    // Optimistically update local state
    setWords((prev) =>
      prev.map((w) => (w.id === wordId ? { ...w, [field]: value } : w))
    );

    // Add to pending changes for auto-save
    setPendingChanges((prev) => {
      const updated = new Map(prev);
      const existing = updated.get(wordId) || {};
      updated.set(wordId, { ...existing, [field]: value });
      return updated;
    });

    setAutoSaveStatus("idle");
  };

  // Auto-save effect
  useEffect(() => {
    const savePendingChanges = async () => {
      if (debouncedPendingChanges.size === 0) return;

      // Capture the keys that we're about to save
      const savedIds = new Set(debouncedPendingChanges.keys());

      setAutoSaveStatus("saving");

      try {
        const promises = Array.from(debouncedPendingChanges.entries()).map(
          ([wordId, changes]) => {
            return updateWord.mutateAsync({
              id: wordId,
              updates: changes,
            });
          }
        );

        await Promise.all(promises);
        setAutoSaveStatus("saved");
        setLastSavedAt(new Date());

        // Only clear the keys that were successfully saved
        setPendingChanges((prev) => {
          const filtered = new Map(
            [...prev].filter(([id]) => !savedIds.has(id))
          );
          return filtered;
        });
      } catch (error) {
        setAutoSaveStatus("error");
        logger.error("Auto-save failed", error);
      }
    };

    savePendingChanges();
  }, [debouncedPendingChanges, updateWord]);

  // Retry auto-save handler
  const handleRetryAutoSave = async () => {
    if (pendingChanges.size === 0) return;

    setAutoSaveStatus("saving");

    try {
      const promises = Array.from(pendingChanges.entries()).map(
        ([wordId, changes]) => {
          return updateWord.mutateAsync({
            id: wordId,
            updates: changes,
          });
        }
      );

      await Promise.all(promises);
      setAutoSaveStatus("saved");
      setLastSavedAt(new Date());
      setPendingChanges(new Map());
    } catch (error) {
      setAutoSaveStatus("error");
      logger.error("Auto-save retry failed", error);
    }
  };

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (!id || bulkSelection.selectedCount === 0) return;

    const confirmDelete = confirm(
      `Delete ${bulkSelection.selectedCount} word${bulkSelection.selectedCount !== 1 ? "s" : ""}?`
    );
    if (!confirmDelete) return;

    try {
      await bulkDeleteWords.mutateAsync({
        listId: id,
        wordIds: Array.from(bulkSelection.selectedIds),
      });

      toast.custom((t) => (
        <Toast
          type="success"
          message={`Deleted ${bulkSelection.selectedCount} words`}
          onClose={() => toast.dismiss(t.id)}
        />
      ));
      bulkSelection.clearSelection();
      setIsSelectionMode(false);
    } catch (error) {
      logger.error("Bulk delete failed", {
        context: "ListEditor.bulkDelete",
        error,
      });
      toast.custom((t) => (
        <Toast
          type="error"
          message={`Failed to delete ${bulkSelection.selectedCount} words`}
          onClose={() => toast.dismiss(t.id)}
        />
      ));
    }
  };

  // CSV file selection handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;

      // Use robust CSV parser that handles:
      // - Different line endings (\n, \r\n)
      // - Quoted fields with commas
      // - Empty/whitespace rows
      // - Empty first columns
      // - Header row detection
      const parsed = parseCSV(text);

      // Additional deduplication against existing words
      const existingTexts = new Set(
        words.map((w) => normalizeForDedupe(w.text))
      );

      const uniqueWords = parsed.filter(
        (word) => !existingTexts.has(normalizeForDedupe(word.text))
      );

      setCsvData(uniqueWords);
    };

    reader.readAsText(file);
  };

  // CSV import handler
  const handleCSVImport = async () => {
    if (!id || csvData.length === 0) return;

    try {
      // Deduplicate against existing words
      const existingTexts = new Set(words.map((w) => w.text.toLowerCase()));
      const uniqueWords = csvData.filter(
        (word) => !existingTexts.has(word.text.toLowerCase())
      );

      if (uniqueWords.length === 0) {
        toast.custom((t) => (
          <Toast
            type="error"
            message="All words already exist in this list"
            onClose={() => toast.dismiss(t.id)}
          />
        ));
        return;
      }

      // Import words sequentially with progress
      setImportProgress({ current: 0, total: uniqueWords.length });

      for (let i = 0; i < uniqueWords.length; i++) {
        const sortIndex = words.length + i;
        await addWord.mutateAsync({
          listId: id,
          word: {
            text: uniqueWords[i].text,
            phonetic: uniqueWords[i].phonetic || null,
            tts_voice: uniqueWords[i].tts_voice || null,
          },
          sortIndex,
        });
        setImportProgress({ current: i + 1, total: uniqueWords.length });
      }

      toast.custom((t) => (
        <Toast
          type="success"
          message={`Imported ${uniqueWords.length} words`}
          onClose={() => toast.dismiss(t.id)}
        />
      ));
      setCsvData([]);
      setImportProgress(null);

      // Reset file input
      const fileInput = document.getElementById(
        "csv-file-input"
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (error) {
      logger.error("CSV import failed", {
        context: "ListEditor.csvImport",
        error,
      });
      toast.custom((t) => (
        <Toast
          type="error"
          message="Failed to import CSV"
          onClose={() => toast.dismiss(t.id)}
        />
      ));
      setImportProgress(null);
    }
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: "Escape",
        callback: () => {
          if (isSelectionMode) {
            bulkSelection.clearSelection();
            setIsSelectionMode(false);
          }
        },
        description: "Clear selection",
      },
      {
        key: "a",
        ctrlKey: true,
        callback: () => {
          if (!isNewList && words.length > 0) {
            setIsSelectionMode(true);
            bulkSelection.selectAll();
          }
        },
        description: "Select all words (Ctrl+A)",
      },
      {
        key: "a",
        metaKey: true,
        callback: () => {
          if (!isNewList && words.length > 0) {
            setIsSelectionMode(true);
            bulkSelection.selectAll();
          }
        },
        description: "Select all words (Cmd+A)",
      },
      {
        key: "Delete",
        callback: () => {
          if (isSelectionMode && bulkSelection.selectedCount > 0) {
            handleBulkDelete();
          }
        },
        description: "Delete selected words",
      },
    ],
    enabled: !isNewList,
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddWord();
    }
  };

  const handleDragStart = (index: number) => {
    setDragState({ draggedIndex: index, dragOverIndex: null });
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragState((prev) => ({ ...prev, dragOverIndex: index }));
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    const { draggedIndex } = dragState;
    if (draggedIndex === null || draggedIndex === dropIndex || !id) return;

    // Reorder locally
    const newWords = [...words];
    const [draggedWord] = newWords.splice(draggedIndex, 1);
    newWords.splice(dropIndex, 0, draggedWord);

    // Update sort indices
    const updatedWords = newWords.map((word, idx) => ({
      ...word,
      sort_index: idx,
    }));

    setWords(updatedWords);

    // Save to database
    try {
      await reorderWords.mutateAsync({
        listId: id,
        updates: updatedWords.map((w) => ({
          word_id: w.id,
          sort_index: w.sort_index,
        })),
      });
    } catch (error) {
      logger.error("Error reordering words:", error);
      toast.custom((t) => (
        <Toast
          type="error"
          message="Failed to reorder words"
          onClose={() => toast.dismiss(t.id)}
        />
      ));
    }

    setDragState({ draggedIndex: null, dragOverIndex: null });
  };

  const handleDragEnd = () => {
    setDragState({ draggedIndex: null, dragOverIndex: null });
  };

  const handleBulkImport = async () => {
    if (!id || !bulkImportText.trim()) return;

    const lines = bulkImportText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);

    // Deduplicate
    const existingWords = new Set(words.map((w) => w.text.toLowerCase()));
    const newWords = lines.filter(
      (line) => !existingWords.has(line.toLowerCase())
    );

    if (newWords.length === 0) {
      toast.custom((t) => (
        <Toast
          type="error"
          message="All words already exist in the list"
          onClose={() => toast.dismiss(t.id)}
        />
      ));
      return;
    }

    try {
      let sortIndex = words.length;
      for (const text of newWords) {
        await addWord.mutateAsync({
          listId: id,
          word: { text },
          sortIndex: sortIndex++,
        });
      }
      toast.custom((t) => (
        <Toast
          type="success"
          message={`Added ${newWords.length} word(s)`}
          onClose={() => toast.dismiss(t.id)}
        />
      ));
      setBulkImportText("");
    } catch (error) {
      logger.error("Error bulk importing:", error);
      toast.custom((t) => (
        <Toast
          type="error"
          message="Failed to import words"
          onClose={() => toast.dismiss(t.id)}
        />
      ));
    }
  };

  const handleUploadAudio = async (wordId: string, file: File) => {
    if (!id) return;

    try {
      await uploadAudio.mutateAsync({
        file,
        listId: id,
        wordId,
      });
      toast.custom((t) => (
        <Toast
          type="success"
          message="Audio uploaded successfully"
          onClose={() => toast.dismiss(t.id)}
        />
      ));
    } catch (error) {
      logger.error("Error uploading audio:", error);
      toast.custom((t) => (
        <Toast
          type="error"
          message="Failed to upload audio"
          onClose={() => toast.dismiss(t.id)}
        />
      ));
    }
  };

  const handlePlayAudio = (url: string) => {
    const audio = new Audio(url);
    audio.play().catch((error) => {
      logger.error("Error playing audio:", error);
      toast.custom((t) => (
        <Toast
          type="error"
          message="Failed to play audio"
          onClose={() => toast.dismiss(t.id)}
        />
      ));
    });
  };

  if (isLoading) {
    return (
      <AppShell title="Loading..." variant="parent">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading list...</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={isNewList ? "New List" : list?.title || "Edit List"}
      variant="parent"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Auto-save Indicator */}
        {!isNewList && (
          <div className="flex justify-end">
            <AutoSaveIndicator
              status={autoSaveStatus}
              lastSavedAt={lastSavedAt || undefined}
              onRetry={handleRetryAutoSave}
            />
          </div>
        )}

        {/* List Statistics */}
        {!isNewList && list && (
          <ListStatistics
            totalWords={words.length}
            wordsWithAudio={words.filter((w) => w.prompt_audio_url).length}
            wordsWithPhonetics={words.filter((w) => w.phonetic).length}
            lastModified={list.updated_at || undefined}
            createdAt={list.created_at || undefined}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
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
          />

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
            handleUploadAudio={handleUploadAudio}
            handleDeleteWord={handleDeleteWord}
            deleteWordPending={deleteWord.isPending}
            showAdvancedOptions={showAdvancedOptions}
            onToggleAdvancedOptions={() =>
              setShowAdvancedOptions(!showAdvancedOptions)
            }
            isSelectionMode={isSelectionMode}
            onToggleSelectionMode={() => setIsSelectionMode(!isSelectionMode)}
            bulkSelection={bulkSelection}
            onBulkDelete={handleBulkDelete}
            isBulkDeleting={bulkDeleteWords.isPending}
            wordInputRefs={wordInputRefs}
            wordRowRefs={wordRowRefs}
          />

          <div className="lg:col-span-3 space-y-6">
            {!isNewList && (
              <CSVImportSection
                listId={id}
                onFileSelect={handleFileSelect}
                csvData={csvData}
                onImportComplete={handleCSVImport}
                importProgress={importProgress}
                addWordPending={addWord.isPending}
              />
            )}
          </div>
        </div>

        {/* Keyboard shortcuts help */}
        {!isNewList && words.length > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            Keyboard shortcuts:{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-muted border">Esc</kbd>{" "}
            clear,
            <kbd className="px-1.5 py-0.5 rounded bg-muted border ml-2">
              Ctrl+A / Cmd+A
            </kbd>{" "}
            select all,
            <kbd className="px-1.5 py-0.5 rounded bg-muted border ml-2">
              Delete
            </kbd>{" "}
            remove selected
          </p>
        )}
      </div>
    </AppShell>
  );
}
