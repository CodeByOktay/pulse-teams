"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightCircle, Loader2 } from "lucide-react";
import { moveTaskToSprint } from "@/actions/sprint";
import { useClickOutside } from "@/lib/use-click-outside";

export type MoveToSprintOption = { id: string; name: string };

export function MoveToSprintMenu({
  taskId,
  sprints,
}: {
  taskId: string;
  sprints: MoveToSprintOption[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, () => setIsOpen(false));

  function handleMove(sprintId: string) {
    setIsOpen(false);
    startTransition(async () => {
      try {
        await moveTaskToSprint(taskId, sprintId);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Görev sprint'e taşınamadı.");
      }
    });
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        disabled={isPending || sprints.length === 0}
        className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ArrowRightCircle className="h-3.5 w-3.5" />
        )}
        Sprint&apos;e Taşı
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full z-40 mt-1 w-48 rounded-md border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {sprints.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              Aktif/taslak sprint yok.
            </p>
          ) : (
            sprints.map((sprint) => (
              <button
                key={sprint.id}
                type="button"
                onClick={() => handleMove(sprint.id)}
                className="flex w-full items-center truncate rounded-md px-2 py-1.5 text-left text-xs text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {sprint.name}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
