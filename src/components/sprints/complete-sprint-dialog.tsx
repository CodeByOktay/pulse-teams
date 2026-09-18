"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { completeSprint } from "@/actions/sprint";

export function CompleteSprintDialog({
  sprintId,
  incompleteCount,
  onClose,
}: {
  sprintId: string;
  incompleteCount: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      try {
        await completeSprint(sprintId);
        router.refresh();
        onClose();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Sprint tamamlanamadı.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Sprinti Tamamla
        </h2>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          {incompleteCount > 0
            ? `Bu sprintte ${incompleteCount} görev tamamlanamadı. Sprint'i kapatmak istediğinize emin misiniz?`
            : "Sprintteki tüm görevler tamamlandı. Sprint'i kapatmak istediğinize emin misiniz?"}
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="flex items-center justify-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Evet, Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
