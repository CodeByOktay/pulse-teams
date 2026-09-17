"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useClickOutside } from "@/lib/use-click-outside";

export function MultiSelectDropdown<T extends { id: string }>({
  label,
  items,
  selectedIds,
  onToggle,
  renderItem,
}: {
  label: string;
  items: T[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  renderItem: (item: T) => React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setIsOpen(false));

  const activeCount = selectedIds.length;

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
          activeCount > 0
            ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
            : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        }`}
      >
        {label}
        {activeCount > 0 ? (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white">
            {activeCount}
          </span>
        ) : null}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-full z-40 mt-1 w-56 rounded-md border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400">Seçenek yok.</p>
            ) : (
              items.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggle(item.id)}
                      className="h-3.5 w-3.5"
                    />
                    {renderItem(item)}
                  </label>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
