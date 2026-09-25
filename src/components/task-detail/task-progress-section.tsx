"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, ClipboardList, Clock, Loader2 } from "lucide-react";
import {
  createProgressRequest,
  getTaskProgressData,
  submitProgressResponse,
} from "@/actions/progress";
import { MarkdownRenderer } from "@/components/markdown/markdown-renderer";
import { formatRelativeTime } from "@/lib/analytics-logic";
import {
  PROGRESS_RESPONSE_MAX_LENGTH,
  canRequestProgress,
  validateProgressResponseContent,
} from "@/lib/progress-logic";

type ProgressData = Awaited<ReturnType<typeof getTaskProgressData>>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
}

export function TaskProgressSection({
  taskId,
  currentUserId,
  refreshKey,
  onChanged,
}: {
  taskId: string;
  currentUserId: string;
  refreshKey?: string;
  onChanged?: () => void;
}) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [recipientId, setRecipientId] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showOlder, setShowOlder] = useState(false);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    try {
      const next = await getTaskProgressData(taskId);
      setData(next);
      setRecipientId((current) =>
        next.assignees.some((assignee) => assignee.id === current)
          ? current
          : (next.assignees[0]?.id ?? ""),
      );
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (!data) {
    return null;
  }

  const { pending, history, assignees } = data;
  const check = canRequestProgress(data.taskStateGroup, assignees.length, pending !== null);
  const isRecipient = pending !== null && pending.recipient.id === currentUserId;
  const canRespond = isRecipient || (pending !== null && data.viewerIsAdmin);
  const [latest, ...older] = history;

  function handleRequest() {
    if (!recipientId) return;
    setError(null);
    startTransition(async () => {
      try {
        await createProgressRequest(taskId, recipientId);
        await load();
        onChanged?.();
      } catch (err) {
        setError(errorMessage(err));
      }
    });
  }

  function handleSubmit() {
    if (!pending) return;
    const validation = validateProgressResponseContent(content);
    if (!validation.valid) {
      setError(validation.error ?? null);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await submitProgressResponse(pending.id, content);
        setContent("");
        await load();
        onChanged?.();
      } catch (err) {
        setError(errorMessage(err));
        await load();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">İlerleme</h3>

        {check.allowed ? (
          <div className="flex items-center gap-2">
            {assignees.length > 1 && (
              <select
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                disabled={isPending}
                aria-label="İlerleme istenecek kişi"
                className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                {assignees.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>
                    {assignee.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={handleRequest}
              disabled={isPending || !recipientId}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ClipboardList className="h-3.5 w-3.5" />
              )}
              İlerleme Sor
            </button>
          </div>
        ) : (
          !pending && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">{check.reason}</span>
          )
        )}
      </div>

      {pending &&
        (canRespond ? (
          <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
                {isRecipient
                  ? "İlerleme durumunuz bekleniyor"
                  : `${pending.recipient.name} için ilerleme durumu bekleniyor`}
              </span>
              <span className="text-xs text-amber-700 dark:text-amber-400">
                ({pending.requestedBy?.name ?? "Bir kullanıcı"} tarafından istendi)
              </span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isPending}
              rows={3}
              placeholder="Görevin son durumunu paylaşın..."
              className="w-full resize-y rounded-md border border-amber-200 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-amber-400 dark:border-amber-900 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-amber-700 dark:text-amber-400">
                {content.trim().length}/{PROGRESS_RESPONSE_MAX_LENGTH}
              </span>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Gönder
              </button>
            </div>
          </div>
        ) : (
          <div className="inline-flex w-fit items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <Clock className="h-3.5 w-3.5" />
            {pending.recipient.name} kullanıcısından ilerleme yanıtı bekleniyor
          </div>
        ))}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {latest && (
        <div className="flex flex-col gap-2">
          <ProgressEntry request={latest} />
          {older.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowOlder((value) => !value)}
                className="inline-flex w-fit items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                {showOlder ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                Son ilerleme güncellemeleri ({older.length})
              </button>
              {showOlder && older.map((request) => <ProgressEntry key={request.id} request={request} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ProgressEntry({ request }: { request: ProgressData["history"][number] }) {
  const response = request.responses[0];
  if (!response) return null;

  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="mb-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">
          {response.responder.name}
        </span>
        <span>{formatRelativeTime(new Date(response.createdAt))}</span>
      </div>
      <MarkdownRenderer content={response.content} />
    </div>
  );
}
