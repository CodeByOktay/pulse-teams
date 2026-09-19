"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, FileText, FolderKanban, Zap, Loader2 } from "lucide-react";
import { globalSearch, type ProjectSearchResult, type TaskSearchResult } from "@/actions/search";
import {
  filterQuickNavCommands,
  flattenSearchResults,
  hasNoResults,
  isQueryValid,
  moveActiveIndex,
  type QuickNavCommand,
  type SearchResultGroup,
} from "@/lib/search-logic";

type FlatItem =
  | { kind: "project"; data: ProjectSearchResult }
  | { kind: "task"; data: TaskSearchResult }
  | { kind: "command"; data: QuickNavCommand };

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const activeProjectId = pathname.match(/^\/projects\/([^/]+)/)?.[1];

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState<ProjectSearchResult[]>([]);
  const [tasks, setTasks] = useState<TaskSearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function close() {
    setIsOpen(false);
    setQuery("");
    setProjects([]);
    setTasks([]);
    setActiveIndex(0);
  }

  useEffect(() => {
    function handleGlobalKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen((open) => !open);
      }
    }
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isQueryValid(query)) {
      setProjects([]);
      setTasks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      globalSearch(query).then((result) => {
        if (cancelled) return;
        setProjects(result.projects);
        setTasks(result.tasks);
        setIsLoading(false);
      });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const quickNavCommands = activeProjectId ? filterQuickNavCommands(query) : [];

  const groups: SearchResultGroup<FlatItem>[] = [
    {
      key: "projects",
      label: "Projeler",
      items: projects.map((project) => ({ kind: "project" as const, data: project })),
    },
    {
      key: "tasks",
      label: "Görevler",
      items: tasks.map((task) => ({ kind: "task" as const, data: task })),
    },
    {
      key: "commands",
      label: "Hızlı Aksiyonlar",
      items: quickNavCommands.map((command) => ({ kind: "command" as const, data: command })),
    },
  ];

  const flatItems = flattenSearchResults(groups);
  const noResults = isQueryValid(query) && !isLoading && hasNoResults(groups);

  function selectItem(item: FlatItem) {
    if (item.kind === "project") {
      router.push(`/projects/${item.data.id}/board`);
    } else if (item.kind === "task") {
      router.push(`/projects/${item.data.projectId}/board?task=${item.data.id}`);
    } else if (activeProjectId) {
      router.push(item.data.path(activeProjectId));
    }
    close();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => moveActiveIndex(index, "down", flatItems.length));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => moveActiveIndex(index, "up", flatItems.length));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = flatItems[activeIndex];
      if (item) selectItem(item);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-white/20 hover:text-white"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 truncate text-left">Ara...</span>
        <kbd className="shrink-0 rounded border border-slate-600 px-1 py-0.5 text-[10px] text-slate-400">
          Ctrl+K
        </kbd>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[15vh]">
          <div className="absolute inset-0" onClick={close} />
          <div className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              {isLoading ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-400" />
              ) : (
                <Search className="h-4 w-4 shrink-0 text-zinc-400" />
              )}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Görev, proje veya komut ara..."
                className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
              />
            </div>

            <div className="max-h-96 overflow-y-auto py-2">
              {!isQueryValid(query) ? (
                <p className="px-4 py-6 text-center text-sm text-zinc-400">
                  Aramak için en az 2 karakter yazın.
                </p>
              ) : noResults ? (
                <p className="px-4 py-6 text-center text-sm text-zinc-400">Sonuç bulunamadı.</p>
              ) : (
                <>
                  {projects.length > 0 ? (
                    <ResultSection label="Projeler" icon={<FolderKanban className="h-3.5 w-3.5" />}>
                      {projects.map((project) => {
                        const globalIndex = flatItems.findIndex(
                          (item) => item.kind === "project" && item.data.id === project.id,
                        );
                        return (
                          <ResultRow
                            key={project.id}
                            isActive={globalIndex === activeIndex}
                            onMouseEnter={() => setActiveIndex(globalIndex)}
                            onClick={() => selectItem({ kind: "project", data: project })}
                          >
                            <FolderKanban className="h-4 w-4 shrink-0 text-zinc-400" />
                            <span className="min-w-0 flex-1 truncate">{project.name}</span>
                            <span className="shrink-0 text-xs text-zinc-400">{project.identifier}</span>
                          </ResultRow>
                        );
                      })}
                    </ResultSection>
                  ) : null}

                  {tasks.length > 0 ? (
                    <ResultSection label="Görevler" icon={<FileText className="h-3.5 w-3.5" />}>
                      {tasks.map((task) => {
                        const globalIndex = flatItems.findIndex(
                          (item) => item.kind === "task" && item.data.id === task.id,
                        );
                        return (
                          <ResultRow
                            key={task.id}
                            isActive={globalIndex === activeIndex}
                            onMouseEnter={() => setActiveIndex(globalIndex)}
                            onClick={() => selectItem({ kind: "task", data: task })}
                          >
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: task.stateColor }}
                            />
                            <span className="shrink-0 text-xs text-zinc-400">
                              {task.projectIdentifier}-{task.sequenceId}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{task.title}</span>
                          </ResultRow>
                        );
                      })}
                    </ResultSection>
                  ) : null}

                  {quickNavCommands.length > 0 ? (
                    <ResultSection label="Hızlı Aksiyonlar" icon={<Zap className="h-3.5 w-3.5" />}>
                      {quickNavCommands.map((command) => {
                        const globalIndex = flatItems.findIndex(
                          (item) => item.kind === "command" && item.data.id === command.id,
                        );
                        return (
                          <ResultRow
                            key={command.id}
                            isActive={globalIndex === activeIndex}
                            onMouseEnter={() => setActiveIndex(globalIndex)}
                            onClick={() => selectItem({ kind: "command", data: command })}
                          >
                            <Zap className="h-4 w-4 shrink-0 text-zinc-400" />
                            <span className="min-w-0 flex-1 truncate">{command.label}</span>
                          </ResultRow>
                        );
                      })}
                    </ResultSection>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ResultSection({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="px-2 py-1">
      <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
        {icon}
        {label}
      </div>
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </div>
  );
}

function ResultRow({
  isActive,
  onMouseEnter,
  onClick,
  children,
}: {
  isActive: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onMouseEnter={onMouseEnter}
        onClick={onClick}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ${
          isActive
            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-700 dark:text-zinc-300"
        }`}
      >
        {children}
      </button>
    </li>
  );
}
