"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { X, Loader2 } from "lucide-react";
import { getTaskDetail, updateTask } from "@/actions/task";
import { TaskIdentifier } from "@/components/task-detail/task-identifier";
import { TaskDescription } from "@/components/task-detail/task-description";
import { TaskComments, type CommentItem } from "@/components/task-detail/task-comments";
import { TaskActivity } from "@/components/task-detail/task-activity";
import { TaskProperties, type StateOption } from "@/components/task-detail/task-properties";
import { TaskRelations } from "@/components/task-detail/task-relations";
import { TaskProgressSection } from "@/components/task-detail/task-progress-section";
import { CopyLinkButton } from "@/components/task-detail/copy-link-button";
import { buildTaskBreadcrumb, type TaskSprintInfo } from "@/lib/task-detail-ux";
import type {
  SourceRelationRecord,
  TargetRelationRecord,
} from "@/lib/relation-logic";
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
  projectName: string;
  sprints: TaskSprintInfo[];
  sourceRelations: SourceRelationRecord[];
  targetRelations: TargetRelationRecord[];
};

type DetailTab = "activity" | "comments";

const DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: "activity", label: "Aktivite" },
  { key: "comments", label: "Yorumlar" },
];

const TAB_BASE_CLASS = "px-3 py-2 text-sm font-medium transition-colors";
const TAB_ACTIVE_CLASS =
  "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100";
const TAB_INACTIVE_CLASS =
  "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200";

type TaskDetailPayload = Awaited<ReturnType<typeof getTaskDetail>>;

type RelatedTaskPayload = TaskDetailPayload["sourceRelations"][number]["targetTask"];

function toRelatedTaskSummary(task: RelatedTaskPayload) {
  return {
    id: task.id,
    sequenceId: task.sequenceId,
    title: task.title,
    stateName: task.state.name,
    stateColor: task.state.color,
    projectIdentifier: task.project.identifier,
  };
}

function toTaskDetail(task: TaskDetailPayload): TaskDetail {
  return {
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
    projectName: task.project.name,
    sprints: task.sprints.map((st) => ({
      id: st.sprint.id,
      name: st.sprint.name,
      status: st.sprint.status,
    })),
    sourceRelations: task.sourceRelations.map((relation) => ({
      id: relation.id,
      type: relation.type,
      sourceTaskId: relation.sourceTaskId,
      targetTask: toRelatedTaskSummary(relation.targetTask),
    })),
    targetRelations: task.targetRelations.map((relation) => ({
      id: relation.id,
      type: relation.type,
      targetTaskId: relation.targetTaskId,
      sourceTask: toRelatedTaskSummary(relation.sourceTask),
    })),
  };
}

export function TaskDetailModal({
  taskId,
  projectId,
  projectIdentifier,
  states,
  availableLabels,
  members,
  onClose,
  onNavigateToTask,
}: {
  taskId: string;
  projectId: string;
  projectIdentifier: string;
  states: StateOption[];
  availableLabels: LabelOption[];
  members: AssigneeOption[];
  onClose: () => void;
  onNavigateToTask?: (taskId: string) => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? "";
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [activeTab, setActiveTab] = useState<DetailTab>("activity");
  const isLoading = detail?.id !== taskId;

  useEffect(() => {
    let cancelled = false;

    getTaskDetail(taskId).then((task) => {
      if (cancelled) return;
      setDetail(toTaskDetail(task));
    });

    return () => {
      cancelled = true;
    };
  }, [taskId, reloadToken]);

  const handleEscape = useEffectEvent(() => onClose());

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleEscape();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function patchDetail(patch: Partial<TaskDetail>) {
    setDetail((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  /** İlişki veya ilerleme değiştikten sonra detayı sessizce tazeler. */
  function handleRelatedChange() {
    setReloadToken((token) => token + 1);
    router.refresh();
  }

  function handleClose() {
    router.refresh();
    onClose();
  }

  function saveTitle(title: string) {
    patchDetail({ title });
    updateTask(taskId, { title }).then(() => router.refresh());
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      <div className="relative flex h-full w-full max-w-[90vw] flex-col bg-white shadow-xl dark:bg-zinc-900 sm:w-[720px]">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <span className="min-w-0 truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {detail
              ? buildTaskBreadcrumb(detail.projectName, projectIdentifier, detail.sequenceId)
              : projectIdentifier}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <CopyLinkButton taskId={taskId} />
            <button
              type="button"
              onClick={handleClose}
              aria-label="Kapat"
              className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {isLoading ? (
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

              <EditableTitle title={detail.title} onSave={saveTitle} />

              <TaskDescription taskId={taskId} initialDescription={detail.description ?? ""} />

              <TaskRelations
                taskId={taskId}
                projectId={projectId}
                sourceRelations={detail.sourceRelations}
                targetRelations={detail.targetRelations}
                onNavigateToTask={onNavigateToTask}
                onChanged={handleRelatedChange}
              />

              <TaskProgressSection
                taskId={taskId}
                currentUserId={currentUserId}
                refreshKey={detail.assigneeIds.join(",")}
                onChanged={handleRelatedChange}
              />

              <div className="flex flex-col gap-3">
                <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
                  {DETAIL_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`${TAB_BASE_CLASS} ${
                        activeTab === tab.key ? TAB_ACTIVE_CLASS : TAB_INACTIVE_CLASS
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeTab === "activity" ? (
                  <TaskActivity taskId={taskId} currentUserId={currentUserId} />
                ) : (
                  <TaskComments
                    taskId={taskId}
                    initialComments={detail.comments}
                    currentUserId={currentUserId}
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
                sprints={detail.sprints}
                onLabelsChange={(labelIds) => patchDetail({ labelIds })}
                onAssigneesChange={(assigneeIds) => patchDetail({ assigneeIds })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EditableTitle({ title, onSave }: { title: string; onSave: (title: string) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  function startEditing() {
    setDraft(title);
    setIsEditing(true);
  }

  function commit() {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== title) onSave(trimmed);
  }

  if (isEditing) {
    return (
      <input
        autoFocus
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setIsEditing(false);
        }}
        className="w-full rounded-md border border-zinc-300 px-2 py-1 text-lg font-semibold outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800"
      />
    );
  }

  return (
    <h1
      onClick={startEditing}
      className="cursor-text rounded-md px-2 py-1 text-lg font-semibold text-zinc-900 hover:bg-zinc-50 dark:text-zinc-50 dark:hover:bg-zinc-800"
    >
      {title}
    </h1>
  );
}
