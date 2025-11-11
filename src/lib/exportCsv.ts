/**
 * CSV Export Utilities
 *
 * Provides functions to export practice attempts and mastered words to CSV format
 * for parent dashboard analytics
 */

import { supabase } from "@/app/supabase";
import { logger } from "./logger";

/**
 * Convert an array of objects to CSV format
 */
function arrayToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";

  // Get headers from first object
  const headers = Object.keys(data[0]);
  const headerRow = headers.join(",");

  // Convert each row to CSV
  const rows = data.map((row) => {
    return headers
      .map((header) => {
        const value = row[header];

        // Handle different data types
        if (value === null || value === undefined) {
          return "";
        }

        // Convert to string and escape quotes
        const stringValue = String(value).replace(/"/g, '""');

        // Wrap in quotes if contains comma, newline, or quote
        if (
          stringValue.includes(",") ||
          stringValue.includes("\n") ||
          stringValue.includes('"')
        ) {
          return `"${stringValue}"`;
        }

        return stringValue;
      })
      .join(",");
  });

  return [headerRow, ...rows].join("\n");
}

/**
 * Trigger browser download of CSV data
 */
function downloadCSV(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");

  if (link.download !== undefined) {
    // Create download link
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up URL
    URL.revokeObjectURL(url);
  }
}

/**
 * Export practice attempts to CSV
 *
 * @param childId - Child's user ID
 * @param dateFrom - Start date (inclusive)
 * @param dateTo - End date (inclusive)
 * @param filename - Output filename (default: attempts_YYYY-MM-DD.csv)
 */
export async function exportAttempts(
  childId: string,
  dateFrom?: Date,
  dateTo?: Date,
  filename?: string
): Promise<void> {
  try {
    logger.log("Exporting attempts to CSV", { childId, dateFrom, dateTo });

    // Build query
    let query = supabase
      .from("attempts")
      .select("started_at, word_id, words (text, phonetic), mode, correct, typed_answer, duration_ms")
      .eq("child_id", childId)
      .order("started_at", { ascending: false });

    // Add date filters if provided
    if (dateFrom) {
      query = query.gte("started_at", dateFrom.toISOString());
    }
    if (dateTo) {
      // Add one day to include the entire end date
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      query = query.lt("started_at", endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data || data.length === 0) {
      logger.warn("No attempts found for export");
      throw new Error("No attempts found for the selected date range.");
    }

    // Transform data for CSV
    const csvData = data.map((attempt) => {
      const words = attempt.words as { text: string; phonetic?: string } | null;
      return {
        Date: new Date(attempt.started_at ?? "").toLocaleDateString(),
        Time: new Date(attempt.started_at ?? "").toLocaleTimeString(),
        Word: words?.text || "",
        Phonetic: words?.phonetic || "",
        Mode: attempt.mode,
        Correct: attempt.correct ? "Yes" : "No",
        "Typed Answer": attempt.typed_answer || "",
        "Duration (ms)": attempt.duration_ms || "",
      };
    });

    // Generate CSV
    const csv = arrayToCSV(csvData);

    // Generate filename
    const defaultFilename = `attempts_${new Date().toISOString().split("T")[0]}.csv`;
    const exportFilename = filename || defaultFilename;

    // Download
    downloadCSV(exportFilename, csv);

    logger.log(
      `Successfully exported ${csvData.length} attempts to ${exportFilename}`
    );
  } catch (error) {
    logger.error("Failed to export attempts:", error);
    throw error;
  }
}

/**
 * Export mastered words to CSV
 *
 * @param childId - Child's user ID
 * @param filename - Output filename (default: mastered_words_YYYY-MM-DD.csv)
 */
export async function exportMasteredWords(
  childId: string,
  filename?: string
): Promise<void> {
  try {
    logger.log("Exporting mastered words to CSV", { childId });

    // Query SRS table for mastered words (ease >= 2.5, interval >= 7 days)
    const { data, error } = await supabase
      .from("srs")
      .select("word_id, words (text, phonetic), ease, interval_days, reps, lapses, due_date, updated_at")
      .eq("child_id", childId)
      .gte("ease", 2.5)
      .gte("interval_days", 7)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      logger.warn("No mastered words found for export");
      throw new Error("No mastered words found yet.");
    }

    // Transform data for CSV
    const csvData = data.map((srs) => {
      const words = srs.words as { text: string; phonetic?: string } | null;
      return {
        Word: words?.text || "",
        Phonetic: words?.phonetic || "",
        Ease: srs.ease.toFixed(2),
        "Interval (days)": srs.interval_days,
        Repetitions: srs.reps,
        Lapses: srs.lapses,
        "Next Review": new Date(srs.due_date).toLocaleDateString(),
        "Last Practiced": new Date(srs.updated_at).toLocaleDateString(),
      };
    });

    // Generate CSV
    const csv = arrayToCSV(csvData);

    // Generate filename
    const defaultFilename = `mastered_words_${new Date().toISOString().split("T")[0]}.csv`;
    const exportFilename = filename || defaultFilename;

    // Download
    downloadCSV(exportFilename, csv);

    logger.log(
      `Successfully exported ${csvData.length} mastered words to ${exportFilename}`
    );
  } catch (error) {
    logger.error("Failed to export mastered words:", error);
    throw error;
  }
}

/**
 * Export session analytics to CSV
 *
 * @param childId - Child's user ID
 * @param dateFrom - Start date (inclusive)
 * @param dateTo - End date (inclusive)
 * @param filename - Output filename (default: sessions_YYYY-MM-DD.csv)
 */
export async function exportSessionAnalytics(
  childId: string,
  dateFrom?: Date,
  dateTo?: Date,
  filename?: string
): Promise<void> {
  try {
    logger.log("Exporting session analytics to CSV", {
      childId,
      dateFrom,
      dateTo,
    });

    // Build query
    let query = supabase
      .from("session_analytics")
      .select("*")
      .eq("child_id", childId)
      .order("session_date", { ascending: false });

    // Add date filters if provided
    if (dateFrom) {
      query = query.gte("session_date", dateFrom.toISOString().split("T")[0]);
    }
    if (dateTo) {
      query = query.lte("session_date", dateTo.toISOString().split("T")[0]);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data || data.length === 0) {
      logger.warn("No session analytics found for export");
      throw new Error(
        "No session analytics found for the selected date range."
      );
    }

    // Transform data for CSV
    const csvData = data.map((session) => ({
      Date: new Date(session.session_date).toLocaleDateString(),
      "Words Practiced": session.words_practiced,
      "Correct First Try": session.correct_on_first_try ?? 0,
      "Total Attempts": session.total_attempts ?? 0,
      "Accuracy (%)":
        (session.total_attempts ?? 0) > 0
          ? (
              ((session.correct_on_first_try ?? 0) /
                (session.total_attempts ?? 1)) *
              100
            ).toFixed(1)
          : "0",
      "Duration (min)": Math.floor(
        (session.session_duration_seconds ?? 0) / 60
      ),
      "Duration (sec)": (session.session_duration_seconds ?? 0) % 60,
    }));

    // Generate CSV
    const csv = arrayToCSV(csvData);

    // Generate filename
    const defaultFilename = `sessions_${new Date().toISOString().split("T")[0]}.csv`;
    const exportFilename = filename || defaultFilename;

    // Download
    downloadCSV(exportFilename, csv);

    logger.log(
      `Successfully exported ${csvData.length} sessions to ${exportFilename}`
    );
  } catch (error) {
    logger.error("Failed to export session analytics:", error);
    throw error;
  }
}

/**
 * Export all analytics data (attempts, mastered words, sessions) as separate CSV files
 *
 * @param childId - Child's user ID
 * @param dateFrom - Start date (inclusive)
 * @param dateTo - End date (inclusive)
 */
export async function exportAllAnalytics(
  childId: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<void> {
  try {
    logger.log("Exporting all analytics data", { childId, dateFrom, dateTo });

    const timestamp = new Date().toISOString().split("T")[0];

    // Export all three datasets
    await Promise.all([
      exportAttempts(childId, dateFrom, dateTo, `attempts_${timestamp}.csv`),
      exportMasteredWords(childId, `mastered_words_${timestamp}.csv`),
      exportSessionAnalytics(
        childId,
        dateFrom,
        dateTo,
        `sessions_${timestamp}.csv`
      ),
    ]);

    logger.log("Successfully exported all analytics data");
  } catch (error) {
    logger.error("Failed to export all analytics:", error);
    throw error;
  }
}
