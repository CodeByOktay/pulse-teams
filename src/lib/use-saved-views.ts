"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useBoardQuery } from "@/lib/use-board-query";
import { serializeBoardFilters, type BoardFilters } from "@/lib/board-filters";
import {
  DEFAULT_SAVED_VIEWS,
  buildSavedViewsStorageKey,
  createSavedView,
  findMatchingSavedViewId,
  parseSavedViewsFromStorage,
  resolveSavedViewQuery,
  serializeSavedViewsForStorage,
  type SavedView,
} from "@/lib/saved-views-logic";

export function useSavedViews(projectId: string, filters: BoardFilters) {
  const { data: session } = useSession();
  const { applyQueryString } = useBoardQuery();
  const currentUserId = session?.user?.id;
  const [customViews, setCustomViews] = useState<SavedView[]>([]);

  useEffect(() => {
    setCustomViews(parseSavedViewsFromStorage(localStorage.getItem(buildSavedViewsStorageKey(projectId))));
  }, [projectId]);

  const persist = useCallback(
    (next: SavedView[]) => {
      setCustomViews(next);
      try {
        localStorage.setItem(buildSavedViewsStorageKey(projectId), serializeSavedViewsForStorage(next));
      } catch {
        // localStorage kullanılamıyorsa (gizli sekme, devre dışı depolama) sessizce yok say
      }
    },
    [projectId],
  );

  const saveView = useCallback(
    (name: string) => {
      const query = serializeBoardFilters(filters);
      persist([...customViews, createSavedView(name, query)]);
    },
    [customViews, filters, persist],
  );

  const deleteView = useCallback(
    (id: string) => persist(customViews.filter((view) => view.id !== id)),
    [customViews, persist],
  );

  const applyView = useCallback(
    (view: SavedView) => applyQueryString(resolveSavedViewQuery(view.query, currentUserId)),
    [applyQueryString, currentUserId],
  );

  const views = [...DEFAULT_SAVED_VIEWS, ...customViews];
  const activeViewId = findMatchingSavedViewId(views, serializeBoardFilters(filters), currentUserId);

  return { views, saveView, deleteView, applyView, activeViewId };
}
