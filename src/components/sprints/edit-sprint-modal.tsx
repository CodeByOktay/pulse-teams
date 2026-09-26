"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2, X } from "lucide-react";
import type { SprintStatus } from "@prisma/client";
import { updateSprint } from "@/actions/sprint";
import { validateSprintDates } from "@/lib/sprint-logic";

const STATUS_LABELS: Record<SprintStatus, string> = {
  DRAFT: "Taslak",
  ACTIVE: "Aktif",
  COMPLETED: "Tamamlandı",
};

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export type EditableSprint = {
  id: string;
  name: string;
  goal: string | null;
  startDate: Date | null;
  endDate: Date | null;
  status: SprintStatus;
};

export function EditSprintModal({ sprint }: { sprint: EditableSprint }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(sprint.name);
  const [goal, setGoal] = useState(sprint.goal ?? "");
  const [startDate, setStartDate] = useState(toDateInputValue(sprint.startDate));
  const [endDate, setEndDate] = useState(toDateInputValue(sprint.endDate));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function open() {
    setName(sprint.name);
    setGoal(sprint.goal ?? "");
    setStartDate(toDateInputValue(sprint.startDate));
    setEndDate(toDateInputValue(sprint.endDate));
    setError(null);
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
    setError(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Sprint adı zorunludur.");
      return;
    }

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const validation = validateSprintDates(start, end);
    if (!validation.valid) {
      setError(validation.error ?? "Geçersiz tarih aralığı.");
      return;
    }

    startTransition(async () => {
      try {
        await updateSprint(sprint.id, {
          name: name.trim(),
          goal: goal.trim(),
          startDate: start,
          endDate: end,
        });
        router.refresh();
        close();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sprint güncellenemedi.");
      }
    });
  }

  return (
    <>
      <button
        onClick={open}
        className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <Pencil className="h-3.5 w-3.5" />
        Düzenle
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Sprint Düzenle
              </h2>
              <button
                onClick={close}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                aria-label="Kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="edit-name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Sprint Adı
                </label>
                <input
                  id="edit-name"
                  type="text"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="edit-goal" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Hedef (opsiyonel)
                </label>
                <textarea
                  id="edit-goal"
                  maxLength={500}
                  rows={3}
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="edit-startDate" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Başlangıç Tarihi
                  </label>
                  <input
                    id="edit-startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="edit-endDate" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Bitiş Tarihi
                  </label>
                  <input
                    id="edit-endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Sprint Durumu
                </span>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {STATUS_LABELS[sprint.status]}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Durum yalnızca sprinti başlatarak veya tamamlayarak değişir.
                  </span>
                </div>
              </div>

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center justify-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
