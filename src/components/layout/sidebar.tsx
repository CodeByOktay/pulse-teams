"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LogOut, Calendar, Inbox, LayoutGrid, List, Settings } from "lucide-react";
import { CreateProjectModal } from "@/components/projects/create-project-modal";
import { getAvatarColor } from "@/lib/colors";

export type SidebarProject = {
  id: string;
  name: string;
  identifier: string;
  role: string;
};

export function Sidebar({ projects }: { projects: SidebarProject[] }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const activeProjectId = pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const activeSection = pathname.match(/^\/projects\/[^/]+\/([^/]+)/)?.[1];

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-slate-900 text-white">
      <div className="flex items-center justify-between px-4 py-5">
        <Link href="/" className="text-lg font-semibold">
          Pulse
        </Link>
      </div>

      <div className="px-4 pb-2">
        <CreateProjectModal />
      </div>

      <nav className="flex-1 overflow-y-auto px-2">
        <p className="px-2 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-slate-400">
          Projeler
        </p>
        <ul className="flex flex-col gap-0.5">
          {projects.map((project) => {
            const isActiveProject = project.id === activeProjectId;
            const isBoardActive = isActiveProject && activeSection === "board";
            const isListActive = isActiveProject && activeSection === "list";
            const isBacklogActive = isActiveProject && activeSection === "backlog";
            const isSprintsActive = isActiveProject && activeSection === "sprints";
            const isSettingsActive = isActiveProject && activeSection === "settings";
            return (
              <li key={project.id} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-300">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: getAvatarColor(project.identifier) }}
                  />
                  <span className="truncate">{project.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-slate-500">
                    {project.identifier}
                  </span>
                </div>
                <Link
                  href={`/projects/${project.id}/board`}
                  className={`ml-3 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    isBoardActive
                      ? "bg-slate-800 text-white"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
                  Board
                </Link>
                <Link
                  href={`/projects/${project.id}/list`}
                  className={`ml-3 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    isListActive
                      ? "bg-slate-800 text-white"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  <List className="h-3.5 w-3.5 shrink-0" />
                  Liste
                </Link>
                <Link
                  href={`/projects/${project.id}/backlog`}
                  className={`ml-3 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    isBacklogActive
                      ? "bg-slate-800 text-white"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  <Inbox className="h-3.5 w-3.5 shrink-0" />
                  Backlog
                </Link>
                <Link
                  href={`/projects/${project.id}/sprints`}
                  className={`ml-3 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    isSprintsActive
                      ? "bg-slate-800 text-white"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  Sprints
                </Link>
                {project.role === "ADMIN" ? (
                  <Link
                    href={`/projects/${project.id}/settings`}
                    className={`ml-3 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      isSettingsActive
                        ? "bg-slate-800 text-white"
                        : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                    }`}
                  >
                    <Settings className="h-3.5 w-3.5 shrink-0" />
                    Ayarlar
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3">
        <span className="truncate text-sm text-slate-300">
          {session?.user?.name ?? session?.user?.email}
        </span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          aria-label="Çıkış yap"
          className="flex items-center gap-1 rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
