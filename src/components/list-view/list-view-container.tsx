"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, FilterX } from "lucide-react";
import { ListTable } from "@/components/list-view/list-table";
import { BulkActionBar } from "@/components/list-view/bulk-action-bar";
import { TaskDetailModal } from "@/components/task-detail/task-detail-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useBoardQuery } from "@/lib/use-board-query";
import { useBulkSelection } from "@/lib/use-bulk-selection";
import { validateBulkDeleteLimit } from "@/lib/bulk-selection-logic";
import { bulkDeleteTasks, bulkUpdateTasks } from "@/actions/task";
import { addTaskToSprint } from "@/actions/sprint";
import type { LabelOption } from "@/components/labels/label-picker";
import type { AssigneeOption } from "@/components/assignees/assignee-picker";
import type { ListTask, ListState } from "@/types/list";
import type { Priority } from "@prisma/client";

export function ListViewContainer({
  projectId,
  projectIdentifier,
  tasks,
  states,
  availableLabels,
  members,
  totalTaskCount,
  isFiltered,
  activeSprint,
}: {
  projectId: string;
  projectIdentifier: string;
  tasks: ListTask[];
  states: ListState[];
  availableLabels: LabelOption[];
  members: AssigneeOption[];
  totalTaskCount: number;
  isFiltered: boolean;
  activeSprint?: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const { clearAll, searchParams, setParam } = useBoardQuery();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(() => searchParams.get("task"));
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const bulk = useBulkSelection(tasks);

  function closeTaskDetail() {
    setSelectedTaskId(null);
    if (searchParams.get("task")) setParam("task", null);
  }

  /** İlişkili bir göreve tıklanınca modal o göreve geçer, derin bağlantı varsa URL de güncellenir. */
  function navigateToTask(nextTaskId: string) {
    setSelectedTaskId(nextTaskId);
    if (searchParams.get("task")) setParam("task", nextTaskId);
  }

  function runBulkUpdate(data: { stateId?: string; priority?: Priority }) {
    const ids = [...bulk.selectedIds];
    startTransition(async () => {
      try {
        await bulkUpdateTasks(ids, data);
        bulk.clearSelection();
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Toplu güncelleme başarısız oldu.");
      }
    });
  }

  function handleBulkAddToSprint(sprintId: string) {
    const ids = [...bulk.selectedIds];
    startTransition(async () => {
      try {
        await Promise.all(ids.map((taskId) => addTaskToSprint(sprintId, taskId)));
        bulk.clearSelection();
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Görevler sprint'e eklenemedi.");
      }
    });
  }

  function handleBulkDelete() {
    const validation = validateBulkDeleteLimit(bulk.selectedCount);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }
    setIsDeleteDialogOpen(true);
  }

  function confirmBulkDelete() {
    const ids = [...bulk.selectedIds];
    startTransition(async () => {
      try {
        await bulkDeleteTasks(ids);
        bulk.clearSelection();
        setIsDeleteDialogOpen(false);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Görevler silinemedi.");
        setIsDeleteDialogOpen(false);
      }
    });
  }

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
        <>
          <ListTable
            tasks={tasks}
            projectId={projectId}
            projectIdentifier={projectIdentifier}
            onOpenTask={setSelectedTaskId}
            selectedTaskIds={[...bulk.selectedIds]}
            onToggleSelect={bulk.toggleSelect}
            isAllSelected={bulk.isAllSelected}
            isSomeSelected={bulk.selectedCount > 0}
            onToggleSelectAll={() => (bulk.isAllSelected ? bulk.clearSelection() : bulk.selectAll())}
          />

          <BulkActionBar
            selectedCount={bulk.selectedCount}
            onClearSelection={bulk.clearSelection}
            onBulkUpdateState={(stateId) => runBulkUpdate({ stateId })}
            onBulkUpdatePriority={(priority) => runBulkUpdate({ priority })}
            onBulkAddToSprint={activeSprint ? handleBulkAddToSprint : undefined}
            onBulkDelete={handleBulkDelete}
            states={states}
            activeSprint={activeSprint}
            isLoading={isPending}
          />
        </>
      )}

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        description={`Bu ${bulk.selectedCount} görevi silmek üzeresiniz. Bu işlem geri alınamaz.`}
        confirmLabel="Evet, Sil"
        confirmVariant="danger"
        onConfirm={confirmBulkDelete}
        onCancel={() => setIsDeleteDialogOpen(false)}
        isLoading={isPending}
      />

      {selectedTaskId ? (
        <TaskDetailModal
          taskId={selectedTaskId}
          projectId={projectId}
          projectIdentifier={projectIdentifier}
          states={states.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
          availableLabels={availableLabels}
          members={members}
          onClose={closeTaskDetail}
          onNavigateToTask={navigateToTask}
        />
      ) : null}
    </div>
  );
}
