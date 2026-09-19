import { BacklogTaskRow } from "@/components/backlog/backlog-task-row";
import type { MoveToSprintOption } from "@/components/backlog/move-to-sprint-menu";
import type { ListTask } from "@/types/list";

const HEADERS = ["ID", "Başlık", "Durum", "Öncelik", "Atanan", "İşlemler"];

export function BacklogTaskTable({
  tasks,
  projectIdentifier,
  availableSprints,
  onOpenTask,
}: {
  tasks: ListTask[];
  projectIdentifier: string;
  availableSprints: MoveToSprintOption[];
  onOpenTask: (taskId: string) => void;
}) {
  return (
    <div className="overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-white dark:bg-zinc-900">
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            {HEADERS.map((header) => (
              <th
                key={header}
                className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <BacklogTaskRow
              key={task.id}
              task={task}
              projectIdentifier={projectIdentifier}
              availableSprints={availableSprints}
              onOpen={onOpenTask}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
