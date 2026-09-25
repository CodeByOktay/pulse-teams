"use client";

import { useRouter, useSearchParams } from "next/navigation";

const STATUS_LABELS: Record<"DRAFT" | "ACTIVE" | "COMPLETED", string> = {
  DRAFT: "Taslak",
  ACTIVE: "Aktif",
  COMPLETED: "Tamamlandı",
};

export function SprintPicker({
  projectId,
  sprints,
  selectedSprintId,
}: {
  projectId: string;
  sprints: Array<{ id: string; name: string; status: "DRAFT" | "ACTIVE" | "COMPLETED" }>;
  selectedSprintId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (sprints.length === 0) {
    return null;
  }

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("sprint", value);
    } else {
      params.delete("sprint");
    }
    router.push(`/projects/${projectId}/analytics?${params.toString()}`);
  };

  return (
    <select
      value={selectedSprintId ?? ""}
      onChange={(e) => handleChange(e.target.value)}
      aria-label="Sprint seç"
      className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 outline-none hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
    >
      {sprints.map((sprint) => (
        <option key={sprint.id} value={sprint.id}>
          {sprint.name} ({STATUS_LABELS[sprint.status]})
        </option>
      ))}
    </select>
  );
}
