import { useState } from "react";
import { Button } from "./Button";
import { Card } from "./Card";
import { Download, FileText, Activity, Award, X } from "lucide-react";
import {
  exportAttempts,
  exportMasteredWords,
  exportSessionAnalytics,
  exportAllAnalytics,
} from "@/lib/exportCsv";
import { logger } from "@/lib/logger";

interface ExportButtonProps {
  childId: string;
  dateFrom?: Date;
  dateTo?: Date;
  variant?: "parent" | "child";
}

type ExportType = "attempts" | "mastered" | "sessions" | "all";

interface ExportOptionProps {
  onClick: () => void;
  disabled: boolean;
  icon: typeof FileText;
  title: string;
  description: string;
  variant?: "default" | "primary";
}

function ExportOption({
  onClick,
  disabled,
  icon: Icon,
  title,
  description,
  variant = "default",
}: ExportOptionProps) {
  const baseClasses =
    "w-full p-4 border-2 rounded-lg hover:bg-muted transition-colors text-left";
  const variantClasses =
    variant === "primary"
      ? "border-primary bg-primary/10 hover:bg-primary/20"
      : "border-border";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses}`}
    >
      <div className="flex items-start gap-3">
        <Icon className="w-6 h-6 text-primary flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </button>
  );
}

interface ExportModalProps {
  isOpen: boolean;
  isExporting: boolean;
  buttonSize: "default" | "child";
  dateFrom?: Date;
  dateTo?: Date;
  onClose: () => void;
  onExport: (type: ExportType) => void;
}

function ExportModal({
  isOpen,
  isExporting,
  buttonSize,
  dateFrom,
  dateTo,
  onClose,
  onExport,
}: ExportModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Export Analytics Data</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          {dateFrom && dateTo && (
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium mb-1">Date Range:</p>
              <p className="text-muted-foreground">
                {dateFrom.toLocaleDateString()} - {dateTo.toLocaleDateString()}
              </p>
            </div>
          )}

          <p className="text-muted-foreground">
            Choose what data to export to CSV:
          </p>
        </div>

        <div className="space-y-3">
          <ExportOption
            onClick={() => onExport("attempts")}
            disabled={isExporting}
            icon={FileText}
            title="Practice Attempts"
            description="All spelling attempts with timestamps, words, modes, and results"
          />

          <ExportOption
            onClick={() => onExport("mastered")}
            disabled={isExporting}
            icon={Award}
            title="Mastered Words"
            description="Words with ease ≥ 2.5 and interval ≥ 7 days (SRS data)"
          />

          <ExportOption
            onClick={() => onExport("sessions")}
            disabled={isExporting}
            icon={Activity}
            title="Session Analytics"
            description="Daily session summaries with accuracy and time-on-task"
          />

          <ExportOption
            onClick={() => onExport("all")}
            disabled={isExporting}
            icon={Download}
            title="Export All"
            description="Download all three datasets as separate CSV files"
            variant="primary"
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button
            size={buttonSize}
            variant="outline"
            onClick={onClose}
            disabled={isExporting}
          >
            Cancel
          </Button>
        </div>

        {isExporting && (
          <div className="mt-4 p-3 bg-primary/10 rounded-lg text-sm text-center">
            <p className="font-medium">Preparing export...</p>
          </div>
        )}
      </Card>
    </div>
  );
}

export function ExportButton({
  childId,
  dateFrom,
  dateTo,
  variant = "parent",
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const buttonSize = variant === "child" ? "child" : "default";

  const handleExport = async (type: ExportType) => {
    try {
      setIsExporting(true);

      switch (type) {
        case "attempts":
          await exportAttempts(childId, dateFrom, dateTo);
          break;
        case "mastered":
          await exportMasteredWords(childId);
          break;
        case "sessions":
          await exportSessionAnalytics(childId, dateFrom, dateTo);
          break;
        case "all":
          await exportAllAnalytics(childId, dateFrom, dateTo);
          break;
        default:
          logger.warn(`Unknown export type: ${type}`);
          return;
      }

      // Close modal after successful export
      setIsOpen(false);
    } catch (error) {
      logger.error(`Failed to export ${type}:`, error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <Button
        size={buttonSize}
        variant="secondary"
        onClick={() => setIsOpen(true)}
        disabled={!childId}
      >
        <Download className="w-4 h-4 mr-2" />
        Export Data
      </Button>

      <ExportModal
        isOpen={isOpen}
        isExporting={isExporting}
        buttonSize={buttonSize}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onClose={() => setIsOpen(false)}
        onExport={handleExport}
      />
    </>
  );
}
