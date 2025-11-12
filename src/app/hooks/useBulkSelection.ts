import { useState, useCallback, useEffect } from "react";

interface SelectableItem {
  id: string;
}

interface UseBulkSelectionReturn {
  selectedIds: Set<string>;
  isSelected: (id: string) => boolean;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  selectedCount: number;
  isAllSelected: boolean;
}

/**
 * Custom hook for managing bulk selection state
 * @param items - Array of items with id property
 * @returns Selection state and control functions
 */
export function useBulkSelection<T extends SelectableItem>(
  items: T[]
): UseBulkSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Prune selectedIds to remove IDs that no longer exist in items
  useEffect(() => {
    const currentIdSet = new Set(items.map((item) => item.id));
    setSelectedIds((prev) => {
      const prunedIds = new Set([...prev].filter((id) => currentIdSet.has(id)));
      // Only update if the set actually changed to avoid unnecessary re-renders
      if (prunedIds.size !== prev.size) {
        return prunedIds;
      }
      return prev;
    });
  }, [items]);

  const isSelected = useCallback(
    (id: string): boolean => {
      return selectedIds.has(id);
    },
    [selectedIds]
  );

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  }, [items]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedCount = selectedIds.size;
  const isAllSelected = selectedCount > 0 && selectedCount === items.length;

  return {
    selectedIds,
    isSelected,
    toggleSelection,
    selectAll,
    clearSelection,
    selectedCount,
    isAllSelected,
  };
}
