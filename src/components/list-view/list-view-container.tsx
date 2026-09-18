"use client";

import { useState } from "react";
import { ClipboardList, FilterX } from "lucide-react";
import { ListTable } from "@/components/list-view/list-table";
import { TaskDetailModal } from "@/components/task-detail/task-detail-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { useBoardQuery } from "@/lib/use-board-query";
import type { LabelOption } from "@/components/labels/label-picker";
import type { AssigneeOption } from "@/components/assignees/assignee-picker";
import type { ListTask, ListState } from "@/types/list";

export function ListViewContainer({
  projectId,
  projectIdentifier,
  tasks,
  states,
  availableLabels,
  members,
  totalTaskCount,
  isFiltered,
}: {
  projectId: string;
  projectIdentifier: string;
  tasks: ListTask[];
  states: ListState[];
  availableLabels: LabelOption[];
  members: AssigneeOption[];
  totalTaskCount: number;
  isFiltered: boolean;
}) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const { clearAll } = useBoardQuery();

  return (
    <div className="flex flex-1 flex-col overflow-hidden p-4">
      {totalTaskCount === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Bu projede henüz görev yok"
          description="İlk görevinizi board görünümünden ekleyerek başlayın."
        />
      ) : isFiltered && tasks.length === 0 ? (
        <EmptyState
          icon={FilterX}
          title="Filtrelere uygun görev bulunamadı"
          description="Farklı bir filtre kombinasyonu deneyin veya filtreleri temizleyin."
          action={
            <button
              type="button"
              onClick={clearAll}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Filtreleri temizle
            </button>
          }
        />
      ) : (
        <ListTable
          tasks={tasks}
          projectId={projectId}
          projectIdentifier={projectIdentifier}
          onOpenTask={setSelectedTaskId}
        />
      )}

      {selectedTaskId ? (
        <TaskDetailModal
          taskId={selectedTaskId}
          projectId={projectId}
          projectIdentifier={projectIdentifier}
          states={states.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
          availableLabels={availableLabels}
          members={members}
          onClose={() => setSelectedTaskId(null)}
        />
      ) : null}
    </div>
  );
}
