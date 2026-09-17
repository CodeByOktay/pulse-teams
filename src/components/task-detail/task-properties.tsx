"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTask } from "@/actions/task";
import { LabelPicker, type LabelOption } from "@/components/labels/label-picker";
import { AssigneePicker, type AssigneeOption } from "@/components/assignees/assignee-picker";
import { LabelBadge } from "@/components/labels/label-badge";
import { Avatar } from "@/components/assignees/avatar";
import type { Priority } from "@prisma/client";

const PRIORITY_OPTIONS: { value: Priority; label: string; icon: string }[] = [
  { value: "NONE", label: "Yok", icon: "⚪" },
  { value: "LOW", label: "Düşük", icon: "🔵" },
  { value: "MEDIUM", label: "Orta", icon: "🟡" },
  { value: "HIGH", label: "Yüksek", icon: "🟠" },
  { value: "URGENT", label: "Acil", icon: "🔴" },
];

export type StateOption = { id: string; name: string; color: string };

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
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
  onLabelsChange?: (labelIds: string[]) => void;
  onAssigneesChange?: (userIds: string[]) => void;
}) {
  const router = useRouter();
  const [stateId, setStateId] = useState(currentStateId);
  const [priority, setPriority] = useState(currentPriority);
  const [startDateValue, setStartDateValue] = useState(toDateInputValue(startDate));
  const [dueDateValue, setDueDateValue] = useState(toDateInputValue(dueDate));
  const [, startTransition] = useTransition();

  function handleStateChange(value: string) {
    setStateId(value);
    startTransition(async () => {
      await updateTask(taskId, { stateId: value });
      router.refresh();
    });
  }

  function handlePriorityChange(value: Priority) {
    setPriority(value);
    startTransition(async () => {
      await updateTask(taskId, { priority: value });
      router.refresh();
    });
  }

  function handleStartDateChange(value: string) {
    setStartDateValue(value);
    startTransition(async () => {
      await updateTask(taskId, { startDate: value ? new Date(value) : null });
      router.refresh();
    });
  }

  function handleDueDateChange(value: string) {
    setDueDateValue(value);
    startTransition(async () => {
      await updateTask(taskId, { dueDate: value ? new Date(value) : null });
      router.refresh();
    });
  }

  const selectedLabels = availableLabels.filter((label) => selectedLabelIds.includes(label.id));
  const assignedMembers = members.filter((member) => assignedUserIds.includes(member.id));

  return (
    <div className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
      <PropertyRow label="State">
        <select
          value={stateId}
          onChange={(e) => handleStateChange(e.target.value)}
          className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {states.map((state) => (
            <option key={state.id} value={state.id}>
              {state.name}
            </option>
          ))}
        </select>
      </PropertyRow>

      <PropertyRow label="Priority">
        <select
          value={priority}
          onChange={(e) => handlePriorityChange(e.target.value as Priority)}
          className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.icon} {option.label}
            </option>
          ))}
        </select>
      </PropertyRow>

      <PropertyRow label="Assignees">
        <div className="flex flex-wrap items-center gap-1.5">
          {assignedMembers.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 pl-0.5 pr-2 text-xs dark:bg-zinc-800"
            >
              <Avatar name={member.name} size="sm" />
              {member.name}
            </div>
          ))}
          <AssigneePicker
            taskId={taskId}
            members={members}
            assignedUserIds={assignedUserIds}
            onChange={onAssigneesChange}
          />
        </div>
      </PropertyRow>

      <PropertyRow label="Labels">
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedLabels.map((label) => (
            <LabelBadge key={label.id} name={label.name} color={label.color} />
          ))}
          <LabelPicker
            taskId={taskId}
            projectId={projectId}
            availableLabels={availableLabels}
            selectedLabelIds={selectedLabelIds}
            onChange={onLabelsChange}
          />
        </div>
      </PropertyRow>

      <PropertyRow label="Start Date">
        <input
          type="date"
          value={startDateValue}
          onChange={(e) => handleStartDateChange(e.target.value)}
          className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </PropertyRow>

      <PropertyRow label="Due Date">
        <input
          type="date"
          value={dueDateValue}
          onChange={(e) => handleDueDateChange(e.target.value)}
          className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </PropertyRow>

      <PropertyRow label="Oluşturulma">
        <span className="text-sm text-zinc-400">
          {new Date(createdAt).toLocaleDateString("tr-TR")}
        </span>
      </PropertyRow>
    </div>
  );
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 py-3">
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
      {children}
    </div>
  );
}
