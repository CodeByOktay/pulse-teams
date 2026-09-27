"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, Check, Loader2, Pencil, Sparkles, X } from "lucide-react";
import { approveProposal, rejectProposal } from "@/actions/agent-proposal";
import { Avatar } from "@/components/assignees/avatar";
import type { getTaskProgressData } from "@/actions/progress";

type ProposalsData = Awaited<ReturnType<typeof getTaskProgressData>>["proposals"];
type ProposalState = ProposalsData["states"][number];

type ActiveAction = "approve" | "reject" | "override";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
}

function StateDot({ color }: { color: string }) {
  return (
    <span
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

export function AgentProposalCard({
  proposal,
  currentState,
  states,
  currentAssignees,
  onResolved,
}: {
  proposal: NonNullable<ProposalsData["pending"]>;
  currentState: ProposalState;
  states: ProposalState[];
  /** Görevin şu anki atanmış kişileri (Agent-007 iş yükü yeniden atama önerisi için). */
  currentAssignees?: { id: string; name: string }[];
  // Hata varsa mesaj iletilir; üst bileşen yeniden yükler ve hatayı gösterir (öneri bayatlamış olabilir).
  onResolved: (error?: string) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState(proposal.suggestedStateId ?? currentState.id);
  const [activeAction, setActiveAction] = useState<ActiveAction | null>(null);
  const [isPending, startTransition] = useTransition();

  const suggestedState = proposal.suggestedState;
  const hasStateChange = suggestedState !== null && suggestedState.id !== currentState.id;
  const isReassignment = proposal.suggestedAssigneeId !== null;
  const suggestedAssignee = proposal.suggestedAssignee;
  const confidencePercent = Math.round(proposal.confidence * 100);

  function run(action: ActiveAction, task: () => Promise<unknown>) {
    setActiveAction(action);
    startTransition(async () => {
      let failure: string | undefined;
      try {
        await task();
      } catch (err) {
        failure = errorMessage(err);
      }
      await onResolved(failure);
      setActiveAction(null);
    });
  }

  function spinnerOr(action: ActiveAction, icon: React.ReactNode) {
    return isPending && activeAction === action ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
    ) : (
      icon
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50 p-3 shadow-[0_0_0_1px_rgba(99,102,241,0.08),0_4px_16px_-4px_rgba(99,102,241,0.25)] dark:border-indigo-800 dark:from-indigo-950/40 dark:to-purple-950/40 dark:shadow-[0_0_0_1px_rgba(129,140,248,0.10),0_4px_16px_-4px_rgba(129,140,248,0.20)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-indigo-900 dark:text-indigo-200">
          <Sparkles className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
          AI Önerisi
        </div>
        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
          %{confidencePercent} Güven
        </span>
      </div>

      <p className="text-sm text-zinc-700 dark:text-zinc-200">{proposal.summary}</p>

      {hasStateChange && suggestedState && (
        <div className="inline-flex w-fit items-center gap-2 rounded-md border border-indigo-200 bg-white/70 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:border-indigo-900 dark:bg-zinc-900/60 dark:text-zinc-200">
          <span className="inline-flex items-center gap-1.5">
            <StateDot color={currentState.color} />
            {currentState.name}
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
          <span className="inline-flex items-center gap-1.5">
            <StateDot color={suggestedState.color} />
            {suggestedState.name}
          </span>
        </div>
      )}

      {isReassignment && suggestedAssignee && (
        <div className="inline-flex w-fit items-center gap-2 rounded-md border border-indigo-200 bg-white/70 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:border-indigo-900 dark:bg-zinc-900/60 dark:text-zinc-200">
          <span className="inline-flex items-center gap-1.5">
            {currentAssignees && currentAssignees.length > 0 ? (
              currentAssignees.map((assignee) => <Avatar key={assignee.id} name={assignee.name} size="sm" />)
            ) : (
              <span className="text-zinc-500 dark:text-zinc-400">Atanmamış</span>
            )}
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
          <span className="inline-flex items-center gap-1.5">
            <Avatar name={suggestedAssignee.name} size="sm" />
            {suggestedAssignee.name}
          </span>
        </div>
      )}

      {proposal.blockerDetected && (
        <div className="inline-flex w-fit items-center gap-1.5 rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          {proposal.blockerDetails ?? "Engel bildirildi"}
        </div>
      )}

      {proposal.followUpNeeded && (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">Takip gerekli</span>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => run("approve", () => approveProposal(proposal.id))}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-400"
        >
          {spinnerOr("approve", <Check className="h-3.5 w-3.5" />)}
          {isReassignment ? "Kabul Et ve Devret" : hasStateChange ? "Kabul Et ve Uygula" : "Kabul Et"}
        </button>
        <button
          type="button"
          onClick={() => run("reject", () => rejectProposal(proposal.id))}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-white/70 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {spinnerOr("reject", <X className="h-3.5 w-3.5" />)}
          Reddet
        </button>
        {!isReassignment && (
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            disabled={isPending}
            aria-expanded={editing}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-white/70 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Pencil className="h-3.5 w-3.5" />
            Düzenle
          </button>
        )}
      </div>

      {!isReassignment && editing && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-indigo-200 bg-white/70 p-2 dark:border-indigo-900 dark:bg-zinc-900/60">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={isPending}
            aria-label="Uygulanacak durum"
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            {states.map((state) => (
              <option key={state.id} value={state.id}>
                {state.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => run("override", () => approveProposal(proposal.id, selectedId))}
            disabled={isPending || !selectedId}
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {spinnerOr("override", null)}
            Bu durumla uygula
          </button>
        </div>
      )}
    </div>
  );
}
