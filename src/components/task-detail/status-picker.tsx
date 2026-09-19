"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTask } from "@/actions/task";
import { shouldUpdateState, resolveOptimisticState } from "@/lib/task-detail-ux";
import { InlineSelectPopover } from "@/components/task-detail/inline-select-popover";
import type { StateOption } from "@/components/task-detail/task-properties";

export function StatusPicker({
  taskId,
  value,
  states,
}: {
  taskId: string;
  value: string;
  states: StateOption[];
}) {
  const router = useRouter();
  const [stateId, setStateId] = useState(value);

  const current = states.find((state) => state.id === stateId);

  async function handleSelect(nextStateId: string) {
    if (!shouldUpdateState(stateId, nextStateId)) return;
    const previous = stateId;
    setStateId(nextStateId);

    try {
      await updateTask(taskId, { stateId: nextStateId });
      router.refresh();
    } catch {
      setStateId(resolveOptimisticState(false, nextStateId, previous));
    }
  }

  return (
    <InlineSelectPopover
      ariaLabel="Durum seç"
      selectedId={stateId}
      onSelect={handleSelect}
      trigger={
        <>
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: current?.color }}
          />
          <span className="truncate text-zinc-700 dark:text-zinc-300">
            {current?.name ?? "—"}
          </span>
        </>
      }
      options={states.map((state) => ({
        id: state.id,
        label: (
          <span className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: state.color }}
            />
            {state.name}
          </span>
        ),
      }))}
    />
  );
}
