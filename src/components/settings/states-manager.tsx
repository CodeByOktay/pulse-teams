"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { createState, deleteState, reorderStates, updateState } from "@/actions/state";
import { ColorPicker } from "@/components/settings/color-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { validateStateName } from "@/lib/settings-logic";
import type { StateGroup } from "@prisma/client";

export type StateItem = {
  id: string;
  name: string;
  color: string;
  group: StateGroup;
  sequence: number;
};

const GROUP_OPTIONS: { value: StateGroup; label: string }[] = [
  { value: "BACKLOG", label: "Backlog" },
  { value: "TODO", label: "Todo" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "DONE", label: "Done" },
  { value: "CANCELLED", label: "Cancelled" },
];

const GROUP_BADGE_CLASS: Record<StateGroup, string> = {
  BACKLOG: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  TODO: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  IN_PROGRESS: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  DONE: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400",
  CANCELLED: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
};

export function StatesManager({
  states,
  projectId,
}: {
  states: StateItem[];
  projectId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(states);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const reorderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setItems(states);
  }, [states]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setItems((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === active.id);
      const newIndex = prev.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;

      const next = [...prev];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);

      if (reorderTimeoutRef.current) {
        clearTimeout(reorderTimeoutRef.current);
      }
      reorderTimeoutRef.current = setTimeout(() => {
        startTransition(async () => {
          try {
            await reorderStates(
              projectId,
              next.map((item) => item.id),
            );
            router.refresh();
          } catch (err) {
            alert(err instanceof Error ? err.message : "Sıralama kaydedilemedi.");
            setItems(states);
          }
        });
      }, 500);

      return next;
    });
  }

  function handleNameSave(stateId: string, name: string) {
    const current = items.find((item) => item.id === stateId);
    if (!current || current.name === name.trim()) return;

    const validation = validateStateName(name);
    if (!validation.valid) {
      alert(validation.error);
      setItems((prev) => prev.map((item) => (item.id === stateId ? { ...item, name: current.name } : item)));
      return;
    }

    startTransition(async () => {
      try {
        await updateState(stateId, { name: name.trim() });
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Durum güncellenemedi.");
        setItems(states);
      }
    });
  }

  function handleColorChange(stateId: string, color: string) {
    setItems((prev) => prev.map((item) => (item.id === stateId ? { ...item, color } : item)));
    startTransition(async () => {
      try {
        await updateState(stateId, { color });
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Renk güncellenemedi.");
        setItems(states);
      }
    });
  }

  function handleGroupChange(stateId: string, group: StateGroup) {
    setItems((prev) => prev.map((item) => (item.id === stateId ? { ...item, group } : item)));
    startTransition(async () => {
      try {
        await updateState(stateId, { group });
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Durum grubu güncellenemedi.");
        setItems(states);
      }
    });
  }

  function handleDeleteConfirm() {
    if (!deleteTargetId) return;
    const targetId = deleteTargetId;
    startTransition(async () => {
      try {
        await deleteState(targetId);
        setDeleteTargetId(null);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Durum silinemedi.");
        setDeleteTargetId(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1.5">
            {items.map((item) => (
              <StateRow
                key={item.id}
                item={item}
                onNameSave={handleNameSave}
                onColorChange={handleColorChange}
                onGroupChange={handleGroupChange}
                onDelete={() => setDeleteTargetId(item.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <NewStateForm projectId={projectId} />

      <ConfirmDialog
        isOpen={deleteTargetId !== null}
        description="Bu durumu silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        confirmLabel="Evet, Sil"
        confirmVariant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTargetId(null)}
        isLoading={isPending}
      />
    </div>
  );
}

function StateRow({
  item,
  onNameSave,
  onColorChange,
  onGroupChange,
  onDelete,
}: {
  item: StateItem;
  onNameSave: (id: string, name: string) => void;
  onColorChange: (id: string, color: string) => void;
  onGroupChange: (id: string, group: StateGroup) => void;
  onDelete: () => void;
}) {
  const [nameValue, setNameValue] = useState(item.name);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  useEffect(() => {
    setNameValue(item.name);
  }, [item.name]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 py-2 dark:border-zinc-800 dark:bg-zinc-900 ${
        isDragging ? "opacity-50 shadow-lg" : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Sürükle"
        className="cursor-grab touch-none text-zinc-400 hover:text-zinc-600 active:cursor-grabbing dark:hover:text-zinc-300"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <ColorPicker value={item.color} onChange={(color) => onColorChange(item.id, color)} />

      <input
        type="text"
        value={nameValue}
        onChange={(e) => setNameValue(e.target.value)}
        onBlur={() => onNameSave(item.id, nameValue)}
        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-zinc-900 outline-none hover:border-zinc-200 focus:border-zinc-400 dark:text-zinc-100 dark:hover:border-zinc-700"
      />

      <select
        value={item.group}
        onChange={(e) => onGroupChange(item.id, e.target.value as StateGroup)}
        className={`rounded-full border-0 px-2 py-1 text-xs font-medium outline-none ${GROUP_BADGE_CLASS[item.group]}`}
      >
        {GROUP_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onDelete}
        aria-label="Durumu sil"
        className="rounded-md p-1.5 text-zinc-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function NewStateForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#60646C");
  const [group, setGroup] = useState<StateGroup>("BACKLOG");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    setIsOpen(false);
    setName("");
    setColor("#60646C");
    setGroup("BACKLOG");
    setError(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const validation = validateStateName(name);
    if (!validation.valid) {
      setError(validation.error ?? "Geçersiz durum adı.");
      return;
    }

    startTransition(async () => {
      try {
        await createState({ projectId, name: name.trim(), color, group });
        router.refresh();
        close();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Durum oluşturulamadı.");
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
        Yeni Durum Ekle
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
          placeholder="Durum adı"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800"
        />
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value as StateGroup)}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800"
        >
          {GROUP_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
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
