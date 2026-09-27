"use client";

import { useEffect, useEffectEvent, useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { submitMyStandupEntry } from "@/actions/standup";

const TEXTAREA_CLASS =
  "w-full resize-y rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Standup gönderilemedi.";
}

/**
 * Compact 3-question daily standup form (spec §3.2). Rendered on top of the board only —
 * opened from `StandupBanner`. Escape closes the modal; the keydown listener lives on
 * `document` so it does not clash with nested field focus/blur handling.
 */
export function StandupModal({
  projectId,
  open,
  onClose,
  onSubmitted,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [yesterday, setYesterday] = useState("");
  const [today, setToday] = useState("");
  const [blockers, setBlockers] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleEscape = useEffectEvent(() => {
    if (open) onClose();
  });

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleEscape();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (!open) return null;

  const trimmedYesterday = yesterday.trim();
  const trimmedToday = today.trim();
  const canSubmit = trimmedYesterday.length > 0 && trimmedToday.length > 0 && !isPending;

  function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      try {
        await submitMyStandupEntry(
          projectId,
          trimmedYesterday,
          trimmedToday,
          blockers.trim() || undefined,
        );
        setYesterday("");
        setToday("");
        setBlockers("");
        onSubmitted();
        onClose();
      } catch (err) {
        setError(errorMessage(err));
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative flex w-full max-w-lg flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Günlük Standup
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="standup-yesterday" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Dün ne yaptın?
          </label>
          <textarea
            id="standup-yesterday"
            value={yesterday}
            onChange={(e) => setYesterday(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") e.stopPropagation();
            }}
            disabled={isPending}
            rows={2}
            autoFocus
            className={TEXTAREA_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="standup-today" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Bugün ne yapacaksın?
          </label>
          <textarea
            id="standup-today"
            value={today}
            onChange={(e) => setToday(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") e.stopPropagation();
            }}
            disabled={isPending}
            rows={2}
            className={TEXTAREA_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="standup-blockers" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Karşılaştığın bir engel var mı? <span className="text-zinc-400">(opsiyonel)</span>
          </label>
          <textarea
            id="standup-blockers"
            value={blockers}
            onChange={(e) => setBlockers(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") e.stopPropagation();
            }}
            disabled={isPending}
            rows={2}
            className={TEXTAREA_CLASS}
          />
        </div>

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Gönder
          </button>
        </div>
      </div>
    </div>
  );
}
