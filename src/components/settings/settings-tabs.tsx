"use client";

import { useState } from "react";
import { StatesManager, type StateItem } from "@/components/settings/states-manager";
import { LabelsManager, type LabelItem } from "@/components/settings/labels-manager";

export function SettingsTabs({
  projectId,
  states,
  labels,
}: {
  projectId: string;
  states: StateItem[];
  labels: LabelItem[];
}) {
  const [tab, setTab] = useState<"states" | "labels">("states");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setTab("states")}
          className={tabClass(tab === "states")}
        >
          Durumlar
        </button>
        <button
          type="button"
          onClick={() => setTab("labels")}
          className={tabClass(tab === "labels")}
        >
          Etiketler
        </button>
      </div>

      {tab === "states" ? (
        <StatesManager states={states} projectId={projectId} />
      ) : (
        <LabelsManager labels={labels} projectId={projectId} />
      )}
    </div>
  );
}

function tabClass(isActive: boolean): string {
  return `px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
      : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
  }`;
}
