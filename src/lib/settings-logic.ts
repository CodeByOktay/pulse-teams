const STATE_NAME_MAX_LENGTH = 50;
const LABEL_NAME_MAX_LENGTH = 30;
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export function validateStateName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();

  if (trimmed.length < 1) {
    return { valid: false, error: "Durum adı boş olamaz." };
  }

  if (trimmed.length > STATE_NAME_MAX_LENGTH) {
    return { valid: false, error: `Durum adı en fazla ${STATE_NAME_MAX_LENGTH} karakter olabilir.` };
  }

  return { valid: true };
}

export function validateLabelName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();

  if (trimmed.length < 1) {
    return { valid: false, error: "Etiket adı boş olamaz." };
  }

  if (trimmed.length > LABEL_NAME_MAX_LENGTH) {
    return { valid: false, error: `Etiket adı en fazla ${LABEL_NAME_MAX_LENGTH} karakter olabilir.` };
  }

  return { valid: true };
}

export function validateHexColor(color: string): boolean {
  return HEX_COLOR_REGEX.test(color);
}

export function canDeleteState(
  stateTaskCount: number,
  totalStateCount: number,
): { allowed: boolean; reason?: string } {
  if (stateTaskCount > 0) {
    return {
      allowed: false,
      reason: `Bu durumda ${stateTaskCount} görev bulunuyor. Silmeden önce görevleri taşıyın.`,
    };
  }

  if (totalStateCount <= 1) {
    return { allowed: false, reason: "Projede en az bir durum bulunmalıdır." };
  }

  return { allowed: true };
}

export function calculateStateSequences(count: number): number[] {
  return Array.from({ length: count }, (_, index) => (index + 1) * 1000);
}
