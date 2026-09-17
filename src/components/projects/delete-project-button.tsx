"use client";

import { useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { deleteProject } from "@/actions/project";
import { isRedirectError } from "@/lib/action-errors";

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Bu projeyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.")) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteProject(projectId);
      } catch (err) {
        if (isRedirectError(err)) {
          throw err;
        }
        alert(err instanceof Error ? err.message : "Proje silinemedi.");
      }
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      aria-label="Projeyi sil"
      className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-red-950"
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}
