"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite } from "@/actions/member";

export function AcceptInviteButton({
  token,
  projectId,
}: {
  token: string;
  projectId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [isAccepting, setIsAccepting] = useState(false);

  function handleAccept() {
    setError("");
    setIsAccepting(true);
    startTransition(async () => {
      try {
        await acceptInvite(token);
        router.push(`/projects/${projectId}/board`);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Davet kabul edilemedi.");
        setIsAccepting(false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleAccept}
        disabled={isAccepting}
        className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isAccepting ? "Kabul Ediliyor..." : "Daveti Kabul Et"}
      </button>
      {error && <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
