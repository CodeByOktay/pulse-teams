import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { CreateProjectModal } from "@/components/projects/create-project-modal";
import { EmptyState } from "@/components/ui/empty-state";

export type ProjectListItem = {
  id: string;
  name: string;
  identifier: string;
  createdAt: Date;
  taskCount: number;
};

export function ProjectList({ projects }: { projects: ProjectListItem[] }) {
  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
        <EmptyState
          icon={FolderKanban}
          title="İlk projenizi oluşturun"
          description="Görevlerinizi organize etmeye başlamak için bir proje oluşturun."
          action={<CreateProjectModal variant="solid" />}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <div
          key={project.id}
          className="group relative rounded-xl border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
        >
          <Link href={`/projects/${project.id}/board`} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {project.identifier}
              </span>
            </div>
            <h3 className="font-medium text-zinc-900 dark:text-zinc-50">{project.name}</h3>
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>{project.createdAt.toLocaleDateString("tr-TR")}</span>
              <span>{project.taskCount} görev</span>
            </div>
          </Link>
          <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
            <DeleteProjectButton projectId={project.id} />
          </div>
        </div>
      ))}
    </div>
  );
}
