import { List, Mic, FileText, Calendar } from "lucide-react";
import { Card } from "./Card";

export interface ListStatisticsProps {
  totalWords: number;
  wordsWithAudio: number;
  wordsWithPhonetics: number;
  createdAt?: string;
  lastModified?: string;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  colorClass: string;
}

function StatCard({ icon, label, value, colorClass }: StatCardProps) {
  return (
    <Card className="flex items-center gap-4 p-4 transition-transform hover:scale-105">
      <div className={`rounded-full p-3 ${colorClass}`}>{icon}</div>
      <div className="flex flex-col">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-2xl font-bold">{value}</span>
      </div>
    </Card>
  );
}

/**
 * Statistics display component for word lists
 * Shows key metrics about the list
 */
export function ListStatistics({
  totalWords,
  wordsWithAudio,
  wordsWithPhonetics,
  createdAt,
  lastModified,
}: ListStatisticsProps) {
  const formatDate = (dateString?: string): string => {
    if (!dateString) return "N/A";

    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    );

    if (diffInHours < 1) {
      return "Just now";
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours !== 1 ? "s" : ""} ago`;
    } else if (diffInHours < 48) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={<List className="h-6 w-6 text-primary" aria-hidden="true" />}
        label="Total Words"
        value={totalWords}
        colorClass="bg-primary/20"
      />

      <StatCard
        icon={<Mic className="h-6 w-6 text-secondary" aria-hidden="true" />}
        label="With Audio"
        value={wordsWithAudio}
        colorClass="bg-secondary/20"
      />

      <StatCard
        icon={<FileText className="h-6 w-6 text-accent" aria-hidden="true" />}
        label="With Phonetics"
        value={wordsWithPhonetics}
        colorClass="bg-accent/20"
      />

      <StatCard
        icon={
          <Calendar
            className="h-6 w-6 text-muted-foreground"
            aria-hidden="true"
          />
        }
        label="Last Modified"
        value={formatDate(lastModified || createdAt)}
        colorClass="bg-muted"
      />
    </div>
  );
}
