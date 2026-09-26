"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { createLabel, deleteLabel, updateLabel } from "@/actions/label";
import { ColorPicker } from "@/components/settings/color-picker";
import { InlineNameInput } from "./inline-name-input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { validateLabelName } from "@/lib/settings-logic";

export type LabelItem = {
  id: string;
  name: string;
  color: string;
  taskCount: number;
};

const DEFAULT_COLOR = "#60646C";

export function LabelsManager({
  labels,
  projectId,
}: {
  labels: LabelItem[];
  projectId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(labels);
  const [syncedLabels, setSyncedLabels] = useState(labels);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const latestLabelsRef = useRef(labels);

  if (syncedLabels !== labels) {
    setSyncedLabels(labels);
    setItems(labels);
  }

  useEffect(() => {
    latestLabelsRef.current = labels;
  }, [labels]);

  const deleteTarget = items.find((item) => item.id === deleteTargetId) ?? null;

  /** Başarısız kayıtlarda iyimser değişiklikleri sunucudaki son duruma geri alır. */
  function rollback() {
    setItems(latestLabelsRef.current);
  }

  function patchItem(labelId: string, patch: Partial<LabelItem>) {
    setItems((prev) => prev.map((item) => (item.id === labelId ? { ...item, ...patch } : item)));
  }

  function saveLabel(
    labelId: string,
    data: Partial<Pick<LabelItem, "name" | "color">>,
    fallbackError: string,
  ) {
    startTransition(async () => {
      try {
        await updateLabel(labelId, data);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : fallbackError);
        rollback();
      }
    });
  }

  function handleNameSave(labelId: string, rawName: string) {
    const name = rawName.trim();
    const current = items.find((item) => item.id === labelId);
    if (!current || current.name === name) return;

    const validation = validateLabelName(name);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    patchItem(labelId, { name });
    saveLabel(labelId, { name }, "Etiket güncellenemedi.");
  }

  function handleColorChange(labelId: string, color: string) {
    patchItem(labelId, { color });
    saveLabel(labelId, { color }, "Renk güncellenemedi.");
  }

  function handleDeleteConfirm() {
    if (!deleteTargetId) return;
    const targetId = deleteTargetId;
    startTransition(async () => {
      try {
        await deleteLabel(targetId);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Etiket silinemedi.");
      } finally {
        setDeleteTargetId(null);
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
            onDelete={() => setDeleteTargetId(item.id)}
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
        onCancel={() => setDeleteTargetId(null)}
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
  return (
    <div className="group flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      <ColorPicker value={item.color} onChange={(color) => onColorChange(item.id, color)} />

      <InlineNameInput value={item.name} onSave={(name) => onNameSave(item.id, name)} />

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
  const [isOpen, setIsOpen] = useState(false);

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

  return <NewLabelFormFields projectId={projectId} onClose={() => setIsOpen(false)} />;
}

function NewLabelFormFields({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Etiket oluşturulamadı.");
      }
    });
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
          onClick={onClose}
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
