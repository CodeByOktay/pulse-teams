"use client";

import Link from "next/link";
import { LayoutGrid, List } from "lucide-react";

export function ViewSwitcher({
  projectId,
  active,
}: {
  projectId: string;
  active: "board" | "list";
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
      <Link
        href={`/projects/${projectId}/board`}
        aria-label="Kanban görünümü"
        className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-medium transition-colors ${
          active === "board"
            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
            : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
      >
        <LayoutGrid className="h-4 w-4" />
        Board
      </Link>
      <Link
        href={`/projects/${projectId}/list`}
        aria-label="Liste görünümü"
        className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-medium transition-colors ${
          active === "list"
            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
            : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
      >
        <List className="h-4 w-4" />
        Liste
      </Link>
    </div>
  );
}
