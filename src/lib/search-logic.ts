export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function isQueryValid(query: string): boolean {
  return normalizeSearchQuery(query).length >= 2;
}

export type TaskIdentifierMatch = { projectIdentifier: string; sequenceId: number };

export function parseTaskIdentifier(query: string): TaskIdentifierMatch | null {
  const match = query.trim().match(/^([a-zA-Z]{2,10})-(\d+)$/);
  if (!match) return null;
  return { projectIdentifier: match[1].toUpperCase(), sequenceId: Number(match[2]) };
}

export function matchesQuery(text: string, query: string): boolean {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return false;
  return text.toLowerCase().includes(normalizedQuery);
}

export type QuickNavCommand = {
  id: string;
  label: string;
  path: (projectId: string) => string;
};

export const QUICK_NAV_COMMANDS: QuickNavCommand[] = [
  { id: "goto-board", label: "Board'a git", path: (projectId) => `/projects/${projectId}/board` },
  { id: "goto-list", label: "Liste görünümüne git", path: (projectId) => `/projects/${projectId}/list` },
  { id: "goto-backlog", label: "Backlog'a git", path: (projectId) => `/projects/${projectId}/backlog` },
  { id: "goto-sprints", label: "Sprintlere git", path: (projectId) => `/projects/${projectId}/sprints` },
  { id: "goto-settings", label: "Ayarlar'a git", path: (projectId) => `/projects/${projectId}/settings` },
];

export function filterQuickNavCommands(query: string): QuickNavCommand[] {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];
  return QUICK_NAV_COMMANDS.filter((command) => matchesQuery(command.label, normalized));
}

export function moveActiveIndex(
  currentIndex: number,
  direction: "up" | "down",
  totalCount: number,
): number {
  if (totalCount === 0) return -1;
  if (direction === "down") {
    return currentIndex >= totalCount - 1 ? 0 : currentIndex + 1;
  }
  return currentIndex <= 0 ? totalCount - 1 : currentIndex - 1;
}

export type SearchResultGroup<T> = { key: string; label: string; items: T[] };

export function flattenSearchResults<T>(groups: SearchResultGroup<T>[]): T[] {
  return groups.flatMap((group) => group.items);
}

export function countTotalResults(groups: SearchResultGroup<unknown>[]): number {
  return groups.reduce((sum, group) => sum + group.items.length, 0);
}

export function hasNoResults(groups: SearchResultGroup<unknown>[]): boolean {
  return countTotalResults(groups) === 0;
}
