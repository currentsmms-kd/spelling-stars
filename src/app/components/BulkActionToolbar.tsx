import { Trash2, X } from "lucide-react";
import { Button } from "./Button";
import { Card } from "./Card";

export interface BulkActionToolbarProps {
  selectedCount: number;
  totalCount: number;
  onDelete: () => void;
  onClear: () => void;
  isDeleting?: boolean;
}

/**
 * Toolbar for bulk actions on selected items
 * Appears when items are selected
 */
export function BulkActionToolbar({
  selectedCount,
  totalCount,
  onDelete,
  onClear,
  isDeleting = false,
}: BulkActionToolbarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <Card
      role="toolbar"
      aria-label="Bulk actions toolbar"
      className="sticky top-0 z-10 mb-4 flex flex-col gap-3 border-primary bg-accent/50 p-4 shadow-md sm:flex-row sm:items-center sm:justify-between"
      style={{
        animation: "slideInDown 0.2s ease-out",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium">
          {selectedCount} of {totalCount} word{selectedCount !== 1 ? "s" : ""}{" "}
          selected
        </span>
      </div>

      <div className="flex gap-2">
        <Button
          variant="danger"
          size="default"
          onClick={onDelete}
          disabled={isDeleting}
          className="flex items-center gap-2"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {isDeleting ? "Deleting..." : "Delete Selected"}
        </Button>

        <Button
          variant="ghost"
          size="default"
          onClick={onClear}
          disabled={isDeleting}
          className="flex items-center gap-2"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Clear Selection
        </Button>
      </div>

      <style>{`
        @keyframes slideInDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </Card>
  );
}
