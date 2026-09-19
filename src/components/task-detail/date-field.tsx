"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";
import { formatTaskDate } from "@/lib/task-detail-ux";

export function DateField({
  value,
  displayIso,
  placeholder,
  onChange,
}: {
  value: string;
  displayIso: string | null;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <input
        autoFocus
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setIsEditing(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") setIsEditing(false);
        }}
        className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="flex w-full items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-left text-sm hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
    >
      <Calendar className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
      <span className={displayIso ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400"}>
        {formatTaskDate(displayIso, placeholder)}
      </span>
    </button>
  );
}
