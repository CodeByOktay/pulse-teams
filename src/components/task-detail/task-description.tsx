"use client";

import { useState, useTransition } from "react";
import { updateTask } from "@/actions/task";

export function TaskDescription({
  taskId,
  initialDescription,
}: {
  taskId: string;
  initialDescription: string;
}) {
  const [value, setValue] = useState(initialDescription);
  const [, startTransition] = useTransition();

  function handleBlur() {
    if (value === initialDescription) return;
    startTransition(async () => {
      await updateTask(taskId, { description: value });
    });
  }

  return (
    <textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      placeholder="Açıklama ekle..."
      rows={5}
      className="w-full resize-none rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-zinc-700 outline-none hover:border-zinc-200 focus:border-zinc-300 focus:bg-white dark:text-zinc-300 dark:hover:border-zinc-700 dark:focus:bg-zinc-800"
    />
  );
}
