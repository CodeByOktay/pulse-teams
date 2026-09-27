"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { assignUserToTask, unassignUserFromTask } from "@/actions/assignee";
import { Avatar } from "@/components/assignees/avatar";
import { useClickOutside } from "@/lib/use-click-outside";

export type AssigneeOption = { id: string; name: string };

export function AssigneePicker({
  taskId,
  members,
  assignedUserIds,
  onChange,
}: {
  taskId: string;
  members: AssigneeOption[];
  assignedUserIds: string[];
  onChange?: (userIds: string[]) => void;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [syncedAssignedUserIds, setSyncedAssignedUserIds] = useState(assignedUserIds);
  const [localAssigned, setLocalAssigned] = useState(assignedUserIds);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsOpen(false));

  // Render-phase prop synchronization (React 19 pattern, no effect needed).
  if (syncedAssignedUserIds !== assignedUserIds) {
    setSyncedAssignedUserIds(assignedUserIds);
    setLocalAssigned(assignedUserIds);
  }

  function toggleAssignee(userId: string, isAssigned: boolean) {
    const nextAssigned = isAssigned
      ? localAssigned.filter((id) => id !== userId)
      : [...localAssigned, userId];
    setLocalAssigned(nextAssigned);
    onChange?.(nextAssigned);

    startTransition(async () => {
      if (isAssigned) {
        await unassignUserFromTask(taskId, userId);
      } else {
        await assignUserToTask(taskId, userId);
      }
      router.refresh();
    });
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <UserPlus className="h-3.5 w-3.5" />
        Ata
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-full z-40 mt-1 w-56 rounded-md border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {members.length === 0 ? (
              <p className="px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400">
                Proje üyesi yok.
              </p>
            ) : (
              members.map((member) => {
                const isAssigned = localAssigned.includes(member.id);
                return (
                  <label
                    key={member.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <input
                      type="checkbox"
                      checked={isAssigned}
                      onChange={() => toggleAssignee(member.id, isAssigned)}
                      className="h-3.5 w-3.5"
                    />
                    <Avatar name={member.name} size="sm" />
                    <span className="truncate text-zinc-700 dark:text-zinc-300">
                      {member.name}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
