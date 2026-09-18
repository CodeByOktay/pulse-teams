"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { Bold, Italic, Code, List, Link as LinkIcon } from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown/markdown-renderer";

type ToolbarAction = "bold" | "italic" | "code" | "list" | "link";

function wrapSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
): { text: string; selectionStart: number; selectionEnd: number } {
  const selected = value.slice(start, end);
  const text = value.slice(0, start) + before + selected + after + value.slice(end);
  return {
    text,
    selectionStart: start + before.length,
    selectionEnd: start + before.length + selected.length,
  };
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    autoResize();
  }, [value, tab]);

  function applyToolbarAction(action: ToolbarAction) {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);

    if (action === "link") {
      const linkText = selected || "link";
      const inserted = `[${linkText}](url)`;
      const text = value.slice(0, start) + inserted + value.slice(end);
      const urlStart = start + `[${linkText}](`.length;
      onChange(text);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(urlStart, urlStart + "url".length);
      });
      return;
    }

    let before = "";
    let after = "";
    switch (action) {
      case "bold":
        before = "**";
        after = "**";
        break;
      case "italic":
        before = "*";
        after = "*";
        break;
      case "code":
        before = "`";
        after = "`";
        break;
      case "list":
        before = "- ";
        after = "";
        break;
    }

    const result = wrapSelection(value, start, end, before, after);
    onChange(result.text);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Tab") {
      event.preventDefault();
      const el = event.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = value.slice(0, start) + "  " + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        el.setSelectionRange(start + 2, start + 2);
      });
    }
  }

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab("write")}
            className={tabClass(tab === "write")}
          >
            Yaz
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={tabClass(tab === "preview")}
          >
            Önizle
          </button>
        </div>

        {tab === "write" ? (
          <div className="flex items-center gap-0.5">
            <ToolbarButton icon={Bold} label="Kalın" onClick={() => applyToolbarAction("bold")} />
            <ToolbarButton
              icon={Italic}
              label="İtalik"
              onClick={() => applyToolbarAction("italic")}
            />
            <ToolbarButton icon={Code} label="Kod" onClick={() => applyToolbarAction("code")} />
            <ToolbarButton icon={List} label="Liste" onClick={() => applyToolbarAction("list")} />
            <ToolbarButton
              icon={LinkIcon}
              label="Bağlantı"
              onClick={() => applyToolbarAction("link")}
            />
          </div>
        ) : null}
      </div>

      {tab === "write" ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="w-full resize-none overflow-hidden rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        />
      ) : (
        <div className="min-h-[80px] rounded-md border border-zinc-200 px-2 py-1.5 dark:border-zinc-700">
          {value.trim() ? (
            <MarkdownRenderer content={value} />
          ) : (
            <p className="text-sm text-zinc-400">Önizlenecek içerik yok.</p>
          )}
        </div>
      )}
    </div>
  );
}

function tabClass(isActive: boolean): string {
  return `rounded-md px-2 py-1 text-xs font-medium transition-colors ${
    isActive
      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
      : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
  }`;
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
