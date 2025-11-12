import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import { buttonVariants } from "@/app/components/buttonVariants";
import { Link } from "react-router-dom";
import { Plus, Edit, Copy, Trash2, Search, List, Calendar } from "lucide-react";
import { useAuth } from "@/app/hooks/useAuth";
import {
  useWordLists,
  useDeleteWordList,
  useDuplicateWordList,
} from "@/app/api/supa";
import { useState, useCallback, useMemo } from "react";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

type SortField = "title" | "week_start_date" | "word_count" | "created_at";
type SortOrder = "asc" | "desc";

interface WordListItem {
  id: string;
  title: string;
  week_start_date: string | null;
  word_count?: number;
  created_at: string | null;
}

interface ListCardProps {
  list: WordListItem;
  deleteConfirm: string | null;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteConfirm: (id: string | null) => void;
  isDuplicating: boolean;
  isDeleting: boolean;
  formatDate: (dateString: string | null) => string;
}

interface ListsContentProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  sortOption: string;
  setSortOption: (value: string) => void;
  isLoading: boolean;
  filteredLists: WordListItem[] | undefined;
  deleteConfirm: string | null;
  handleDuplicate: (id: string) => void;
  handleDelete: (id: string) => void;
  setDeleteConfirm: (id: string | null) => void;
  duplicatingId: string | null;
  deletingId: string | null;
  formatDate: (dateString: string | null) => string;
}

function ListCard({
  list,
  deleteConfirm,
  onDuplicate,
  onDelete,
  onDeleteConfirm,
  isDuplicating,
  isDeleting,
  formatDate,
}: ListCardProps) {
  const handleDuplicate = useCallback(() => {
    onDuplicate(list.id);
  }, [list.id, onDuplicate]);

  const handleDeleteRequest = useCallback(() => {
    onDeleteConfirm(list.id);
  }, [list.id, onDeleteConfirm]);

  const handleDeleteConfirm = useCallback(() => {
    onDelete(list.id);
  }, [list.id, onDelete]);

  const handleDeleteCancel = useCallback(() => {
    onDeleteConfirm(null);
  }, [onDeleteConfirm]);

  return (
    <Card variant="parent" className="hover:border-primary transition-colors">
      <div className="space-y-4">
        {/* Header - List Title */}
        <Link to={`/parent/lists/${list.id}`} className="block group">
          <h3 className="text-xl font-bold group-hover:text-primary transition-colors">
            {list.title}
          </h3>
        </Link>

        {/* Metadata Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <List size={16} />
            <span>{list.word_count || 0} words</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar size={16} />
            <span>
              Week Start:{" "}
              {list.week_start_date ? formatDate(list.week_start_date) : "—"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar size={16} />
            <span>Created: {formatDate(list.created_at)}</span>
          </div>
        </div>

        {/* Footer - Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
          {deleteConfirm === list.id ? (
            <>
              <Button
                size="sm"
                variant="danger"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex items-center gap-2"
              >
                <Trash2 size={16} />
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleDeleteCancel}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Link
                to={`/parent/lists/${list.id}`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "flex items-center gap-2"
                )}
              >
                <Edit size={16} />
                Edit
              </Link>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDuplicate}
                disabled={isDuplicating}
                className="flex items-center gap-2"
              >
                <Copy size={16} />
                {isDuplicating ? "Duplicating..." : "Duplicate"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDeleteRequest}
                className="flex items-center gap-2"
              >
                <Trash2 size={16} />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function ListsHeader() {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold">Word Lists</h2>
        <p className="text-muted-foreground">
          Create and manage spelling word lists for your child
        </p>
      </div>
      <Link
        to="/parent/lists/new"
        className={cn(
          buttonVariants({ size: "default" }),
          "flex items-center gap-2"
        )}
      >
        <Plus size={20} />
        New List
      </Link>
    </div>
  );
}

function ListsContent({
  searchTerm,
  setSearchTerm,
  sortOption,
  setSortOption,
  isLoading,
  filteredLists,
  deleteConfirm,
  handleDuplicate,
  handleDelete,
  setDeleteConfirm,
  duplicatingId,
  deletingId,
  formatDate,
}: ListsContentProps) {
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(e.target.value);
    },
    [setSearchTerm]
  );

  const handleSortChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSortOption(e.target.value);
    },
    [setSortOption]
  );

  return (
    <>
      {/* Search and Sort Section */}
      <Card className="mb-6">
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Find a List</h3>
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={24}
              />
              <input
                type="text"
                placeholder="Search by list title..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full pl-12 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="flex flex-col gap-2 md:w-64">
              <label htmlFor="sort-select" className="text-sm font-medium">
                Sort By
              </label>
              <select
                id="sort-select"
                value={sortOption}
                onChange={handleSortChange}
                className="px-4 py-3 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input"
              >
                <option value="created_at-desc">Newest First</option>
                <option value="created_at-asc">Oldest First</option>
                <option value="title-asc">Title A-Z</option>
                <option value="title-desc">Title Z-A</option>
                <option value="word_count-desc">Most Words</option>
                <option value="word_count-asc">Fewest Words</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Loading State */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading lists...</p>
        </div>
      ) : filteredLists?.length ? (
        /* Card Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLists.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              deleteConfirm={deleteConfirm}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onDeleteConfirm={setDeleteConfirm}
              isDuplicating={list.id === duplicatingId}
              isDeleting={list.id === deletingId}
              formatDate={formatDate}
            />
          ))}
        </div>
      ) : (
        /* Enhanced Empty State */
        <Card>
          <div className="text-center py-16 space-y-4">
            <List size={48} className="mx-auto text-muted-foreground" />
            {searchTerm ? (
              <>
                <h3 className="text-xl font-bold">
                  No lists match your search
                </h3>
                <p className="text-muted-foreground">
                  Try a different search term
                </p>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold">
                  Get Started with Spelling Lists
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Create your first spelling list to start tracking your child's
                  progress. You can add words manually or record audio
                  pronunciations.
                </p>
                <Link
                  to="/parent/lists/new"
                  className={cn(
                    buttonVariants({ size: "default" }),
                    "flex items-center gap-2 mx-auto"
                  )}
                >
                  <Plus size={20} />
                  Create Your First List
                </Link>
              </>
            )}
          </div>
        </Card>
      )}
    </>
  );
}

export function Lists() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState("created_at-desc");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: lists, isLoading } = useWordLists(user?.id);
  const deleteList = useDeleteWordList();
  const duplicateList = useDuplicateWordList();

  // Parse sort option
  const [sortField, sortOrder] = useMemo(() => {
    const [field, order] = sortOption.split("-") as [SortField, SortOrder];
    return [field, order];
  }, [sortOption]);

  // Filter and sort lists
  const filteredLists = useMemo(() => {
    return lists
      ?.filter((list) =>
        list.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        let aVal: string | number = "";
        let bVal: string | number = "";

        // Get values based on sort field
        switch (sortField) {
          case "title":
            aVal = a.title || "";
            bVal = b.title || "";
            break;
          case "week_start_date":
            // Convert to timestamp for robust date comparison
            aVal = a.week_start_date
              ? new Date(a.week_start_date).getTime()
              : 0;
            bVal = b.week_start_date
              ? new Date(b.week_start_date).getTime()
              : 0;
            break;
          case "word_count":
            aVal = a.word_count || 0;
            bVal = b.word_count || 0;
            break;
          case "created_at":
            // Convert to timestamp for robust date comparison
            aVal = a.created_at ? new Date(a.created_at).getTime() : 0;
            bVal = b.created_at ? new Date(b.created_at).getTime() : 0;
            break;
        }

        if (sortOrder === "asc") {
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
      });
  }, [lists, searchTerm, sortField, sortOrder]);

  const handleDelete = async (id: string) => {
    if (!user?.id) return;
    setDeletingId(id);
    try {
      await deleteList.mutateAsync({ id, userId: user.id });
      setDeleteConfirm(null);
    } catch (error) {
      logger.error("Error deleting list:", error);
      // TODO: Replace with toast notification
      logger.error("Failed to delete list. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    if (!user?.id) return;
    setDuplicatingId(id);
    try {
      await duplicateList.mutateAsync({ listId: id, userId: user.id });
    } catch (error) {
      logger.error("Error duplicating list:", error);
      // TODO: Replace with toast notification
      logger.error("Failed to duplicate list. Please try again.");
    } finally {
      setDuplicatingId(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <AppShell title="Spelling Lists" variant="parent">
      <div className="max-w-6xl mx-auto space-y-6">
        <ListsHeader />

        <ListsContent
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          sortOption={sortOption}
          setSortOption={setSortOption}
          isLoading={isLoading}
          filteredLists={filteredLists}
          deleteConfirm={deleteConfirm}
          handleDuplicate={handleDuplicate}
          handleDelete={handleDelete}
          setDeleteConfirm={setDeleteConfirm}
          duplicatingId={duplicatingId}
          deletingId={deletingId}
          formatDate={formatDate}
        />
      </div>
    </AppShell>
  );
}
