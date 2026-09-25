"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Ban, ChevronDown, Copy, Link2, Loader2, Plus, Search, Timer, X } from "lucide-react";
import { addTaskRelation, removeTaskRelation, searchTasksForRelation } from "@/actions/relation";
import { useClickOutside } from "@/lib/use-click-outside";
import {
  countGroupedRelations,
  formatTaskIdentifier,
  getRelationLabel,
  groupRelationsForTask,
  type GroupedRelationItem,
  type GroupedRelations,
  type RelatedTaskSummary,
  type SourceRelationRecord,
  type TargetRelationRecord,
} from "@/lib/relation-logic";
import type { RelationType } from "@prisma/client";

type SectionConfig = {
  key: keyof GroupedRelations;
  title: string;
  icon: typeof Ban;
};

const SECTIONS: SectionConfig[] = [
  { key: "blocks", title: "Engelliyor", icon: Ban },
  { key: "blockedBy", title: "Tarafından engelleniyor", icon: Timer },
  { key: "relatesTo", title: "İlişkili", icon: Link2 },
  { key: "duplicates", title: "Yinelenen / Kopyası", icon: Copy },
];

const RELATION_TYPE_OPTIONS: { value: RelationType; label: string }[] = [
  { value: "BLOCKS", label: "Engelliyor" },
  { value: "RELATES_TO", label: "İlişkili" },
  { value: "DUPLICATES", label: "Kopyası" },
];

const RESULT_LIST_CLASS = "flex max-h-56 flex-col gap-0.5 overflow-y-auto";

export function TaskRelations({
  taskId,
  projectId,
  sourceRelations,
  targetRelations,
  onNavigateToTask,
  onChanged,
}: {
  taskId: string;
  projectId: string;
  sourceRelations: SourceRelationRecord[];
  targetRelations: TargetRelationRecord[];
  onNavigateToTask?: (taskId: string) => void;
  onChanged: () => void;
}) {
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const grouped = groupRelationsForTask(taskId, sourceRelations, targetRelations);
  const totalCount = countGroupedRelations(grouped);

  function handleRemove(relationId: string) {
    setError(null);
    setRemovedIds((prev) => [...prev, relationId]);

    startTransition(async () => {
      try {
        await removeTaskRelation(relationId);
        onChanged();
      } catch (err) {
        setRemovedIds((prev) => prev.filter((id) => id !== relationId));
        setError(err instanceof Error ? err.message : "İlişki kaldırılamadı.");
      }
    });
  }

  function handleAdd(targetTaskId: string, type: RelationType) {
    setError(null);
    return addTaskRelation(taskId, targetTaskId, type).then(() => onChanged());
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          İlişkiler {totalCount > 0 ? `(${totalCount})` : ""}
        </h2>
        <AddRelationPopover
          taskId={taskId}
          projectId={projectId}
          onAdd={handleAdd}
          onError={setError}
        />
      </div>

      {error ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {totalCount === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Bu görevin henüz bir ilişkisi yok.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {SECTIONS.map((section) => {
            const items = grouped[section.key].filter((item) => !removedIds.includes(item.id));
            if (items.length === 0) return null;

            return (
              <RelationSection
                key={section.key}
                section={section}
                items={items}
                onNavigateToTask={onNavigateToTask}
                onRemove={handleRemove}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function RelationSection({
  section,
  items,
  onNavigateToTask,
  onRemove,
}: {
  section: SectionConfig;
  items: GroupedRelationItem[];
  onNavigateToTask?: (taskId: string) => void;
  onRemove: (relationId: string) => void;
}) {
  const Icon = section.icon;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        <Icon className="h-3.5 w-3.5" />
        <span>{section.title}</span>
        <span className="text-zinc-400 dark:text-zinc-500">({items.length})</span>
      </div>

      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li
            key={item.id}
            className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <button
              type="button"
              onClick={() => onNavigateToTask?.(item.task.id)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              title={getRelationLabel(item.type, item.direction)}
            >
              <StateDot color={item.task.stateColor} />
              <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {formatTaskIdentifier(item.task.projectIdentifier, item.task.sequenceId)}
              </span>
              <span className="min-w-0 truncate text-sm text-zinc-700 dark:text-zinc-300">
                {item.task.title}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label="İlişkiyi kaldır"
              className="shrink-0 rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-200 hover:text-red-600 focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 group-hover:opacity-100 dark:hover:bg-zinc-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddRelationPopover({
  taskId,
  projectId,
  onAdd,
  onError,
}: {
  taskId: string;
  projectId: string;
  onAdd: (targetTaskId: string, type: RelationType) => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<RelationType>("BLOCKS");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RelatedTaskSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const closePopover = useCallback(() => setIsOpen(false), []);

  useClickOutside(containerRef, closePopover);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const timer = setTimeout(() => {
      if (cancelled) return;
      setIsSearching(true);
      searchTasksForRelation(projectId, taskId, query)
        .then((tasks) => {
          if (cancelled) return;
          setResults(tasks);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setResults([]);
          onError(err instanceof Error ? err.message : "Görevler aranamadı.");
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, projectId, taskId, query, onError]);

  function openPopover() {
    setResults([]);
    setIsSearching(true);
    setIsOpen(true);
  }

  function togglePopover() {
    onError(null);
    if (isOpen) closePopover();
    else openPopover();
  }

  function handleSelect(targetTaskId: string) {
    setPendingTaskId(targetTaskId);
    onAdd(targetTaskId, type)
      .then(() => {
        closePopover();
        setQuery("");
      })
      .catch((err: unknown) => {
        onError(err instanceof Error ? err.message : "İlişki eklenemedi.");
      })
      .finally(() => setPendingTaskId(null));
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={togglePopover}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <Plus className="h-3.5 w-3.5" />
        İlişki Ekle
      </button>

      {isOpen ? (
        <div
          role="dialog"
          aria-label="İlişki ekle"
          onKeyDown={(event) => {
            if (event.key === "Escape") closePopover();
          }}
          className="absolute right-0 top-full z-40 mt-1 w-80 rounded-md border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="relative mb-2">
            <select
              value={type}
              onChange={(event) => setType(event.target.value as RelationType)}
              aria-label="İlişki tipi"
              className="w-full appearance-none rounded-md border border-zinc-300 bg-white py-1.5 pl-2 pr-7 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {RELATION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          </div>

          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Görev ara..."
              aria-label="İlişkilendirilecek görevi ara"
              className="w-full rounded-md border border-zinc-300 bg-white py-1.5 pl-7 pr-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          <RelationSearchResults
            results={results}
            isSearching={isSearching}
            pendingTaskId={pendingTaskId}
            onSelect={handleSelect}
          />
        </div>
      ) : null}
    </div>
  );
}

function RelationSearchResults({
  results,
  isSearching,
  pendingTaskId,
  onSelect,
}: {
  results: RelatedTaskSummary[];
  isSearching: boolean;
  pendingTaskId: string | null;
  onSelect: (targetTaskId: string) => void;
}) {
  if (results.length === 0) {
    return (
      <ul className={RESULT_LIST_CLASS}>
        {isSearching ? (
          <li className="flex items-center gap-2 px-2 py-2 text-xs text-zinc-500 dark:text-zinc-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Aranıyor...
          </li>
        ) : (
          <li className="px-2 py-2 text-xs text-zinc-500 dark:text-zinc-400">
            Eklenebilecek görev bulunamadı.
          </li>
        )}
      </ul>
    );
  }

  return (
    <ul className={RESULT_LIST_CLASS}>
      {results.map((task) => (
        <li key={task.id}>
          <button
            type="button"
            disabled={pendingTaskId !== null}
            onClick={() => onSelect(task.id)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-zinc-800"
          >
            <StateDot color={task.stateColor} />
            <span className="shrink-0 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
              {formatTaskIdentifier(task.projectIdentifier, task.sequenceId)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
              {task.title}
            </span>
            {pendingTaskId === task.id ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-400" />
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

function StateDot({ color }: { color: string }) {
  return <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}
