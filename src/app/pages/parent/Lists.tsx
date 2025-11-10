import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import { Link } from "react-router-dom";
import { Plus, Edit, Copy, Trash2, Search } from "lucide-react";
import { useAuth } from "@/app/hooks/useAuth";
import {
  useWordLists,
  useDeleteWordList,
  useDuplicateWordList,
} from "@/app/api/supa";
import { useState } from "react";
import { logger } from "@/lib/logger";

type SortField = "title" | "week_start_date" | "word_count" | "created_at";
type SortOrder = "asc" | "desc";

interface WordListItem {
  id: string;
  title: string;
  week_start_date: string | null;
  word_count?: number;
  created_at: string | null;
}

interface TableHeaderProps {
  field: SortField;
  label: string;
  currentSortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
}

interface ListRowActionsProps {
  listId: string;
  deleteConfirm: string | null;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteConfirm: (id: string | null) => void;
  isDuplicating: boolean;
  isDeleting: boolean;
}

interface ListTableRowProps {
  list: WordListItem;
  deleteConfirm: string | null;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteConfirm: (id: string | null) => void;
  isDuplicating: boolean;
  isDeleting: boolean;
  formatDate: (dateString: string | null) => string;
}

interface ListsTableProps {
  lists: WordListItem[];
  sortField: SortField;
  sortOrder: SortOrder;
  deleteConfirm: string | null;
  onSort: (field: SortField) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteConfirm: (id: string | null) => void;
  isDuplicating: boolean;
  isDeleting: boolean;
  formatDate: (dateString: string | null) => string;
}

interface TableBodyProps {
  lists: WordListItem[];
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
  isLoading: boolean;
  filteredLists: WordListItem[] | undefined;
  sortField: SortField;
  sortOrder: SortOrder;
  deleteConfirm: string | null;
  handleSort: (field: SortField) => void;
  handleDuplicate: (id: string) => void;
  handleDelete: (id: string) => void;
  setDeleteConfirm: (id: string | null) => void;
  isDuplicating: boolean;
  isDeleting: boolean;
  formatDate: (dateString: string | null) => string;
}

function ListsHeader() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold">Word Lists</h2>
        <p className="text-muted-foreground">
          Create and manage spelling word lists
        </p>
      </div>
      <Link to="/parent/lists/new">
        <Button className="flex items-center gap-2">
          <Plus size={20} />
          New List
        </Button>
      </Link>
    </div>
  );
}

function TableHeader({
  field,
  label,
  currentSortField,
  sortOrder,
  onSort,
}: TableHeaderProps) {
  return (
    <th
      className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-2">
        {label}
        {currentSortField === field && (
          <span>{sortOrder === "asc" ? "↑" : "↓"}</span>
        )}
      </div>
    </th>
  );
}

function ListRowActions({
  listId,
  deleteConfirm,
  onDuplicate,
  onDelete,
  onDeleteConfirm,
  isDuplicating,
  isDeleting,
}: ListRowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Link to={`/parent/lists/${listId}`}>
        <Button size="sm" title="Edit">
          <Edit size={16} />
        </Button>
      </Link>
      <Button
        size="sm"
        onClick={() => onDuplicate(listId)}
        disabled={isDuplicating}
        title="Duplicate"
      >
        <Copy size={16} />
      </Button>
      {deleteConfirm === listId ? (
        <>
          <Button
            size="sm"
            onClick={() => onDelete(listId)}
            disabled={isDeleting}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            Confirm
          </Button>
          <Button size="sm" onClick={() => onDeleteConfirm(null)}>
            Cancel
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          onClick={() => onDeleteConfirm(listId)}
          title="Delete"
        >
          <Trash2 size={16} />
        </Button>
      )}
    </div>
  );
}

function ListTableRow({
  list,
  deleteConfirm,
  onDuplicate,
  onDelete,
  onDeleteConfirm,
  isDuplicating,
  isDeleting,
  formatDate,
}: ListTableRowProps) {
  return (
    <tr key={list.id} className="hover:bg-muted/50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium">{list.title}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-muted-foreground">
          {formatDate(list.week_start_date)}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-muted-foreground">
          {list.word_count || 0}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-muted-foreground">
          {formatDate(list.created_at)}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <ListRowActions
          listId={list.id}
          deleteConfirm={deleteConfirm}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onDeleteConfirm={onDeleteConfirm}
          isDuplicating={isDuplicating}
          isDeleting={isDeleting}
        />
      </td>
    </tr>
  );
}

function TableBody({
  lists,
  deleteConfirm,
  onDuplicate,
  onDelete,
  onDeleteConfirm,
  isDuplicating,
  isDeleting,
  formatDate,
}: TableBodyProps) {
  return (
    <tbody className="bg-card divide-y">
      {lists.map((list) => (
        <ListTableRow
          key={list.id}
          list={list}
          deleteConfirm={deleteConfirm}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onDeleteConfirm={onDeleteConfirm}
          isDuplicating={isDuplicating}
          isDeleting={isDeleting}
          formatDate={formatDate}
        />
      ))}
    </tbody>
  );
}

function ListsTable({
  lists,
  sortField,
  sortOrder,
  deleteConfirm,
  onSort,
  onDuplicate,
  onDelete,
  onDeleteConfirm,
  isDuplicating,
  isDeleting,
  formatDate,
}: ListsTableProps) {
  return (
    <table className="w-full">
      <thead className="bg-muted/50 border-b">
        <tr>
          <TableHeader
            field="title"
            label="Title"
            currentSortField={sortField}
            sortOrder={sortOrder}
            onSort={onSort}
          />
          <TableHeader
            field="week_start_date"
            label="Week Start"
            currentSortField={sortField}
            sortOrder={sortOrder}
            onSort={onSort}
          />
          <TableHeader
            field="word_count"
            label="Words"
            currentSortField={sortField}
            sortOrder={sortOrder}
            onSort={onSort}
          />
          <TableHeader
            field="created_at"
            label="Created"
            currentSortField={sortField}
            sortOrder={sortOrder}
            onSort={onSort}
          />
          <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Actions
          </th>
        </tr>
      </thead>
      <TableBody
        lists={lists}
        deleteConfirm={deleteConfirm}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onDeleteConfirm={onDeleteConfirm}
        isDuplicating={isDuplicating}
        isDeleting={isDeleting}
        formatDate={formatDate}
      />
    </table>
  );
}

function ListsContent({
  searchTerm,
  setSearchTerm,
  isLoading,
  filteredLists,
  sortField,
  sortOrder,
  deleteConfirm,
  handleSort,
  handleDuplicate,
  handleDelete,
  setDeleteConfirm,
  isDuplicating,
  isDeleting,
  formatDate,
}: ListsContentProps) {
  return (
    <>
      {/* Search and filters */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={20}
            />
            <input
              type="text"
              placeholder="Search lists..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input"
            />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading lists...</p>
        </div>
      ) : filteredLists && filteredLists.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <ListsTable
              lists={filteredLists}
              sortField={sortField}
              sortOrder={sortOrder}
              deleteConfirm={deleteConfirm}
              onSort={handleSort}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onDeleteConfirm={setDeleteConfirm}
              isDuplicating={isDuplicating}
              isDeleting={isDeleting}
              formatDate={formatDate}
            />
          </div>
        </Card>
      ) : (
        <Card>
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              {searchTerm ? "No lists found" : "No spelling lists yet"}
            </p>
            {!searchTerm && (
              <Link to="/parent/lists/new">
                <Button>Create Your First List</Button>
              </Link>
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
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: lists, isLoading } = useWordLists(user?.id);
  const deleteList = useDeleteWordList();
  const duplicateList = useDuplicateWordList();

  // Filter and sort lists
  const filteredLists = lists
    ?.filter((list) =>
      list.title.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aVal: string | number | null | undefined = a[sortField];
      let bVal: string | number | null | undefined = b[sortField];

      // Handle null/undefined values
      if (aVal === null || aVal === undefined) aVal = "";
      if (bVal === null || bVal === undefined) bVal = "";

      if (sortOrder === "asc") {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleDelete = async (id: string) => {
    if (!user?.id) return;
    try {
      await deleteList.mutateAsync({ id, userId: user.id });
      setDeleteConfirm(null);
    } catch (error) {
      logger.error("Error deleting list:", error);
      // TODO: Replace with toast notification
      logger.error("Failed to delete list. Please try again.");
    }
  };

  const handleDuplicate = async (id: string) => {
    if (!user?.id) return;
    try {
      await duplicateList.mutateAsync({ listId: id, userId: user.id });
    } catch (error) {
      logger.error("Error duplicating list:", error);
      // TODO: Replace with toast notification
      logger.error("Failed to duplicate list. Please try again.");
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
          isLoading={isLoading}
          filteredLists={filteredLists}
          sortField={sortField}
          sortOrder={sortOrder}
          deleteConfirm={deleteConfirm}
          handleSort={handleSort}
          handleDuplicate={handleDuplicate}
          handleDelete={handleDelete}
          setDeleteConfirm={setDeleteConfirm}
          isDuplicating={duplicateList.isPending}
          isDeleting={deleteList.isPending}
          formatDate={formatDate}
        />
      </div>
    </AppShell>
  );
}
