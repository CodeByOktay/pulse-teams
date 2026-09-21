"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
} from "@/actions/notification";

type PreferenceField =
  | "notifyTaskAssigned"
  | "notifyCommentAdded"
  | "notifyMentioned"
  | "notifyDueDateApproaching"
  | "notifySprintClosed";

type PreferencesState = Record<PreferenceField, boolean>;

const PREFERENCE_ROWS: { field: PreferenceField; label: string }[] = [
  { field: "notifyTaskAssigned", label: "Görev atandığında" },
  { field: "notifyCommentAdded", label: "Yorum yapıldığında" },
  { field: "notifyMentioned", label: "Benden bahsedildiğinde (@mention)" },
  { field: "notifyDueDateApproaching", label: "Son teslim tarihi yaklaştığında" },
  { field: "notifySprintClosed", label: "Sprint kapandığında" },
];

export function NotificationPreferencesModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [preferences, setPreferences] = useState<PreferencesState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingFields, setPendingFields] = useState<Set<PreferenceField>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const result = await getUserNotificationPreferences();
        if (!isMounted) return;
        setPreferences({
          notifyTaskAssigned: result.notifyTaskAssigned,
          notifyCommentAdded: result.notifyCommentAdded,
          notifyMentioned: result.notifyMentioned,
          notifyDueDateApproaching: result.notifyDueDateApproaching,
          notifySprintClosed: result.notifySprintClosed,
        });
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Tercihler yüklenemedi.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  async function handleToggle(field: PreferenceField) {
    if (!preferences) return;
    const previous = preferences[field];
    const next = !previous;

    setPreferences({ ...preferences, [field]: next });
    setPendingFields((prev) => new Set(prev).add(field));
    setError(null);

    try {
      await updateUserNotificationPreferences({ [field]: next });
    } catch (err) {
      setPreferences((prev) => (prev ? { ...prev, [field]: previous } : prev));
      setError(err instanceof Error ? err.message : "Tercih güncellenemedi.");
    } finally {
      setPendingFields((prev) => {
        const next = new Set(prev);
        next.delete(field);
        return next;
      });
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Bildirim Tercihleri
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        ) : null}

        {isLoading || !preferences ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-400 dark:text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Yükleniyor...
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {PREFERENCE_ROWS.map(({ field, label }) => {
              const checked = preferences[field];
              const isPending = pendingFields.has(field);

              return (
                <label
                  key={field}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                >
                  <span className="flex-1">{label}</span>
                  <span className="flex items-center gap-2">
                    {isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400 dark:text-zinc-500" />
                    ) : null}
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isPending}
                      onChange={() => void handleToggle(field)}
                      className="h-4 w-4 shrink-0 rounded border-zinc-300 text-zinc-900 accent-zinc-900 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:accent-zinc-100"
                    />
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
