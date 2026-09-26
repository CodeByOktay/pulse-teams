"use client";

import { useState } from "react";
import { useBoardQuery } from "@/lib/use-board-query";

const TASK_PARAM = "task";

/**
 * Görev detay slide-over'ının seçili görev durumunu `?task=` derin bağlantısıyla eşler.
 * Diğer query parametreleri korunur; URL yalnızca derin bağlantıyla açıldıysa güncellenir.
 */
export function useTaskNavigation() {
  const { searchParams, setParam } = useBoardQuery();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(() =>
    searchParams.get(TASK_PARAM),
  );

  function closeTaskDetail() {
    setSelectedTaskId(null);
    if (searchParams.get(TASK_PARAM)) setParam(TASK_PARAM, null);
  }

  /** İlişkili bir göreve tıklanınca modal o göreve geçer, derin bağlantı varsa URL de güncellenir. */
  function navigateToTask(nextTaskId: string) {
    setSelectedTaskId(nextTaskId);
    if (searchParams.get(TASK_PARAM)) setParam(TASK_PARAM, nextTaskId);
  }

  return { selectedTaskId, openTask: setSelectedTaskId, navigateToTask, closeTaskDetail };
}
