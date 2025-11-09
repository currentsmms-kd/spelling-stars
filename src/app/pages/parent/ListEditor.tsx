import { useState, useEffect } from "react";
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
import { AudioRecorder } from "@/app/components/AudioRecorder";
import {
  Plus,
  Trash2,
  Save,
  GripVertical,
  Play,
  Upload,
  Check,
} from "lucide-react";
import { useAuth } from "@/app/hooks/useAuth";
import {
  useWordList,
  useCreateWordList,
  useUpdateWordList,
  useAddWordToList,
  useDeleteWordFromList,
  useUpdateWord,
  useReorderWords,
  useUploadAudio,
  type WordWithIndex,
} from "@/app/api/supa";

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
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onSelect: () => void;
  onUpdateWord: (
    wordId: string,
    field: "text" | "phonetic" | "tts_voice",
    value: string
  ) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPlayAudio: (url: string) => void;
  onDelete: (wordId: string) => void;
  isDeleting: boolean;
}

function WordRow({
  word,
  index,
  isSelected,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onSelect,
  onUpdateWord,
  onKeyDown,
  onPlayAudio,
  onDelete,
  isDeleting,
}: WordRowProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${
        isSelected
          ? "border-primary-500 bg-primary-50"
          : "border-gray-300 hover:border-gray-400"
      } ${isDragOver ? "border-primary-500 border-dashed" : ""} cursor-move`}
      onClick={onSelect}
    >
      <GripVertical size={20} className="text-gray-400 flex-shrink-0" />
      <div className="w-12 text-gray-500 text-sm flex-shrink-0">
        #{index + 1}
      </div>
      <input
        type="text"
        value={word.text}
        onChange={(e) => onUpdateWord(word.id, "text", e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Word"
        className="flex-1 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        onClick={(e) => e.stopPropagation()}
      />
      <input
        type="text"
        value={word.phonetic || ""}
        onChange={(e) => onUpdateWord(word.id, "phonetic", e.target.value)}
        placeholder="Phonetic (optional)"
        className="flex-1 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        onClick={(e) => e.stopPropagation()}
      />
      <select
        value={word.tts_voice || ""}
        onChange={(e) => onUpdateWord(word.id, "tts_voice", e.target.value)}
        className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        onClick={(e) => e.stopPropagation()}
        title="Text-to-Speech Voice"
      >
        <option value="">Default</option>
        <option value="en-US">US English</option>
        <option value="en-GB">UK English</option>
        <option value="en-AU">Australian</option>
        <option value="en-IN">Indian</option>
      </select>
      {word.prompt_audio_url && (
        <Button
          size="sm"
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
      )}
      <Button
        size="sm"
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
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Title *
        </label>
        <input
          {...register("title")}
          type="text"
          id="title"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="Week 1"
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="week_start_date"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Week Start Date
        </label>
        <input
          {...register("week_start_date")}
          type="date"
          id="week_start_date"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
        <p className="text-sm text-amber-600">You have unsaved changes</p>
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-3"
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
  handleDeleteWord,
  deleteWordPending,
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
  handleDeleteWord: (wordId: string) => void;
  deleteWordPending: boolean;
}) {
  return (
    <div className="lg:col-span-6">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Words ({words.length})</h3>
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

        {isNewList ? (
          <p className="text-gray-600 text-center py-8">
            Save the list first to add words
          </p>
        ) : words.length === 0 ? (
          <p className="text-gray-600 text-center py-8">
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
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                onSelect={() => setSelectedWordId(word.id)}
                onUpdateWord={handleUpdateWord}
                onKeyDown={handleKeyDown}
                onPlayAudio={handlePlayAudio}
                onDelete={handleDeleteWord}
                isDeleting={deleteWordPending}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function AudioRecorderSection({
  selectedWord,
  handleAudioRecorded,
  uploadingAudio,
  handlePlayAudio,
}: {
  selectedWord: WordWithIndex | undefined;
  handleAudioRecorded: (blob: Blob) => void;
  uploadingAudio: boolean;
  handlePlayAudio: (url: string) => void;
}) {
  return (
    <div className="lg:col-span-3">
      <Card>
        <h3 className="text-lg font-semibold mb-4">Audio Recorder</h3>
        {selectedWord ? (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Selected word:</p>
              <p className="font-semibold text-lg">{selectedWord.text}</p>
              {selectedWord.phonetic && (
                <p className="text-sm text-gray-500 mt-1">
                  {selectedWord.phonetic}
                </p>
              )}
            </div>
            <AudioRecorder onRecordingComplete={handleAudioRecorded} />
            {uploadingAudio && (
              <p className="text-sm text-gray-600">Uploading...</p>
            )}
            {selectedWord.prompt_audio_url && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 mb-2">✓ Audio saved</p>
                <Button
                  size="sm"
                  onClick={() => {
                    if (selectedWord.prompt_audio_url) {
                      handlePlayAudio(selectedWord.prompt_audio_url);
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <Play size={16} />
                  Play Current
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-600 text-center py-8">
            Select a word to record audio
          </p>
        )}
      </Card>
    </div>
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

  // Local state
  const [words, setWords] = useState<WordWithIndex[]>([]);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [bulkImportText, setBulkImportText] = useState("");
  const [dragState, setDragState] = useState<DragState>({
    draggedIndex: null,
    dragOverIndex: null,
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const showToast = (type: "success" | "error", message: string) => {
    setToastMessage({ type, message });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const onSubmitMeta = async (data: ListMetaFormData) => {
    if (!user?.id) return;

    try {
      if (isNewList) {
        const newList = await createList.mutateAsync({
          title: data.title,
          week_start_date: data.week_start_date || null,
          created_by: user.id,
        });
        showToast("success", "List created successfully");
        navigate(`/parent/lists/${newList.id}`, { replace: true });
      } else if (id) {
        await updateList.mutateAsync({
          id,
          updates: {
            title: data.title,
            week_start_date: data.week_start_date || null,
          },
        });
        showToast("success", "List updated successfully");
      }
    } catch (error) {
      console.error("Error saving list:", error);
      showToast("error", "Failed to save list");
    }
  };

  const handleAddWord = async () => {
    if (!id) {
      showToast("error", "Please save the list first");
      return;
    }

    try {
      const newSortIndex = words.length;
      await addWord.mutateAsync({
        listId: id,
        word: { text: "" },
        sortIndex: newSortIndex,
      });
      showToast("success", "Word added");
    } catch (error) {
      console.error("Error adding word:", error);
      showToast("error", "Failed to add word");
    }
  };

  const handleDeleteWord = async (wordId: string) => {
    if (!id) return;

    try {
      await deleteWord.mutateAsync({ listId: id, wordId });
      showToast("success", "Word deleted");
    } catch (error) {
      console.error("Error deleting word:", error);
      showToast("error", "Failed to delete word");
    }
  };

  const handleUpdateWord = async (
    wordId: string,
    field: "text" | "phonetic" | "tts_voice",
    value: string
  ) => {
    try {
      await updateWord.mutateAsync({
        id: wordId,
        updates: { [field]: value },
      });
    } catch (error) {
      console.error("Error updating word:", error);
      showToast("error", "Failed to update word");
    }
  };

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
      console.error("Error reordering words:", error);
      showToast("error", "Failed to reorder words");
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
      showToast("error", "All words already exist in the list");
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
      showToast("success", `Added ${newWords.length} word(s)`);
      setBulkImportText("");
    } catch (error) {
      console.error("Error bulk importing:", error);
      showToast("error", "Failed to import words");
    }
  };

  const handleAudioRecorded = async (blob: Blob) => {
    if (!selectedWordId || !id) return;

    setUploadingAudio(true);
    try {
      await uploadAudio.mutateAsync({
        file: blob,
        listId: id,
        wordId: selectedWordId,
      });
      showToast("success", "Audio uploaded successfully");
    } catch (error) {
      console.error("Error uploading audio:", error);
      showToast("error", "Failed to upload audio");
    } finally {
      setUploadingAudio(false);
    }
  };

  const handlePlayAudio = (url: string) => {
    const audio = new Audio(url);
    audio.play().catch((error) => {
      console.error("Error playing audio:", error);
      showToast("error", "Failed to play audio");
    });
  };

  const selectedWord = words.find((w) => w.id === selectedWordId);

  if (isLoading) {
    return (
      <AppShell title="Loading..." variant="parent">
        <div className="text-center py-12">
          <p className="text-gray-600">Loading list...</p>
        </div>
      </AppShell>
    );
  }

  const toastNotification = toastMessage && (
    <div
      className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
        toastMessage.type === "success"
          ? "bg-green-500 text-white"
          : "bg-red-500 text-white"
      }`}
    >
      <div className="flex items-center gap-2">
        {toastMessage.type === "success" && <Check size={20} />}
        <span>{toastMessage.message}</span>
      </div>
    </div>
  );

  return (
    <AppShell
      title={isNewList ? "New List" : list?.title || "Edit List"}
      variant="parent"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {toastNotification}

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
            handleDeleteWord={handleDeleteWord}
            deleteWordPending={deleteWord.isPending}
          />

          <AudioRecorderSection
            selectedWord={selectedWord}
            handleAudioRecorded={handleAudioRecorded}
            uploadingAudio={uploadingAudio}
            handlePlayAudio={handlePlayAudio}
          />
        </div>
      </div>
    </AppShell>
  );
}
