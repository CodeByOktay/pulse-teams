"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { StandupModal } from "@/components/standup/standup-modal";

/**
 * Board-only banner prompting the current user to fill in today's standup (spec §3.2).
 * Renders nothing unless the standup window is open and the user has not submitted yet —
 * this component owns that visibility rule so callers can pass the raw banner data through.
 */
export function StandupBanner({
  projectId,
  isOpen,
  hasSubmitted,
}: {
  projectId: string;
  isOpen: boolean;
  hasSubmitted: boolean;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  if (!isOpen || hasSubmitted) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-left transition-colors hover:border-violet-300 dark:border-violet-900 dark:bg-violet-950/40 dark:hover:border-violet-800"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900 dark:text-violet-300">
          <ClipboardList className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-violet-900 dark:text-violet-200">
            Günlük Standup&apos;ınızı Yanıtlayın
          </span>
          <span className="block text-xs text-violet-700 dark:text-violet-400">
            Dün ne yaptığınızı, bugün ne yapacağınızı ve varsa engellerinizi kısaca paylaşın.
          </span>
        </span>
      </button>

      <StandupModal
        projectId={projectId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmitted={() => router.refresh()}
      />
    </>
  );
}
