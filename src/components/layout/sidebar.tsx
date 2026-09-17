"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import { CreateProjectModal } from "@/components/projects/create-project-modal";
import { getAvatarColor } from "@/lib/colors";

export type SidebarProject = {
  id: string;
  name: string;
  identifier: string;
};

export function Sidebar({ projects }: { projects: SidebarProject[] }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const activeProjectId = pathname.match(/^\/projects\/([^/]+)/)?.[1];

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-slate-900 text-white">
      <div className="flex items-center justify-between px-4 py-5">
        <Link href="/" className="text-lg font-semibold">
          Staj PM
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
            const isActive = project.id === activeProjectId;
            return (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}/board`}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    isActive
                      ? "bg-slate-800 text-white"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: getAvatarColor(project.identifier) }}
                  />
                  <span className="truncate">{project.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-slate-500">
                    {project.identifier}
                  </span>
                </Link>
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
