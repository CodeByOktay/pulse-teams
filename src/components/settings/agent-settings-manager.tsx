"use client";

import { useRef, useState, useTransition } from "react";
import { CalendarClock, ClipboardList, MessageCircleQuestionMark } from "lucide-react";
import { updateProjectAgentSetting, updateProjectPmUser } from "@/actions/agent-settings";

export type AgentPmCandidate = { id: string; name: string; email: string };

export type AgentKey = "agent-001" | "agent-002" | "agent-003";

export type AgentSettingItem = {
  agentKey: AgentKey;
  enabled: boolean;
  config: { inactivityDays?: number };
};

type AgentRuntimeState = { enabled: boolean; inactivityDays: number };

const MIN_INACTIVITY_DAYS = 1;
const MAX_INACTIVITY_DAYS = 30;
const DEFAULT_INACTIVITY_DAYS = 3;

const AGENT_DEFINITIONS: {
  key: AgentKey;
  title: string;
  description: string;
  icon: typeof CalendarClock;
}[] = [
  {
    key: "agent-001",
    title: "Deadline Takipçisi",
    description: "Yaklaşan ve geciken teslim tarihlerini hatırlatır, yöneticilere eskalasyon yapar.",
    icon: CalendarClock,
  },
  {
    key: "agent-002",
    title: "Görev Hijyeni",
    description: "Sahipsiz, tarihsiz veya eksik açıklamalı görevleri tespit eder.",
    icon: ClipboardList,
  },
  {
    key: "agent-003",
    title: "Durum İsteyici",
    description: "Uzun süre hareketsiz kalan görevler için butonlu ilerleme durumu sorar.",
    icon: MessageCircleQuestionMark,
  },
];

function clampInactivityDays(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_INACTIVITY_DAYS;
  return Math.min(MAX_INACTIVITY_DAYS, Math.max(MIN_INACTIVITY_DAYS, Math.round(value)));
}

function buildAgentState(agents: AgentSettingItem[]): Record<AgentKey, AgentRuntimeState> {
  const byKey = new Map(agents.map((a) => [a.agentKey, a]));
  const result = {} as Record<AgentKey, AgentRuntimeState>;
  for (const def of AGENT_DEFINITIONS) {
    const item = byKey.get(def.key);
    result[def.key] = {
      enabled: item?.enabled ?? true,
      inactivityDays: clampInactivityDays(item?.config?.inactivityDays ?? DEFAULT_INACTIVITY_DAYS),
    };
  }
  return result;
}

export function AgentSettingsManager({
  projectId,
  pmCandidates,
  pmUserId,
  agents,
}: {
  projectId: string;
  pmCandidates: AgentPmCandidate[];
  pmUserId: string | null;
  agents: AgentSettingItem[];
}) {
  const [syncedPmUserId, setSyncedPmUserId] = useState(pmUserId);
  const [selectedPmUserId, setSelectedPmUserId] = useState(pmUserId);
  const [syncedAgents, setSyncedAgents] = useState(agents);
  const [agentState, setAgentState] = useState<Record<AgentKey, AgentRuntimeState>>(() =>
    buildAgentState(agents),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const latestPmUserIdRef = useRef(pmUserId);
  const latestAgentStateRef = useRef(buildAgentState(agents));

  // Render-phase prop synchronization (React 19 pattern, no effect needed).
  if (syncedPmUserId !== pmUserId) {
    setSyncedPmUserId(pmUserId);
    setSelectedPmUserId(pmUserId);
    latestPmUserIdRef.current = pmUserId;
  }
  if (syncedAgents !== agents) {
    setSyncedAgents(agents);
    const next = buildAgentState(agents);
    setAgentState(next);
    latestAgentStateRef.current = next;
  }

  const selectedPmCandidate = pmCandidates.find((c) => c.id === selectedPmUserId) ?? null;
  const pmDisplayName = selectedPmCandidate ? selectedPmCandidate.name : "proje sahibi";

  function rollbackPmUser() {
    setSelectedPmUserId(latestPmUserIdRef.current);
  }

  function rollbackAgent(key: AgentKey) {
    setAgentState((prev) => ({ ...prev, [key]: latestAgentStateRef.current[key] }));
  }

  function handlePmChange(value: string) {
    const nextPmUserId = value === "" ? null : value;
    const previousPmUserId = selectedPmUserId;
    if (nextPmUserId === previousPmUserId) return;

    setError(null);
    setSelectedPmUserId(nextPmUserId);
    startTransition(async () => {
      try {
        await updateProjectPmUser(projectId, nextPmUserId);
        latestPmUserIdRef.current = nextPmUserId;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Proje temsilcisi güncellenemedi.");
        rollbackPmUser();
      }
    });
  }

  function handleToggle(key: AgentKey) {
    setError(null);
    const nextEnabled = !agentState[key].enabled;
    setAgentState((prev) => ({ ...prev, [key]: { ...prev[key], enabled: nextEnabled } }));
    startTransition(async () => {
      try {
        await updateProjectAgentSetting(projectId, key, { enabled: nextEnabled });
        latestAgentStateRef.current = {
          ...latestAgentStateRef.current,
          [key]: { ...latestAgentStateRef.current[key], enabled: nextEnabled },
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ajan durumu güncellenemedi.");
        rollbackAgent(key);
      }
    });
  }

  function handleInactivityDaysCommit(key: AgentKey, rawValue: number) {
    const clamped = clampInactivityDays(rawValue);
    if (clamped === agentState[key].inactivityDays) return;

    setError(null);
    setAgentState((prev) => ({ ...prev, [key]: { ...prev[key], inactivityDays: clamped } }));
    startTransition(async () => {
      try {
        await updateProjectAgentSetting(projectId, key, { config: { inactivityDays: clamped } });
        latestAgentStateRef.current = {
          ...latestAgentStateRef.current,
          [key]: { ...latestAgentStateRef.current[key], inactivityDays: clamped },
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Hareketsizlik günü güncellenemedi.");
        rollbackAgent(key);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Proje Temsilcisi (PM)
        </h3>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          AI Asistan bildirim ve talepleri bu yöneticinin adına ({pmDisplayName} adına Pulse Asistan)
          iletir.
        </p>
        <select
          value={selectedPmUserId ?? ""}
          onChange={(e) => handlePmChange(e.target.value)}
          disabled={isPending}
          className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-500"
        >
          <option value="">Seçilmedi — proje sahibi kullanılır</option>
          {pmCandidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name} ({candidate.email})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-3">
        {AGENT_DEFINITIONS.map((def) => (
          <AgentCard
            key={def.key}
            definition={def}
            enabled={agentState[def.key].enabled}
            inactivityDays={agentState[def.key].inactivityDays}
            disabled={isPending}
            onToggle={() => handleToggle(def.key)}
            onInactivityDaysCommit={(value) => handleInactivityDaysCommit(def.key, value)}
          />
        ))}
      </div>
    </div>
  );
}

function AgentCard({
  definition,
  enabled,
  inactivityDays,
  disabled,
  onToggle,
  onInactivityDaysCommit,
}: {
  definition: (typeof AGENT_DEFINITIONS)[number];
  enabled: boolean;
  inactivityDays: number;
  disabled: boolean;
  onToggle: () => void;
  onInactivityDaysCommit: (value: number) => void;
}) {
  const Icon = definition.icon;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {definition.title}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{definition.description}</p>
          </div>
        </div>
        <ToggleSwitch
          checked={enabled}
          disabled={disabled}
          onChange={onToggle}
          label={`${definition.title} ajanını aç/kapat`}
        />
      </div>

      {definition.key === "agent-003" ? (
        <div className="mt-3 flex items-center gap-2 pl-11">
          <label
            htmlFor={`${definition.key}-inactivity-days`}
            className="text-xs text-zinc-500 dark:text-zinc-400"
          >
            Hareketsizlik Günü
          </label>
          <InactivityDaysInput
            id={`${definition.key}-inactivity-days`}
            value={inactivityDays}
            disabled={disabled || !enabled}
            onCommit={onInactivityDaysCommit}
          />
        </div>
      ) : null}
    </div>
  );
}

function InactivityDaysInput({
  id,
  value,
  disabled,
  onCommit,
}: {
  id: string;
  value: number;
  disabled: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [syncedValue, setSyncedValue] = useState(value);

  // Render-phase prop synchronization (React 19 pattern, no effect needed).
  if (syncedValue !== value) {
    setSyncedValue(value);
    setDraft(String(value));
  }

  function commit() {
    const parsed = Number(draft);
    onCommit(Number.isFinite(parsed) ? parsed : value);
    setDraft(String(value));
  }

  return (
    <input
      id={id}
      type="number"
      min={MIN_INACTIVITY_DAYS}
      max={MAX_INACTIVITY_DAYS}
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          e.currentTarget.blur();
        }
      }}
      className="w-16 rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-500"
    />
  );
}

function ToggleSwitch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-700"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform dark:bg-zinc-900 ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
