"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check } from "lucide-react";
import { useClickOutside } from "@/lib/use-click-outside";

export type InlineOption = { id: string; label: ReactNode };

export function InlineSelectPopover({
  trigger,
  options,
  selectedId,
  onSelect,
  ariaLabel,
}: {
  trigger: ReactNode;
  options: InlineOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  ariaLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsOpen(false));

  function openMenu() {
    const index = options.findIndex((option) => option.id === selectedId);
    setActiveIndex(index >= 0 ? index : 0);
    setIsOpen(true);
  }

  function choose(id: string) {
    setIsOpen(false);
    onSelect(id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!isOpen) {
      if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
        event.preventDefault();
        openMenu();
      }
      return;
    }

    if (event.key === "Escape") {
      // Yalnızca açılır liste kapanır; slide-over'ın document Escape dinleyicisine ulaşmaz.
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(options.length - 1, index + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      choose(options[activeIndex].id);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className="flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1 text-sm hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {trigger}
      </button>

      {isOpen ? (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 top-full z-40 mt-1 w-48 rounded-md border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {options.map((option, index) => (
            <li key={option.id}>
              <button
                type="button"
                role="option"
                aria-selected={option.id === selectedId}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option.id)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
                  index === activeIndex ? "bg-zinc-100 dark:bg-zinc-800" : ""
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.id === selectedId ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
