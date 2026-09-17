"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteTask } from "@/actions/task";

export function TaskIdentifier({
  projectIdentifier,
  sequenceId,
  taskId,
  onDeleted,
}: {
  projectIdentifier: string;
  sequenceId: number;
  taskId: string;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Bu görevi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.")) return;
    startTransition(async () => {
      await deleteTask(taskId);
      router.refresh();
      onDeleted();
    });
  }

  return (
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        {projectIdentifier}-{sequenceId}
      </span>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        aria-label="Görevi sil"
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-red-950"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Sil
      </button>
    </div>
  );
}
