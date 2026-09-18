import { useCallback, useMemo, useState } from "react";
import { isAllSelected as computeIsAllSelected, selectAll as computeSelectAll, toggleItem } from "@/lib/bulk-selection-logic";

export function useBulkSelection<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => toggleItem(prev, id));
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(computeSelectAll(items));
  }, [items]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isAllSelected = useMemo(() => computeIsAllSelected(selectedIds, items), [selectedIds, items]);
  const selectedCount = selectedIds.size;

  return {
    selectedIds,
    isSelected,
    toggleSelect,
    selectAll,
    clearSelection,
    isAllSelected,
    selectedCount,
  };
}
