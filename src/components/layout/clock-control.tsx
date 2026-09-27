"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Clock,
  RotateCcw,
  Zap,
  Check,
  AlertTriangle,
  Loader2,
  Calendar,
  X,
  Sparkles,
} from "lucide-react";
import {
  getAppClockAction,
  resetAppClockAction,
  setAppClockAction,
  triggerSimulatedAgentsAction,
  type AgentSimulationResult,
  type SerializedClockStatus,
} from "@/actions/clock";
import { useClickOutside } from "@/lib/use-click-outside";

function formatDateTimeForInput(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
}

function formatDisplayDateTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return d.toLocaleString("tr-TR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoStr;
  }
}

export function ClockControl() {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<SerializedClockStatus | null>(null);
  const [customInput, setCustomInput] = useState("");
  const [agentResult, setAgentResult] = useState<AgentSimulationResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useClickOutside(popoverRef, () => setIsOpen(false));

  const refreshClock = () => {
    startTransition(async () => {
      try {
        const current = await getAppClockAction();
        setStatus(current);
        if (current.mockTimeIso) {
          setCustomInput(formatDateTimeForInput(new Date(current.mockTimeIso)));
        } else {
          setCustomInput(formatDateTimeForInput(new Date(current.nowIso)));
        }
      } catch (err) {
        console.error("Failed to load clock status:", err);
      }
    });
  };

  useEffect(() => {
    refreshClock();
  }, []);

  const handleApplyCustomTime = (targetIso?: string) => {
    const isoToSet = targetIso || (customInput ? new Date(customInput).toISOString() : null);
    if (!isoToSet) return;

    startTransition(async () => {
      try {
        const updated = await setAppClockAction(isoToSet);
        setStatus(updated);
        setAgentResult(null);
      } catch (err) {
        console.error("Failed to set app clock:", err);
      }
    });
  };

  const handleResetToRealTime = () => {
    startTransition(async () => {
      try {
        const updated = await resetAppClockAction();
        setStatus(updated);
        setCustomInput(formatDateTimeForInput(new Date(updated.nowIso)));
        setAgentResult(null);
      } catch (err) {
        console.error("Failed to reset app clock:", err);
      }
    });
  };

  const handleQuickPreset = (offsetMinutes: number, setHourNine = false) => {
    const base = status?.isMocked && status.mockTimeIso
      ? new Date(status.mockTimeIso)
      : new Date();

    const target = new Date(base.getTime() + offsetMinutes * 60 * 1000);
    if (setHourNine) {
      target.setHours(9, 0, 0, 0);
    }

    setCustomInput(formatDateTimeForInput(target));
    handleApplyCustomTime(target.toISOString());
  };

  const handleRunAgents = async () => {
    setIsAgentRunning(true);
    setAgentResult(null);
    try {
      const res = await triggerSimulatedAgentsAction();
      setAgentResult(res);
      // Refresh clock status
      const updated = await getAppClockAction();
      setStatus(updated);
    } catch (err) {
      console.error("Agent simulation run failed:", err);
    } finally {
      setIsAgentRunning(false);
    }
  };

  const isMocked = status?.isMocked ?? false;

  return (
    <div ref={popoverRef} className="relative inline-block text-left">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) refreshClock();
        }}
        data-testid="clock-control-trigger"
        aria-label="Zaman Makinesi ve Simülasyon Saati"
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
          isMocked
            ? "border border-amber-500/40 bg-amber-500/10 text-amber-600 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-400"
            : "border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        }`}
      >
        <Clock className={`h-3.5 w-3.5 shrink-0 ${isMocked ? "text-amber-500 animate-pulse" : "text-zinc-500"}`} />
        <span className="font-mono">
          {status ? (isMocked ? formatDisplayDateTime(status.nowIso) : formatDisplayDateTime(status.nowIso)) : "--:--"}
        </span>
        {isMocked && (
          <span className="rounded bg-amber-500/20 px-1 py-0.2 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
            Simüle
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          data-testid="clock-control-popover"
          className="absolute right-0 top-full z-50 mt-2 w-96 rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isMocked ? "bg-amber-500/15 text-amber-500" : "bg-indigo-500/10 text-indigo-500"}`}>
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  Zaman Makinesi (Test Saati)
                </h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  TS servisleri ve Python AI agent'ları bu zamanı temel alır.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Current State Info */}
          <div className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50 p-2.5 dark:border-zinc-800/80 dark:bg-zinc-950/60">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500 dark:text-zinc-400">Aktif Durum:</span>
              {isMocked ? (
                <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 font-medium text-amber-600 dark:text-amber-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                  Simülasyon Aktif
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3 w-3" />
                  Gerçek Sistem Saati
                </span>
              )}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs font-mono font-medium text-zinc-800 dark:text-zinc-200">
              <span>Şu anki zaman:</span>
              <span>{status ? formatDisplayDateTime(status.nowIso) : "--"}</span>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="mt-3">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Hızlı Atlama Presetleri
            </label>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-xs">
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleQuickPreset(60)}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                +1 Saat
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleQuickPreset(24 * 60)}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                +1 Gün
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleQuickPreset(3 * 24 * 60)}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                +3 Gün
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleQuickPreset(24 * 60, true)}
                className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-amber-700 hover:bg-amber-500/10 disabled:opacity-50 dark:text-amber-300 dark:hover:bg-amber-500/15 transition-colors col-span-2"
              >
                🎯 Yarın 09:00 (Agent Saati)
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleQuickPreset(3 * 24 * 60, true)}
                className="rounded-md border border-indigo-500/30 bg-indigo-500/5 px-2 py-1.5 text-indigo-700 hover:bg-indigo-500/10 disabled:opacity-50 dark:text-indigo-300 dark:hover:bg-indigo-500/15 transition-colors"
              >
                +3 Gün 09:00
              </button>
            </div>
          </div>

          {/* Custom Date Time Input */}
          <div className="mt-3">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Özel Tarih & Saat
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                type="datetime-local"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                className="flex-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <button
                type="button"
                disabled={isPending || !customInput}
                onClick={() => handleApplyCustomTime()}
                className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Uygula
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            {isMocked && (
              <button
                type="button"
                disabled={isPending}
                onClick={handleResetToRealTime}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-red-200 bg-red-50/50 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Gerçek Sistem Saatine Dön
              </button>
            )}

            <button
              type="button"
              disabled={isAgentRunning || isPending}
              onClick={handleRunAgents}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700/80 transition-colors"
            >
              {isAgentRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
              ) : (
                <Zap className="h-3.5 w-3.5 text-amber-500" />
              )}
              Simüle Saatte AI Agent'ları Çalıştır (001 / 002 / 003)
            </button>
          </div>

          {/* Agent Simulation Output Box */}
          {agentResult && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5 text-xs text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-200">
              <div className="flex items-center gap-1 font-semibold text-emerald-800 dark:text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" />
                Agent Çalışması Tamamlandı
              </div>
              <ul className="mt-1.5 space-y-0.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                <li>
                  • <strong>Agent-001 (Deadline):</strong> {agentResult.deadlineResult.remindersSent} hatırlatma,{" "}
                  {agentResult.deadlineResult.escalationsSent} eskalasyon
                </li>
                <li>
                  • <strong>Agent-002 (Hijyen):</strong> {agentResult.hygieneResult.tasksScanned} tarandı,{" "}
                  {agentResult.hygieneResult.defectiveTasks} kusurlu görev
                </li>
                <li>
                  • <strong>Agent-003 (Durum):</strong> {agentResult.statusResult.requestsOpened} istek açıldı,{" "}
                  {agentResult.statusResult.requestsExpired} zaman aşımı
                </li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
