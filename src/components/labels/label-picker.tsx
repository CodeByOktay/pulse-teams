"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tag, Plus } from "lucide-react";
import { addLabelToTask, createLabel, removeLabelFromTask } from "@/actions/label";
import { LABEL_COLOR_PALETTE } from "@/lib/colors";
import { useClickOutside } from "@/lib/use-click-outside";

export type LabelOption = { id: string; name: string; color: string };

export function LabelPicker({
  taskId,
  projectId,
  availableLabels,
  selectedLabelIds,
  onChange,
}: {
  taskId: string;
  projectId: string;
  availableLabels: LabelOption[];
  selectedLabelIds: string[];
  onChange?: (labelIds: string[]) => void;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState<string>(LABEL_COLOR_PALETTE[0]);
  const [error, setError] = useState<string | null>(null);
  const [syncedAvailableLabels, setSyncedAvailableLabels] = useState(availableLabels);
  const [localLabels, setLocalLabels] = useState(availableLabels);
  const [syncedSelectedLabelIds, setSyncedSelectedLabelIds] = useState(selectedLabelIds);
  const [localSelected, setLocalSelected] = useState(selectedLabelIds);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsOpen(false));

  // Render-phase prop synchronization (React 19 pattern, no effect needed).
  if (syncedAvailableLabels !== availableLabels) {
    setSyncedAvailableLabels(availableLabels);
    setLocalLabels(availableLabels);
  }
  if (syncedSelectedLabelIds !== selectedLabelIds) {
    setSyncedSelectedLabelIds(selectedLabelIds);
    setLocalSelected(selectedLabelIds);
  }

  function toggleLabel(labelId: string, isSelected: boolean) {
    const nextSelected = isSelected
      ? localSelected.filter((id) => id !== labelId)
      : [...localSelected, labelId];
    setLocalSelected(nextSelected);
    onChange?.(nextSelected);

    startTransition(async () => {
      if (isSelected) {
        await removeLabelFromTask(taskId, labelId);
      } else {
        await addLabelToTask(taskId, labelId);
      }
      router.refresh();
    });
  }

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!newLabelName.trim()) {
      setError("Etiket adı zorunludur.");
      return;
    }

    startTransition(async () => {
      try {
        const label = await createLabel({
          projectId,
          name: newLabelName.trim(),
          color: newLabelColor,
        });
        await addLabelToTask(taskId, label.id);
        setLocalLabels((prev) => [...prev, label]);
        const nextSelected = [...localSelected, label.id];
        setLocalSelected(nextSelected);
        onChange?.(nextSelected);
        setNewLabelName("");
        setIsCreating(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Etiket oluşturulamadı.");
      }
    });
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <Tag className="h-3.5 w-3.5" />
        Etiket
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-full z-40 mt-1 w-56 rounded-md border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {localLabels.length === 0 ? (
              <p className="px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400">
                Henüz etiket yok.
              </p>
            ) : (
              localLabels.map((label) => {
                const isSelected = localSelected.includes(label.id);
                return (
                  <label
                    key={label.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleLabel(label.id, isSelected)}
                      className="h-3.5 w-3.5"
                    />
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="truncate text-zinc-700 dark:text-zinc-300">
                      {label.name}
                    </span>
                  </label>
                );
              })
            )}
          </div>

          <div className="mt-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
            {isCreating ? (
              <form onSubmit={handleCreate} className="flex flex-col gap-2">
                {error ? <p className="text-xs text-red-600">{error}</p> : null}
                <input
                  autoFocus
                  type="text"
                  placeholder="Etiket adı"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800"
                />
                <div className="flex flex-wrap gap-1">
                  {LABEL_COLOR_PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewLabelColor(color)}
                      className={`h-5 w-5 rounded-full ${
                        newLabelColor === color
                          ? "ring-2 ring-offset-1 ring-zinc-900 dark:ring-zinc-100"
                          : ""
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={color}
                    />
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="rounded-md px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    Oluştur
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Yeni etiket oluştur
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
