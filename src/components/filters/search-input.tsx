"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { useBoardQuery } from "@/lib/use-board-query";

export function SearchInput({ value }: { value: string }) {
  const { setParam } = useBoardQuery();
  const [syncedValue, setSyncedValue] = useState(value);
  const [text, setText] = useState(value);

  // Render-phase prop synchronization (React 19 pattern, no effect needed).
  if (syncedValue !== value) {
    setSyncedValue(value);
    setText(value);
  }

  useEffect(() => {
    if (text === value) return;
    const timeout = setTimeout(() => {
      setParam("q", text.trim() || null);
    }, 300);
    return () => clearTimeout(timeout);
  }, [text, value, setParam]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Görev ara..."
        aria-label="Görev başlığında ara"
        className="w-40 rounded-full border border-zinc-200 bg-white py-1.5 pl-8 pr-7 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
      />
      {text ? (
        <button
          type="button"
          onClick={() => setText("")}
          aria-label="Aramayı temizle"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
