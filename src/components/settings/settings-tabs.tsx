"use client";

import { useState } from "react";
import { StatesManager, type StateItem } from "@/components/settings/states-manager";
import { LabelsManager, type LabelItem } from "@/components/settings/labels-manager";
import { MembersManager, type MemberItem, type PendingInviteItem } from "@/components/settings/members-manager";
import {
  AgentSettingsManager,
  type AgentPmCandidate,
  type AgentSettingItem,
} from "@/components/settings/agent-settings-manager";

export function SettingsTabs({
  projectId,
  ownerId,
  currentUserId,
  states,
  labels,
  members,
  pendingInvites,
  agentPmCandidates,
  agentPmUserId,
  agentSettings,
}: {
  projectId: string;
  ownerId: string;
  currentUserId: string;
  states: StateItem[];
  labels: LabelItem[];
  members: MemberItem[];
  pendingInvites: PendingInviteItem[];
  agentPmCandidates: AgentPmCandidate[];
  agentPmUserId: string | null;
  agentSettings: AgentSettingItem[];
}) {
  const [tab, setTab] = useState<"states" | "labels" | "members" | "agents">("states");

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
        <button
          type="button"
          onClick={() => setTab("members")}
          className={tabClass(tab === "members")}
        >
          Üyeler
        </button>
        <button
          type="button"
          onClick={() => setTab("agents")}
          className={tabClass(tab === "agents")}
        >
          AI Ajanlar
        </button>
      </div>

      {tab === "states" ? (
        <StatesManager states={states} projectId={projectId} />
      ) : tab === "labels" ? (
        <LabelsManager labels={labels} projectId={projectId} />
      ) : tab === "members" ? (
        <MembersManager
          projectId={projectId}
          ownerId={ownerId}
          currentUserId={currentUserId}
          members={members}
          pendingInvites={pendingInvites}
        />
      ) : (
        <AgentSettingsManager
          projectId={projectId}
          pmCandidates={agentPmCandidates}
          pmUserId={agentPmUserId}
          agents={agentSettings}
        />
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

