"use client";

import { Inbox } from "lucide-react";
import { BacklogTaskTable } from "@/components/backlog/backlog-task-table";
import { SprintProgressCard, type BacklogSprintCardData } from "@/components/backlog/sprint-progress-card";
import type { MoveToSprintOption } from "@/components/backlog/move-to-sprint-menu";
import { TaskDetailModal } from "@/components/task-detail/task-detail-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { useTaskNavigation } from "@/lib/use-task-navigation";
import type { LabelOption } from "@/components/labels/label-picker";
import type { AssigneeOption } from "@/components/assignees/assignee-picker";
import type { ListTask, ListState } from "@/types/list";

export function BacklogPageContainer({
  projectId,
  projectIdentifier,
  tasks,
  activeDraftSprints,
  states,
  availableLabels,
  members,
}: {
  projectId: string;
  projectIdentifier: string;
  tasks: ListTask[];
  activeDraftSprints: BacklogSprintCardData[];
  states: ListState[];
  availableLabels: LabelOption[];
  members: AssigneeOption[];
}) {
  const { selectedTaskId, openTask, navigateToTask, closeTaskDetail } = useTaskNavigation();

  const sprintOptions: MoveToSprintOption[] = activeDraftSprints.map((sprint) => ({
    id: sprint.id,
    name: sprint.name,
  }));

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
      {activeDraftSprints.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Aktif & Taslak Sprintler
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeDraftSprints.map((sprint) => (
              <SprintProgressCard key={sprint.id} sprint={sprint} projectId={projectId} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-2">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Backlog ({tasks.length})
        </h2>

        {tasks.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Backlog boş"
            description="Sprintlere atanmamış tüm görevler burada listelenir."
          />
        ) : (
          <BacklogTaskTable
            tasks={tasks}
            projectIdentifier={projectIdentifier}
            availableSprints={sprintOptions}
            onOpenTask={openTask}
          />
        )}
      </div>

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
