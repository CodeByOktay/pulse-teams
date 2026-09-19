"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Link as LinkIcon } from "lucide-react";
import { buildTaskShareUrl } from "@/lib/task-detail-ux";

export function CopyLinkButton({ taskId }: { taskId: string }) {
  const pathname = usePathname();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url = buildTaskShareUrl(window.location.origin, pathname, taskId);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Panoya erişim reddedilirse sessizce yok say, arayüzü bozma.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
          Kopyalandı!
        </>
      ) : (
        <>
          <LinkIcon className="h-3.5 w-3.5" />
          Bağlantıyı Kopyala
        </>
      )}
    </button>
  );
}
