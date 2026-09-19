"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTask } from "@/actions/task";
import { shouldUpdatePriority, resolveOptimisticState } from "@/lib/task-detail-ux";
import { InlineSelectPopover } from "@/components/task-detail/inline-select-popover";
import type { Priority } from "@prisma/client";

const PRIORITY_OPTIONS: { value: Priority; label: string; icon: string }[] = [
  { value: "NONE", label: "Yok", icon: "⚪" },
  { value: "LOW", label: "Düşük", icon: "🔵" },
  { value: "MEDIUM", label: "Orta", icon: "🟡" },
  { value: "HIGH", label: "Yüksek", icon: "🟠" },
  { value: "URGENT", label: "Acil", icon: "🔴" },
];

export function PriorityPicker({ taskId, value }: { taskId: string; value: Priority }) {
  const router = useRouter();
  const [priority, setPriority] = useState<Priority>(value);

  const current = PRIORITY_OPTIONS.find((option) => option.value === priority) ?? PRIORITY_OPTIONS[0];

  async function handleSelect(next: string) {
    const nextPriority = next as Priority;
    if (!shouldUpdatePriority(priority, nextPriority)) return;
    const previous = priority;
    setPriority(nextPriority);

    try {
      await updateTask(taskId, { priority: nextPriority });
      router.refresh();
    } catch {
      setPriority(resolveOptimisticState(false, nextPriority, previous));
    }
  }

  return (
    <InlineSelectPopover
      ariaLabel="Öncelik seç"
      selectedId={priority}
      onSelect={handleSelect}
      trigger={
        <>
          <span>{current.icon}</span>
          <span className="truncate text-zinc-700 dark:text-zinc-300">{current.label}</span>
        </>
      }
      options={PRIORITY_OPTIONS.map((option) => ({
        id: option.value,
        label: (
          <span className="flex items-center gap-2">
            <span>{option.icon}</span>
            {option.label}
          </span>
        ),
      }))}
    />
  );
}
