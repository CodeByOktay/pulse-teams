import type { Activity, ActivityType, Prisma } from "@prisma/client";

export type PrismaTransactionClient = Prisma.TransactionClient;

export type ActivityWithActor = Activity & {
  actor: { name: string | null } | null;
};

export async function logActivity(
  tx: PrismaTransactionClient,
  data: {
    type: ActivityType;
    taskId: string;
    actorId: string;
    oldValue?: string | null;
    newValue?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await tx.activity.create({
      data: {
        type: data.type,
        taskId: data.taskId,
        actorId: data.actorId,
        oldValue: data.oldValue ?? undefined,
        newValue: data.newValue ?? undefined,
        metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
      },
    });
  } catch (err) {
    console.error("Aktivite kaydedilemedi:", err);
  }
}

function actorName(activity: ActivityWithActor): string {
  return activity.actor?.name?.trim() || "Bir kullanıcı";
}

function displayValue(value: string | null): string {
  return value && value.trim() ? value : "—";
}

function parseMetadata(activity: ActivityWithActor): Record<string, unknown> {
  if (!activity.metadata) return {};
  try {
    return JSON.parse(activity.metadata) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function metadataString(activity: ActivityWithActor, key: string): string {
  const value = parseMetadata(activity)[key];
  return typeof value === "string" && value.trim() ? value : "—";
}

export function formatActivityMessage(activity: ActivityWithActor): string {
  const actor = actorName(activity);

  switch (activity.type) {
    case "TASK_CREATED":
      return `${actor} görevi oluşturdu.`;
    case "TASK_TITLE_UPDATED":
      return `${actor} başlığı '${displayValue(activity.oldValue)}' → '${displayValue(activity.newValue)}' olarak değiştirdi.`;
    case "TASK_DESCRIPTION_UPDATED":
      return `${actor} açıklamayı güncelledi.`;
    case "TASK_STATE_CHANGED":
      return `${actor} durumu '${displayValue(activity.oldValue)}' → '${displayValue(activity.newValue)}' olarak değiştirdi.`;
    case "TASK_PRIORITY_CHANGED":
      return `${actor} önceliği '${displayValue(activity.oldValue)}' → '${displayValue(activity.newValue)}' olarak değiştirdi.`;
    case "TASK_DUE_DATE_CHANGED":
      return `${actor} bitiş tarihini '${displayValue(activity.oldValue)}' → '${displayValue(activity.newValue)}' olarak değiştirdi.`;
    case "TASK_START_DATE_CHANGED":
      return `${actor} başlangıç tarihini '${displayValue(activity.oldValue)}' → '${displayValue(activity.newValue)}' olarak değiştirdi.`;
    case "TASK_ASSIGNEE_ADDED":
      return `${actor} '${metadataString(activity, "userName")}'ı göreve atadı.`;
    case "TASK_ASSIGNEE_REMOVED":
      return `${actor} '${metadataString(activity, "userName")}'ı görevden çıkardı.`;
    case "TASK_LABEL_ADDED":
      return `${actor} '${metadataString(activity, "labelName")}' etiketini ekledi.`;
    case "TASK_LABEL_REMOVED":
      return `${actor} '${metadataString(activity, "labelName")}' etiketini kaldırdı.`;
    case "TASK_SPRINT_ADDED":
      return `${actor} görevi '${metadataString(activity, "sprintName")}' sprintine ekledi.`;
    case "TASK_SPRINT_REMOVED":
      return `${actor} görevi '${metadataString(activity, "sprintName")}' sprintinden çıkardı.`;
    case "COMMENT_ADDED":
      return `${actor} yorum ekledi.`;
    case "COMMENT_DELETED":
      return `${actor} yorumu sildi.`;
    default:
      return `${actor} bu görevde bir değişiklik yaptı.`;
  }
}
