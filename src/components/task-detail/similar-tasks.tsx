"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { getSimilarTasks, type SimilarTaskResult } from "@/actions/semantic-search";

export function SimilarTasks({
  taskId,
  projectIdentifier,
  onNavigateToTask,
}: {
  taskId: string;
  projectIdentifier: string;
  onNavigateToTask?: (taskId: string) => void;
}) {
  const [results, setResults] = useState<SimilarTaskResult[]>([]);

  useEffect(() => {
    let cancelled = false;

    getSimilarTasks(taskId)
      .then((tasks) => {
        if (cancelled) return;
        setResults(tasks);
      })
      .catch(() => {
        if (cancelled) return;
        setResults([]);
      });

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  if (results.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        <Sparkles className="h-3.5 w-3.5" />
        Benzer Görevler
      </h2>

      <ul className="flex flex-col gap-0.5">
        {results.map((result) => (
          <li key={result.id}>
            <button
              type="button"
              onClick={() => onNavigateToTask?.(result.id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: result.stateColor }}
              />
              <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {projectIdentifier}-{result.sequenceId}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
                {result.title}
              </span>
              <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                {Math.round(result.similarity * 100)}%
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
