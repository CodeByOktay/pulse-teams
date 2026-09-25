export type BlockerState = {
  stateGroup: string;
  taskId?: string;
  id?: string;
};

export type DependentTaskInput = {
  id: string;
  assigneeIds: string[];
  blockers: BlockerState[];
};

export function isCompletionTransition(
  oldGroup: string | null | undefined,
  newGroup: string,
): boolean {
  return newGroup === "DONE" && oldGroup !== "DONE";
}

export function isReopeningTransition(oldGroup: string, newGroup: string): boolean {
  return oldGroup === "DONE" && newGroup !== "DONE";
}

export function isTaskFullyUnblocked(blockerStates: BlockerState[]): boolean {
  return blockerStates.every((blocker) => blocker.stateGroup === "DONE");
}

export function findNewlyUnblockedTasks(params: {
  completedTaskId: string;
  dependentTasks: DependentTaskInput[];
}): Array<{ taskId: string; recipientUserIds: string[] }> {
  const result: Array<{ taskId: string; recipientUserIds: string[] }> = [];

  for (const dependentTask of params.dependentTasks) {
    if (isTaskFullyUnblocked(dependentTask.blockers)) {
      result.push({
        taskId: dependentTask.id,
        recipientUserIds: dependentTask.assigneeIds,
      });
    }
  }

  return result;
}

export function formatUnblockedNotificationMessage(
  blockerTitle: string,
  dependentTitle: string,
): { title: string; message: string } {
  return {
    title: "Görev engeli kalktı",
    message: `'${blockerTitle}' tamamlandı. '${dependentTitle}' görevinin aktif engeli kalmadı.`,
  };
}

export function filterSelfNotifications(recipientIds: string[], actorId: string): string[] {
  return recipientIds.filter((id) => id !== actorId);
}
