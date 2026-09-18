"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { createLabel, deleteLabel, updateLabel } from "@/actions/label";
import { ColorPicker } from "@/components/settings/color-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { validateLabelName } from "@/lib/settings-logic";

export type LabelItem = {
  id: string;
  name: string;
  color: string;
  taskCount: number;
};

export function LabelsManager({
  labels,
  projectId,
}: {
  labels: LabelItem[];
  projectId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(labels);
  const [deleteTarget, setDeleteTarget] = useState<LabelItem | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setItems(labels);
  }, [labels]);

  function handleNameSave(labelId: string, name: string) {
    const current = items.find((item) => item.id === labelId);
    if (!current || current.name === name.trim()) return;

    const validation = validateLabelName(name);
    if (!validation.valid) {
      alert(validation.error);
      setItems((prev) => prev.map((item) => (item.id === labelId ? { ...item, name: current.name } : item)));
      return;
    }

    startTransition(async () => {
      try {
        await updateLabel(labelId, { name: name.trim() });
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Etiket güncellenemedi.");
        setItems(labels);
      }
    });
  }

  function handleColorChange(labelId: string, color: string) {
    setItems((prev) => prev.map((item) => (item.id === labelId ? { ...item, color } : item)));
    startTransition(async () => {
      try {
        await updateLabel(labelId, { color });
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Renk güncellenemedi.");
        setItems(labels);
      }
    });
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    startTransition(async () => {
      try {
        await deleteLabel(targetId);
        setDeleteTarget(null);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Etiket silinemedi.");
        setDeleteTarget(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <LabelRow
            key={item.id}
            item={item}
            onNameSave={handleNameSave}
            onColorChange={handleColorChange}
            onDelete={() => setDeleteTarget(item)}
          />
        ))}
      </div>

      <NewLabelForm projectId={projectId} />

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        description={
          deleteTarget && deleteTarget.taskCount > 0
            ? `Bu etiket ${deleteTarget.taskCount} görevde kullanılıyor. Yine de silmek istediğinize emin misiniz?`
            : "Bu etiketi silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        }
        confirmLabel="Evet, Sil"
        confirmVariant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isPending}
      />
    </div>
  );
}

function LabelRow({
  item,
  onNameSave,
  onColorChange,
  onDelete,
}: {
  item: LabelItem;
  onNameSave: (id: string, name: string) => void;
  onColorChange: (id: string, color: string) => void;
  onDelete: () => void;
}) {
  const [nameValue, setNameValue] = useState(item.name);

  useEffect(() => {
    setNameValue(item.name);
  }, [item.name]);

  return (
    <div className="group flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      <ColorPicker value={item.color} onChange={(color) => onColorChange(item.id, color)} />

      <input
        type="text"
        value={nameValue}
        onChange={(e) => setNameValue(e.target.value)}
        onBlur={() => onNameSave(item.id, nameValue)}
        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-zinc-900 outline-none hover:border-zinc-200 focus:border-zinc-400 dark:text-zinc-100 dark:hover:border-zinc-700"
      />

      <span className="shrink-0 text-xs text-zinc-400">
        {item.taskCount} görevde kullanılıyor
      </span>

      <button
        type="button"
        onClick={onDelete}
        aria-label="Etiketi sil"
        className="rounded-md p-1.5 text-zinc-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function NewLabelForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#60646C");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    setIsOpen(false);
    setName("");
    setColor("#60646C");
    setError(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const validation = validateLabelName(name);
    if (!validation.valid) {
      setError(validation.error ?? "Geçersiz etiket adı.");
      return;
    }

    startTransition(async () => {
      try {
        await createLabel({ projectId, name: name.trim(), color });
        router.refresh();
        close();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Etiket oluşturulamadı.");
      }
    });
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <Plus className="h-4 w-4" />
        Yeni Etiket Ekle
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="flex items-center gap-2">
        <ColorPicker value={color} onChange={setColor} />
        <input
          autoFocus
          type="text"
          placeholder="Etiket adı"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={close}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Vazgeç
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Kaydet
        </button>
      </div>
    </form>
  );
}
