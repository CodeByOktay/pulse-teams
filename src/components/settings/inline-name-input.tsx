"use client";

import { useState } from "react";

export function InlineNameInput({
  value,
  onSave,
}: {
  value: string;
  onSave: (name: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);

  if (syncedValue !== value) {
    setSyncedValue(value);
    setDraft(value);
  }

  // Kayıt reddedilirse (geçersiz ad) taslak, son kaydedilen adla geri döner.
  function commit() {
    onSave(draft);
    setDraft(value);
  }

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-zinc-900 outline-none hover:border-zinc-200 focus:border-zinc-400 dark:text-zinc-100 dark:hover:border-zinc-700"
    />
  );
}
