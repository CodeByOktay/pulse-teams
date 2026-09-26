/**
 * Pure helper for calculating midpoint sortOrder when dropping/reordering tasks
 * in Kanban columns or sortable lists.
 */
export function calculateNewSortOrder(
  tasks: Array<{ sortOrder: number }>,
  overIndex: number,
): number {
  if (tasks.length === 0) return 65535;
  if (overIndex >= tasks.length) return tasks[tasks.length - 1].sortOrder + 10000;
  if (overIndex === 0) return tasks[0].sortOrder - 10000;
  const above = tasks[overIndex - 1].sortOrder;
  const below = tasks[overIndex].sortOrder;
  return (above + below) / 2;
}
