"use client";

import { useEffect, useState } from "react";
import { validateHexColor } from "@/lib/settings-logic";

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const [hexInput, setHexInput] = useState(value);

  useEffect(() => {
    setHexInput(value);
  }, [value]);

  function handleHexChange(raw: string) {
    let next = raw.trim();
    if (next && !next.startsWith("#")) {
      next = `#${next}`;
    }
    setHexInput(next);

    if (validateHexColor(next)) {
      onChange(next);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={validateHexColor(value) ? value : "#60646C"}
        onChange={(e) => {
          setHexInput(e.target.value);
          onChange(e.target.value);
        }}
        aria-label="Renk seç"
        className="h-7 w-7 shrink-0 cursor-pointer rounded border border-zinc-300 bg-transparent p-0 dark:border-zinc-700"
      />
      <input
        type="text"
        value={hexInput}
        onChange={(e) => handleHexChange(e.target.value)}
        placeholder="#RRGGBB"
        maxLength={7}
        className={`w-24 rounded-md border px-2 py-1 text-xs font-mono outline-none ${
          validateHexColor(hexInput)
            ? "border-zinc-300 focus:border-zinc-500 dark:border-zinc-700"
            : "border-red-300 focus:border-red-500 dark:border-red-800"
        } bg-white text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300`}
      />
    </div>
  );
}
