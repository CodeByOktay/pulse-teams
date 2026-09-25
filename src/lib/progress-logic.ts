export const PROGRESS_RESPONSE_MIN_LENGTH = 3;
export const PROGRESS_RESPONSE_MAX_LENGTH = 2000;

export function canRequestProgress(
  taskStateGroup: string,
  assigneesCount: number,
  hasPendingRequest: boolean,
): { allowed: boolean; reason?: string } {
  if (taskStateGroup === "DONE" || taskStateGroup === "CANCELLED") {
    return {
      allowed: false,
      reason: "Tamamlanan veya iptal edilen görevler için ilerleme istenemez.",
    };
  }

  if (assigneesCount === 0) {
    return { allowed: false, reason: "Görevin atanmış bir üyesi bulunmuyor." };
  }

  if (hasPendingRequest) {
    return {
      allowed: false,
      reason: "Bu görev için zaten bekleyen bir ilerleme talebi var.",
    };
  }

  return { allowed: true };
}

export function validateProgressResponseContent(content: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = content.trim();

  if (trimmed.length < PROGRESS_RESPONSE_MIN_LENGTH) {
    return {
      valid: false,
      error: `İlerleme yanıtı en az ${PROGRESS_RESPONSE_MIN_LENGTH} karakter olmalıdır.`,
    };
  }

  if (trimmed.length > PROGRESS_RESPONSE_MAX_LENGTH) {
    return {
      valid: false,
      error: `İlerleme yanıtı en fazla ${PROGRESS_RESPONSE_MAX_LENGTH} karakter olabilir.`,
    };
  }

  return { valid: true };
}

export function formatProgressRequestNotification(
  taskTitle: string,
  requesterName?: string,
): { title: string; message: string } {
  return {
    title: "İlerleme durumu talep edildi",
    message: `'${requesterName ?? "Bir kullanıcı"}' '${taskTitle}' görevi için durum güncellemesi istedi.`,
  };
}
