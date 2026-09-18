"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, Trash2 } from "lucide-react";
import type { SprintStatus, StateGroup } from "@prisma/client";
import { deleteSprint, startSprint } from "@/actions/sprint";
import { canDeleteSprint } from "@/lib/sprint-logic";
import { formatSprintDateRange, getSprintProgress, isSprintOverdue } from "@/lib/sprint-utils";
import { EditSprintModal } from "@/components/sprints/edit-sprint-modal";
import { CompleteSprintDialog } from "@/components/sprints/complete-sprint-dialog";

export type SprintCardData = {
  id: string;
  name: string;
  goal: string | null;
  startDate: Date | null;
  endDate: Date | null;
  status: SprintStatus;
  tasks: { task: { title: string; sequenceId: number; state: { group: StateGroup } } }[];
};

const STATUS_BADGE: Record<SprintStatus, { label: string; className: string }> = {
  DRAFT: {
    label: "Taslak",
    className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  },
  ACTIVE: {
    label: "Aktif",
    className: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  },
  COMPLETED: {
    label: "Tamamlandı",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
};

const PROGRESS_BAR_COLOR: Record<SprintStatus, string> = {
  DRAFT: "bg-zinc-400",
  ACTIVE: "bg-blue-500",
  COMPLETED: "bg-green-500",
};

export function SprintCard({ sprint }: { sprint: SprintCardData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const badge = STATUS_BADGE[sprint.status];
  const progress = getSprintProgress(sprint);
  const overdue = isSprintOverdue(sprint);
  const incompleteCount = progress.total - progress.completed;

  function handleStart() {
    startTransition(async () => {
      try {
        await startSprint(sprint.id);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Sprint başlatılamadı.");
      }
    });
  }

  function handleDelete() {
    if (!confirm(`"${sprint.name}" sprintini silmek istediğinize emin misiniz?`)) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteSprint(sprint.id);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Sprint silinemedi.");
      }
    });
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
          >
            {badge.label}
          </span>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {sprint.name}
              </h3>
              {overdue ? (
                <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 dark:bg-red-950 dark:text-red-400">
                  <AlertTriangle className="h-3 w-3" />
                  Gecikmiş!
                </span>
              ) : null}
            </div>
            {sprint.goal ? (
              <p className="mt-0.5 text-xs italic text-zinc-500 dark:text-zinc-400">
                {sprint.goal}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {formatSprintDateRange(sprint.startDate, sprint.endDate)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {sprint.status === "DRAFT" ? (
            <>
              <button
                onClick={handleStart}
                disabled={isPending}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Başlat
              </button>
              <EditSprintModal sprint={sprint} />
              <button
                onClick={handleDelete}
                disabled={isPending || !canDeleteSprint(sprint.status).allowed}
                aria-label="Sprinti sil"
                className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-red-950"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </>
          ) : null}

          {sprint.status === "ACTIVE" ? (
            <>
              <button
                onClick={() => setShowCompleteDialog(true)}
                disabled={isPending}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Tamamla
              </button>
              <EditSprintModal sprint={sprint} />
            </>
          ) : null}

          {sprint.status === "COMPLETED" ? (
            <button
              onClick={() => setShowDetail((v) => !v)}
              className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Detay
              {showDetail ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all ${PROGRESS_BAR_COLOR[sprint.status]}`}
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {progress.completed}/{progress.total} görev
        </p>
      </div>

      {sprint.status === "COMPLETED" && showDetail ? (
        <ul className="mt-3 flex flex-col gap-1 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {sprint.tasks.length === 0 ? (
            <li className="text-xs text-zinc-500 dark:text-zinc-400">Bu sprintte görev yok.</li>
          ) : (
            sprint.tasks.map(({ task }) => (
              <li
                key={task.sequenceId}
                className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300"
              >
                <span className="truncate">{task.title}</span>
                <span className="shrink-0 text-zinc-400">{task.state.group}</span>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {showCompleteDialog ? (
        <CompleteSprintDialog
          sprintId={sprint.id}
          incompleteCount={incompleteCount}
          onClose={() => setShowCompleteDialog(false)}
        />
      ) : null}
    </div>
  );
}
