/** Kayıtlı Görünümler için saf mantık — localStorage erişimi hook seviyesinde yapılır. */

export type SavedView = {
  id: string;
  name: string;
  /** serializeBoardFilters ile üretilmiş query string (örn. "priority=URGENT&due=overdue"). */
  query: string;
  isDefault?: boolean;
};

/** "Benim Görevlerim" gibi varsayılan görünümlerde gerçek kullanıcı ID'si bilinmediği için kullanılan yer tutucu. */
export const ME_PLACEHOLDER = "__me__";

export const DEFAULT_SAVED_VIEWS: SavedView[] = [
  { id: "default-all", name: "Varsayılan", query: "", isDefault: true },
  { id: "default-my-tasks", name: "Benim Görevlerim", query: `assignee=${ME_PLACEHOLDER}`, isDefault: true },
  { id: "default-urgent", name: "Acil Durumlar", query: "priority=URGENT", isDefault: true },
];

export function createSavedView(name: string, query: string): SavedView {
  return {
    id: `view_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    query,
  };
}

/** __me__ yer tutucusunu gerçek kullanıcı ID'siyle değiştirir; kullanıcı bilinmiyorsa dokunmadan döner. */
export function resolveSavedViewQuery(query: string, currentUserId?: string): string {
  if (!query || !currentUserId) return query;
  return query.replaceAll(ME_PLACEHOLDER, currentUserId);
}

function isValidSavedView(value: unknown): value is SavedView {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "string" && typeof candidate.name === "string" && typeof candidate.query === "string";
}

export function parseSavedViewsFromStorage(raw: string | null): SavedView[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSavedView);
  } catch {
    return [];
  }
}

export function serializeSavedViewsForStorage(views: SavedView[]): string {
  return JSON.stringify(views);
}

export function buildSavedViewsStorageKey(projectId: string): string {
  return `pulse:saved-views:${projectId}`;
}

/** Mevcut query string'in eşleştiği kayıtlı görünümü bulur (görünüm seçici vurgusu için). */
export function findMatchingSavedViewId(
  views: SavedView[],
  currentQuery: string,
  currentUserId?: string,
): string | null {
  const match = views.find((view) => resolveSavedViewQuery(view.query, currentUserId) === currentQuery);
  return match?.id ?? null;
}
