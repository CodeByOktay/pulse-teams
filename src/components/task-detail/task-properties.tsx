"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTask, type UpdateTaskInput } from "@/actions/task";
import { LabelPicker, type LabelOption } from "@/components/labels/label-picker";
import { AssigneePicker, type AssigneeOption } from "@/components/assignees/assignee-picker";
import { LabelBadge } from "@/components/labels/label-badge";
import { Avatar } from "@/components/assignees/avatar";
import { StatusPicker } from "@/components/task-detail/status-picker";
import { PriorityPicker } from "@/components/task-detail/priority-picker";
import { DateField } from "@/components/task-detail/date-field";
import {
  formatTaskDate,
  resolveTaskSprintBadge,
  type TaskSprintBadge,
  type TaskSprintInfo,
} from "@/lib/task-detail-ux";
import type { Priority } from "@prisma/client";

export type StateOption = { id: string; name: string; color: string };

const SPRINT_BADGE_BASE_CLASS =
  "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium";

const SPRINT_BADGE_TONE: Record<string, string> = {
  ACTIVE: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  DRAFT: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  BACKLOG: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function toDateOrNull(value: string): Date | null {
  return value ? new Date(value) : null;
}

function toDisplayIso(value: string): string | null {
  return value ? `${value}T12:00:00.000Z` : null;
}

export function TaskProperties({
  taskId,
  projectId,
  currentStateId,
  currentPriority,
  states,
  availableLabels,
  selectedLabelIds,
  members,
  assignedUserIds,
  startDate,
  dueDate,
  createdAt,
  sprints,
  onLabelsChange,
  onAssigneesChange,
}: {
  taskId: string;
  projectId: string;
  currentStateId: string;
  currentPriority: Priority;
  states: StateOption[];
  availableLabels: LabelOption[];
  selectedLabelIds: string[];
  members: AssigneeOption[];
  assignedUserIds: string[];
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
  sprints: TaskSprintInfo[];
  onLabelsChange?: (labelIds: string[]) => void;
  onAssigneesChange?: (userIds: string[]) => void;
}) {
  const router = useRouter();
  const [startDateValue, setStartDateValue] = useState(toDateInputValue(startDate));
  const [dueDateValue, setDueDateValue] = useState(toDateInputValue(dueDate));
  const [, startTransition] = useTransition();

  function saveDate(data: UpdateTaskInput) {
    startTransition(async () => {
      await updateTask(taskId, data);
      router.refresh();
    });
  }

  function handleStartDateChange(value: string) {
    setStartDateValue(value);
    saveDate({ startDate: toDateOrNull(value) });
  }

  function handleDueDateChange(value: string) {
    setDueDateValue(value);
    saveDate({ dueDate: toDateOrNull(value) });
  }

  const selectedLabels = availableLabels.filter((label) => selectedLabelIds.includes(label.id));
  const assignedMembers = members.filter((member) => assignedUserIds.includes(member.id));
  const sprintBadge = resolveTaskSprintBadge(sprints);

  return (
    <div className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
      <PropertyRow label="Durum">
        <StatusPicker taskId={taskId} value={currentStateId} states={states} />
      </PropertyRow>

      <PropertyRow label="Öncelik">
        <PriorityPicker taskId={taskId} value={currentPriority} />
      </PropertyRow>

      <PropertyRow label="Atananlar">
        <div className="flex flex-wrap items-center gap-1.5">
          {assignedMembers.length === 0 ? (
            <span className="text-sm text-zinc-400">Atanmamış</span>
          ) : (
            assignedMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 pl-0.5 pr-2 text-xs dark:bg-zinc-800"
              >
                <Avatar name={member.name} size="sm" />
                {member.name}
              </div>
            ))
          )}
          <AssigneePicker
            taskId={taskId}
            members={members}
            assignedUserIds={assignedUserIds}
            onChange={onAssigneesChange}
          />
        </div>
      </PropertyRow>

      <PropertyRow label="Etiketler">
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedLabels.length === 0 ? (
            <span className="text-sm text-zinc-400">Etiket yok</span>
          ) : (
            selectedLabels.map((label) => (
              <LabelBadge key={label.id} name={label.name} color={label.color} />
            ))
          )}
          <LabelPicker
            taskId={taskId}
            projectId={projectId}
            availableLabels={availableLabels}
            selectedLabelIds={selectedLabelIds}
            onChange={onLabelsChange}
          />
        </div>
      </PropertyRow>

      <PropertyRow label="Sprint">
        <SprintBadge badge={sprintBadge} />
      </PropertyRow>

      <PropertyRow label="Başlangıç Tarihi">
        <DateField
          value={startDateValue}
          displayIso={toDisplayIso(startDateValue)}
          placeholder="Tarih Belirtilmedi"
          onChange={handleStartDateChange}
        />
      </PropertyRow>

      <PropertyRow label="Bitiş Tarihi">
        <DateField
          value={dueDateValue}
          displayIso={toDisplayIso(dueDateValue)}
          placeholder="Tarih Belirtilmedi"
          onChange={handleDueDateChange}
        />
      </PropertyRow>

      <PropertyRow label="Oluşturulma Tarihi">
        <span className="text-sm text-zinc-400">{formatTaskDate(createdAt)}</span>
      </PropertyRow>
    </div>
  );
}

function SprintBadge({ badge }: { badge: TaskSprintBadge }) {
  const { label, tone } =
    badge.kind === "backlog"
      ? { label: "Backlog", tone: SPRINT_BADGE_TONE.BACKLOG }
      : { label: badge.name, tone: SPRINT_BADGE_TONE[badge.status] ?? SPRINT_BADGE_TONE.DRAFT };

  return <span className={`${SPRINT_BADGE_BASE_CLASS} ${tone}`}>{label}</span>;
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_1fr] items-start gap-2 py-2.5">
      <span className="pt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
