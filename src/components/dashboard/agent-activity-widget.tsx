import { Bot, CalendarClock, AlertTriangle, Clock } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { RecentAgentActivity } from "@/actions/agent-settings";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  SUCCESS: {
    label: "Başarılı",
    className: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  },
  FAILED: {
    label: "Başarısız",
    className: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
  },
  SKIPPED: {
    label: "Atlandı",
    className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  },
  RUNNING: {
    label: "Çalışıyor",
    className: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  },
};

function resolveStatusBadge(status: string) {
  return (
    STATUS_BADGE[status] ?? {
      label: status,
      className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    }
  );
}

const LAST_RUN_FORMATTER = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function AgentActivityWidget({ activity }: { activity: RecentAgentActivity }) {
  const statusBadge = activity.lastRun ? resolveStatusBadge(activity.lastRun.status) : null;
  const lastRunLabel = activity.lastRun
    ? LAST_RUN_FORMATTER.format(new Date(activity.lastRun.atIso))
    : null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <Bot className="h-4 w-4 text-zinc-400" />
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Agent Aktiviteleri (Son 7 Gün)
        </h2>
      </div>

      {activity.runCount === 0 ? (
        <EmptyState icon={Bot} title="Agent henüz bir işlem gerçekleştirmedi" />
      ) : (
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-500 dark:bg-blue-950 dark:text-blue-400">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {activity.remindersSent}
              </p>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">Hatırlatmalar</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-500 dark:bg-amber-950 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {activity.escalationsSent}
              </p>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">Eskalasyonlar</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-500 dark:bg-violet-950 dark:text-violet-400">
              <Clock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {lastRunLabel ?? "-"}
                </p>
                {statusBadge ? (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge.className}`}
                  >
                    {statusBadge.label}
                  </span>
                ) : null}
              </div>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">Son Çalışma</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
