"use client";

import { useEffect, useRef, useState } from "react";
import { validateHexColor } from "@/lib/settings-logic";

const COLOR_INPUT_DEBOUNCE_MS = 200;

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const [hexInput, setHexInput] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  // Set while a native-picker change is waiting to be propagated; prevents an
  // echoed (older) prop value from overwriting the color the user is dragging to.
  const [hasPendingColor, setHasPendingColor] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingColorRef = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Render-phase prop synchronization (React 19 pattern, no effect needed).
  if (prevValue !== value) {
    setPrevValue(value);
    if (!hasPendingColor) {
      setHexInput(value);
    }
  }

  function cancelPending() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingColorRef.current = null;
  }

  function flushPending() {
    const color = pendingColorRef.current;
    cancelPending();
    if (color !== null) {
      setHasPendingColor(false);
      onChangeRef.current(color);
    }
  }

  // Flush (rather than drop) a still-pending color when the picker unmounts.
  useEffect(() => {
    return () => {
      const color = pendingColorRef.current;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingColorRef.current = null;
      if (color !== null) {
        onChangeRef.current(color);
      }
    };
  }, []);

  function handleHexChange(raw: string) {
    let next = raw.trim();
    if (next && !next.startsWith("#")) {
      next = `#${next}`;
    }
    setHexInput(next);

    // Text edits win over a pending picker drag.
    cancelPending();
    setHasPendingColor(false);

    if (validateHexColor(next)) {
      onChange(next);
    }
  }

  function handleColorInputChange(color: string) {
    // Local display updates immediately; only the propagated callback is debounced.
    setHexInput(color);
    setHasPendingColor(true);
    pendingColorRef.current = color;

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(flushPending, COLOR_INPUT_DEBOUNCE_MS);
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={validateHexColor(hexInput) ? hexInput : "#60646C"}
        onChange={(e) => handleColorInputChange(e.target.value)}
        onBlur={flushPending}
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
