import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import { Plus, Trash2, Save } from "lucide-react";
import { useAuth } from "@/app/hooks/useAuth";
import { supabase } from "@/app/supabase";

const listSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  words: z
    .array(
      z.object({
        word: z.string().min(1, "Word is required"),
      })
    )
    .min(1, "At least one word is required"),
});

type ListFormData = z.infer<typeof listSchema>;

export function ListEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ListFormData>({
    resolver: zodResolver(listSchema),
    defaultValues: {
      title: "",
      description: "",
      words: [{ word: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "words",
  });

  const onSubmit = async (data: ListFormData) => {
    if (!user) return;

    setIsSaving(true);
    setError(null);

    try {
      // Create the list
      const { data: listData, error: listError } = await supabase
        .from("spelling_lists")
        .insert({
          parent_id: user.id,
          title: data.title,
          description: data.description || null,
        })
        .select()
        .single();

      if (listError) throw listError;

      // Add words to the list
      const wordsToInsert = data.words.map((word, index) => ({
        list_id: listData.id,
        word: word.word,
        order: index,
      }));

      const { error: wordsError } = await supabase
        .from("words")
        .insert(wordsToInsert);

      if (wordsError) throw wordsError;

      navigate("/parent/lists");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save list");
      console.error("Error saving list:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell title={id ? "Edit List" : "New List"} variant="parent">
      <div className="max-w-3xl mx-auto">
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                List Title *
              </label>
              <input
                {...register("title")}
                type="text"
                id="title"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Week 1 - Long vowels"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.title.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Description
              </label>
              <textarea
                {...register("description")}
                id="description"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Optional description..."
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label
                  htmlFor="words-section"
                  className="block text-sm font-medium text-gray-700"
                >
                  Words *
                </label>
                <Button
                  type="button"
                  onClick={() => append({ word: "" })}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Plus size={16} />
                  Add Word
                </Button>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-2">
                    <div className="flex-1">
                      <input
                        {...register(`words.${index}.word`)}
                        type="text"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder={`Word ${index + 1}`}
                      />
                      {errors.words?.[index]?.word && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors.words[index]?.word?.message}
                        </p>
                      )}
                    </div>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => remove(index)}
                        size="sm"
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {errors.words && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.words.message}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                className="flex items-center gap-2"
                disabled={isSaving}
              >
                <Save size={20} />
                {isSaving ? "Saving..." : "Save List"}
              </Button>
              <Button
                type="button"
                onClick={() => navigate("/parent/lists")}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
