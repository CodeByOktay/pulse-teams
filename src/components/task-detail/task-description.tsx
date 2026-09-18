"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { updateTask } from "@/actions/task";
import { MarkdownEditor } from "@/components/markdown/markdown-editor";

export function TaskDescription({
  taskId,
  initialDescription,
}: {
  taskId: string;
  initialDescription: string;
}) {
  const [value, setValue] = useState(initialDescription);
  const [savedValue, setSavedValue] = useState(initialDescription);
  const [isPending, startTransition] = useTransition();

  const hasUnsavedChanges = value !== savedValue;

  function handleSave() {
    if (!hasUnsavedChanges) return;
    startTransition(async () => {
      await updateTask(taskId, { description: value });
      setSavedValue(value);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Açıklama</span>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
              Kaydedilmemiş değişiklikler
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isPending}
            className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Kaydet
          </button>
        </div>
      </div>

      <MarkdownEditor value={value} onChange={setValue} placeholder="Açıklama ekle..." />
    </div>
  );
}
