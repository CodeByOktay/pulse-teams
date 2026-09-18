"use client";

import { Loader2, Trash2, X } from "lucide-react";
import type { Priority } from "@prisma/client";

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "NONE", label: "Yok" },
  { value: "LOW", label: "Düşük" },
  { value: "MEDIUM", label: "Orta" },
  { value: "HIGH", label: "Yüksek" },
  { value: "URGENT", label: "Acil" },
];

export type BulkActionState = { id: string; name: string };
export type BulkActionSprint = { id: string; name: string };

export function BulkActionBar({
  selectedCount,
  onClearSelection,
  onBulkUpdateState,
  onBulkUpdatePriority,
  onBulkAddToSprint,
  onBulkDelete,
  states,
  activeSprint,
  isLoading = false,
}: {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkUpdateState: (stateId: string) => void;
  onBulkUpdatePriority: (priority: Priority) => void;
  onBulkAddToSprint?: (sprintId: string) => void;
  onBulkDelete: () => void;
  states: BulkActionState[];
  activeSprint?: BulkActionSprint | null;
  isLoading?: boolean;
}) {
  if (selectedCount === 0) return null;

  function handleSelectChange<T extends string>(
    event: React.ChangeEvent<HTMLSelectElement>,
    handler: (value: T) => void,
  ) {
    const value = event.target.value;
    if (!value) return;
    handler(value as T);
    event.target.value = "";
  }

  return (
    <div className="sticky bottom-0 z-20 flex flex-wrap items-center gap-3 border-t border-zinc-200 bg-white px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.05)] dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          {selectedCount} görev seçildi
        </span>
        <button
          type="button"
          onClick={onClearSelection}
          disabled={isLoading}
          aria-label="Seçimi temizle"
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-zinc-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-zinc-400" /> : null}

        <select
          disabled={isLoading}
          defaultValue=""
          onChange={(e) => handleSelectChange(e, onBulkUpdateState)}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <option value="" disabled>
            Durumu Değiştir
          </option>
          {states.map((state) => (
            <option key={state.id} value={state.id}>
              {state.name}
            </option>
          ))}
        </select>

        <select
          disabled={isLoading}
          defaultValue=""
          onChange={(e) => handleSelectChange(e, onBulkUpdatePriority)}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <option value="" disabled>
            Önceliği Değiştir
          </option>
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {activeSprint && onBulkAddToSprint ? (
          <select
            disabled={isLoading}
            defaultValue=""
            onChange={(e) => handleSelectChange(e, onBulkAddToSprint)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <option value="" disabled>
              Sprint&apos;e Ekle
            </option>
            <option value={activeSprint.id}>{activeSprint.name}</option>
          </select>
        ) : null}

        <button
          type="button"
          onClick={onBulkDelete}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Sil
        </button>
      </div>
    </div>
  );
}
