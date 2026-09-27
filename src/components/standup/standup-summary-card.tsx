import { AlertTriangle, Users } from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown/markdown-renderer";

/**
 * Renders Agent-005's published standup summary (spec §3.2). Pure presentational —
 * no client-side state — so it can be rendered directly from the board server component.
 */
export function StandupSummaryCard({
  summary,
  blockers,
}: {
  summary: string;
  blockers: string[];
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
          <Users className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Günlük Standup Özeti
        </h3>
      </div>

      <MarkdownRenderer content={summary} />

      {blockers.length > 0 ? (
        <div className="flex flex-col gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            Engeller
          </div>
          <ul className="flex flex-col gap-1 pl-5 text-sm text-amber-800 dark:text-amber-300">
            {blockers.map((blocker, index) => (
              <li key={index} className="list-disc">
                {blocker}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
