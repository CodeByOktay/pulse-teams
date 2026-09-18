"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { addTaskToSprint, removeTaskFromSprint } from "@/actions/sprint";

export type PickerTask = { id: string; title: string; sequenceId: number };

export function SprintTaskPicker({
  sprintId,
  sprintTasks,
  availableTasks,
}: {
  sprintId: string;
  sprintTasks: PickerTask[];
  availableTasks: PickerTask[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const filteredAvailable = availableTasks.filter((task) =>
    task.title.toLowerCase().includes(search.trim().toLowerCase()),
  );

  function toggleSelected(taskId: string) {
    setSelectedIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId],
    );
  }

  function handleAdd() {
    if (selectedIds.length === 0) return;

    startTransition(async () => {
      try {
        await Promise.all(selectedIds.map((taskId) => addTaskToSprint(sprintId, taskId)));
        setSelectedIds([]);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Görevler sprint'e eklenemedi.");
      }
    });
  }

  function handleRemove(taskId: string) {
    setRemovingId(taskId);
    startTransition(async () => {
      try {
        await removeTaskFromSprint(sprintId, taskId);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Görev sprintten çıkarılamadı.");
      } finally {
        setRemovingId(null);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Sprint Görevleri ({sprintTasks.length})
        </h4>
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {sprintTasks.length === 0 ? (
            <li className="px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400">
              Bu sprintte henüz görev yok.
            </li>
          ) : (
            sprintTasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <span className="truncate text-zinc-700 dark:text-zinc-300">{task.title}</span>
                <button
                  onClick={() => handleRemove(task.id)}
                  disabled={isPending}
                  className="shrink-0 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-red-950"
                >
                  {removingId === task.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Çıkar"
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Görev Ekle</h4>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Görev ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white py-1.5 pl-7 pr-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
          {filteredAvailable.length === 0 ? (
            <li className="px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400">
              Eklenebilecek görev bulunamadı.
            </li>
          ) : (
            filteredAvailable.map((task) => (
              <li key={task.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(task.id)}
                    onChange={() => toggleSelected(task.id)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="truncate text-zinc-700 dark:text-zinc-300">{task.title}</span>
                </label>
              </li>
            ))
          )}
        </ul>

        <button
          onClick={handleAdd}
          disabled={isPending || selectedIds.length === 0}
          className="mt-1 flex items-center justify-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Sprint&apos;e Ekle {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
        </button>
      </div>
    </div>
  );
}
