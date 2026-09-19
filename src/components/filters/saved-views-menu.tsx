"use client";

import { useState } from "react";
import { Bookmark, Plus, X } from "lucide-react";
import { useSavedViews } from "@/lib/use-saved-views";
import type { BoardFilters } from "@/lib/board-filters";

export function SavedViewsMenu({ projectId, filters }: { projectId: string; filters: BoardFilters }) {
  const { views, saveView, deleteView, applyView, activeViewId } = useSavedViews(projectId, filters);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    saveView(trimmed);
    setName("");
    setIsSaving(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Bookmark className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
      {views.map((view) => (
        <div key={view.id} className="group relative flex items-center">
          <button
            type="button"
            onClick={() => applyView(view)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeViewId === view.id
                ? "border-blue-400 bg-blue-100 text-blue-700 dark:border-blue-700 dark:bg-blue-900 dark:text-blue-300"
                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
            } ${!view.isDefault ? "pr-5" : ""}`}
          >
            {view.name}
          </button>
          {!view.isDefault ? (
            <button
              type="button"
              onClick={() => deleteView(view.id)}
              aria-label={`${view.name} görünümünü sil`}
              className="absolute right-1 text-zinc-400 hover:text-red-500"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      ))}

      {isSaving ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setIsSaving(false);
            }}
            placeholder="Görünüm adı"
            autoFocus
            className="w-32 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          />
          <button
            type="button"
            onClick={handleSave}
            className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            Kaydet
          </button>
          <button
            type="button"
            onClick={() => setIsSaving(false)}
            aria-label="Görünüm kaydetmeyi iptal et"
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsSaving(true)}
          className="flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-3 py-1 text-xs text-zinc-500 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <Plus className="h-3 w-3" />
          Görünümü Kaydet
        </button>
      )}
    </div>
  );
}
