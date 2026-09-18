"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { X, Loader2 } from "lucide-react";
import { getTaskDetail, updateTask } from "@/actions/task";
import { TaskIdentifier } from "@/components/task-detail/task-identifier";
import { TaskDescription } from "@/components/task-detail/task-description";
import { TaskComments, type CommentItem } from "@/components/task-detail/task-comments";
import { TaskActivity } from "@/components/task-detail/task-activity";
import { TaskProperties, type StateOption } from "@/components/task-detail/task-properties";
import type { LabelOption } from "@/components/labels/label-picker";
import type { AssigneeOption } from "@/components/assignees/assignee-picker";
import type { Priority } from "@prisma/client";

type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  sequenceId: number;
  stateId: string;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
  labelIds: string[];
  assigneeIds: string[];
  comments: CommentItem[];
};

export function TaskDetailModal({
  taskId,
  projectId,
  projectIdentifier,
  states,
  availableLabels,
  members,
  onClose,
}: {
  taskId: string;
  projectId: string;
  projectIdentifier: string;
  states: StateOption[];
  availableLabels: LabelOption[];
  members: AssigneeOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [titleValue, setTitleValue] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"activity" | "comments">("activity");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    getTaskDetail(taskId).then((task) => {
      if (cancelled) return;
      setDetail({
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        sequenceId: task.sequenceId,
        stateId: task.stateId,
        startDate: task.startDate ? task.startDate.toISOString() : null,
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        createdAt: task.createdAt.toISOString(),
        labelIds: task.labels.map((tl) => tl.label.id),
        assigneeIds: task.assignees.map((ta) => ta.user.id),
        comments: task.comments.map((c) => ({
          id: c.id,
          content: c.content,
          createdAt: c.createdAt.toISOString(),
          author: c.author,
        })),
      });
      setTitleValue(task.title);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleClose() {
    router.refresh();
    onClose();
  }

  function saveTitle() {
    setIsEditingTitle(false);
    const trimmed = titleValue.trim();
    if (!detail || !trimmed || trimmed === detail.title) {
      if (detail) setTitleValue(detail.title);
      return;
    }
    setDetail({ ...detail, title: trimmed });
    updateTask(taskId, { title: trimmed }).then(() => router.refresh());
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      <div className="relative flex h-full w-full max-w-[90vw] flex-col bg-white shadow-xl dark:bg-zinc-900 sm:w-[720px]">
        <div className="flex shrink-0 items-center justify-end border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Kapat"
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading || !detail ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
              <TaskIdentifier
                projectIdentifier={projectIdentifier}
                sequenceId={detail.sequenceId}
                taskId={taskId}
                onDeleted={onClose}
              />

              {isEditingTitle ? (
                <input
                  autoFocus
                  type="text"
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") {
                      setTitleValue(detail.title);
                      setIsEditingTitle(false);
                    }
                  }}
                  className="w-full rounded-md border border-zinc-300 px-2 py-1 text-lg font-semibold outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800"
                />
              ) : (
                <h1
                  onClick={() => setIsEditingTitle(true)}
                  className="cursor-text rounded-md px-2 py-1 text-lg font-semibold text-zinc-900 hover:bg-zinc-50 dark:text-zinc-50 dark:hover:bg-zinc-800"
                >
                  {detail.title}
                </h1>
              )}

              <TaskDescription taskId={taskId} initialDescription={detail.description ?? ""} />

              <div className="flex flex-col gap-3">
                <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setActiveTab("activity")}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                      activeTab === "activity"
                        ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                    }`}
                  >
                    Aktivite
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("comments")}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                      activeTab === "comments"
                        ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                    }`}
                  >
                    Yorumlar
                  </button>
                </div>

                {activeTab === "activity" ? (
                  <TaskActivity taskId={taskId} currentUserId={session?.user?.id ?? ""} />
                ) : (
                  <TaskComments
                    taskId={taskId}
                    initialComments={detail.comments}
                    currentUserId={session?.user?.id ?? ""}
                  />
                )}
              </div>
            </div>

            <div className="w-64 shrink-0 overflow-y-auto border-l border-zinc-200 px-4 py-4 dark:border-zinc-800">
              <TaskProperties
                taskId={taskId}
                projectId={projectId}
                currentStateId={detail.stateId}
                currentPriority={detail.priority}
                states={states}
                availableLabels={availableLabels}
                selectedLabelIds={detail.labelIds}
                members={members}
                assignedUserIds={detail.assigneeIds}
                startDate={detail.startDate}
                dueDate={detail.dueDate}
                createdAt={detail.createdAt}
                onLabelsChange={(labelIds) => setDetail({ ...detail, labelIds })}
                onAssigneesChange={(assigneeIds) => setDetail({ ...detail, assigneeIds })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
