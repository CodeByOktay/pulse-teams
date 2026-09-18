export function toggleItem(selectedIds: Set<string>, id: string): Set<string> {
  const next = new Set(selectedIds);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

export function selectAll(items: { id: string }[]): Set<string> {
  return new Set(items.map((item) => item.id));
}

export function isAllSelected(selectedIds: Set<string>, items: { id: string }[]): boolean {
  if (items.length === 0) return false;
  return items.every((item) => selectedIds.has(item.id));
}

export function validateBulkDeleteLimit(count: number): { valid: boolean; error?: string } {
  if (count === 0) {
    return { valid: false, error: "En az bir görev seçilmelidir." };
  }
  if (count > 50) {
    return { valid: false, error: "Aynı anda en fazla 50 görev silinebilir." };
  }
  return { valid: true };
}

export function validateBulkUpdateLimit(count: number): { valid: boolean; error?: string } {
  if (count === 0) {
    return { valid: false, error: "En az bir görev seçilmelidir." };
  }
  if (count > 100) {
    return { valid: false, error: "Aynı anda en fazla 100 görev güncellenebilir." };
  }
  return { valid: true };
}
