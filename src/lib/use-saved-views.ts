"use client";

import { useCallback, useSyncExternalStore } from "react";
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

/** SSR/hydration için sabit, referansı hiç değişmeyen boş dizi. */
const EMPTY_VIEWS: SavedView[] = [];

/** storageKey -> son ayrıştırılmış anlık görüntü; useSyncExternalStore'un referans kararlılığı gerektirir. */
const parsedViewsCache = new Map<string, { raw: string | null; views: SavedView[] }>();

/** Aynı sekme içindeki dinleyiciler (native "storage" olayı yalnızca diğer sekmelerde tetiklenir). */
const localListeners = new Set<() => void>();

function notifyLocalListeners() {
  for (const listener of localListeners) listener();
}

function readCustomViews(storageKey: string): SavedView[] {
  if (typeof window === "undefined") return EMPTY_VIEWS;
  const raw = localStorage.getItem(storageKey);
  const cached = parsedViewsCache.get(storageKey);
  if (cached && cached.raw === raw) {
    return cached.views;
  }
  const views = parseSavedViewsFromStorage(raw);
  parsedViewsCache.set(storageKey, { raw, views });
  return views;
}

function writeCustomViews(storageKey: string, next: SavedView[]) {
  try {
    const raw = serializeSavedViewsForStorage(next);
    localStorage.setItem(storageKey, raw);
    parsedViewsCache.set(storageKey, { raw, views: next });
  } catch {
    // localStorage kullanılamıyorsa (gizli sekme, devre dışı depolama) sessizce yok say
  }
  notifyLocalListeners();
}

function subscribeToStorage(callback: () => void) {
  localListeners.add(callback);
  function handleStorageEvent(event: StorageEvent) {
    if (event.storageArea === localStorage) callback();
  }
  window.addEventListener("storage", handleStorageEvent);
  return () => {
    localListeners.delete(callback);
    window.removeEventListener("storage", handleStorageEvent);
  };
}

export function useSavedViews(projectId: string, filters: BoardFilters) {
  const { data: session } = useSession();
  const { applyQueryString } = useBoardQuery();
  const currentUserId = session?.user?.id;
  const storageKey = buildSavedViewsStorageKey(projectId);

  const customViews = useSyncExternalStore(
    subscribeToStorage,
    () => readCustomViews(storageKey),
    () => EMPTY_VIEWS,
  );

  const persist = useCallback(
    (next: SavedView[]) => {
      writeCustomViews(storageKey, next);
    },
    [storageKey],
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
