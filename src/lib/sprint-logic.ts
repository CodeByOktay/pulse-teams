import type { SprintStatus } from "@prisma/client";

export function validateSprintDates(
  startDate?: Date | null,
  endDate?: Date | null,
): { valid: boolean; error?: string } {
  if (startDate && endDate && endDate.getTime() <= startDate.getTime()) {
    return { valid: false, error: "Bitiş tarihi başlangıç tarihinden sonra olmalıdır." };
  }

  return { valid: true };
}

export function canDeleteSprint(status: SprintStatus): { allowed: boolean; reason?: string } {
  if (status !== "DRAFT") {
    return { allowed: false, reason: "Sadece taslak sprintler silinebilir." };
  }

  return { allowed: true };
}

export function canStartSprint(existingActiveSprint: boolean): { allowed: boolean; reason?: string } {
  if (existingActiveSprint) {
    return { allowed: false, reason: "Bu projede zaten aktif bir sprint var." };
  }

  return { allowed: true };
}
