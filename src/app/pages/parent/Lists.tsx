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

type SortField = "title" | "week_start_date" | "word_count" | "created_at";
type SortOrder = "asc" | "desc";

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
      console.error("Error deleting list:", error);
      // TODO: Replace with toast notification
      console.error("Failed to delete list. Please try again.");
    }
  };

  const handleDuplicate = async (id: string) => {
    if (!user?.id) return;
    try {
      await duplicateList.mutateAsync({ listId: id, userId: user.id });
    } catch (error) {
      console.error("Error duplicating list:", error);
      // TODO: Replace with toast notification
      console.error("Failed to duplicate list. Please try again.");
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <AppShell title="Spelling Lists" variant="parent">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Word Lists</h2>
            <p className="text-gray-600">
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

        {/* Search and filters */}
        <Card>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                placeholder="Search lists..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        </Card>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading lists...</p>
          </div>
        ) : filteredLists && filteredLists.length > 0 ? (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("title")}
                    >
                      <div className="flex items-center gap-2">
                        Title
                        {sortField === "title" && (
                          <span>{sortOrder === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("week_start_date")}
                    >
                      <div className="flex items-center gap-2">
                        Week Start
                        {sortField === "week_start_date" && (
                          <span>{sortOrder === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("word_count")}
                    >
                      <div className="flex items-center gap-2">
                        Words
                        {sortField === "word_count" && (
                          <span>{sortOrder === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("created_at")}
                    >
                      <div className="flex items-center gap-2">
                        Created
                        {sortField === "created_at" && (
                          <span>{sortOrder === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredLists.map((list) => (
                    <tr key={list.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {list.title}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {formatDate(list.week_start_date)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {list.word_count || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {formatDate(list.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Link to={`/parent/lists/${list.id}`}>
                            <Button size="sm" title="Edit">
                              <Edit size={16} />
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            onClick={() => handleDuplicate(list.id)}
                            disabled={duplicateList.isPending}
                            title="Duplicate"
                          >
                            <Copy size={16} />
                          </Button>
                          {deleteConfirm === list.id ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleDelete(list.id)}
                                disabled={deleteList.isPending}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => setDeleteConfirm(null)}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => setDeleteConfirm(list.id)}
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">
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
      </div>
    </AppShell>
  );
}
