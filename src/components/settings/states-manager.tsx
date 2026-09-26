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
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import {
  createState,
  deleteState,
  reorderStates,
  updateState,
  type UpdateStateInput,
} from "@/actions/state";
import { ColorPicker } from "@/components/settings/color-picker";
import { InlineNameInput } from "./inline-name-input";
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

const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 5 } };

const REORDER_DEBOUNCE_MS = 500;

const DEFAULT_COLOR = "#60646C";

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
  const [syncedStates, setSyncedStates] = useState(states);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const reorderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestStatesRef = useRef(states);

  if (syncedStates !== states) {
    setSyncedStates(states);
    setItems(states);
  }

  useEffect(() => {
    latestStatesRef.current = states;
  }, [states]);

  const sensors = useSensors(useSensor(PointerSensor, POINTER_SENSOR_OPTIONS));

  /** Başarısız kayıtlarda iyimser değişiklikleri sunucudaki son duruma geri alır. */
  function rollback() {
    setItems(latestStatesRef.current);
  }

  function patchItem(stateId: string, patch: Partial<StateItem>) {
    setItems((prev) => prev.map((item) => (item.id === stateId ? { ...item, ...patch } : item)));
  }

  function saveState(stateId: string, data: UpdateStateInput, fallbackError: string) {
    startTransition(async () => {
      try {
        await updateState(stateId, data);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : fallbackError);
        rollback();
      }
    });
  }

  // Zamanlayıcı unmount'ta temizlenmez: sekme değişse bile bekleyen sıralama kaydedilir.
  function scheduleReorderSave(orderedIds: string[]) {
    if (reorderTimeoutRef.current) {
      clearTimeout(reorderTimeoutRef.current);
    }
    reorderTimeoutRef.current = setTimeout(() => {
      startTransition(async () => {
        try {
          await reorderStates(projectId, orderedIds);
          router.refresh();
        } catch (err) {
          alert(err instanceof Error ? err.message : "Sıralama kaydedilemedi.");
          rollback();
        }
      });
    }, REORDER_DEBOUNCE_MS);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    scheduleReorderSave(next.map((item) => item.id));
  }

  function handleNameSave(stateId: string, rawName: string) {
    const name = rawName.trim();
    const current = items.find((item) => item.id === stateId);
    if (!current || current.name === name) return;

    const validation = validateStateName(name);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    patchItem(stateId, { name });
    saveState(stateId, { name }, "Durum güncellenemedi.");
  }

  function handleColorChange(stateId: string, color: string) {
    patchItem(stateId, { color });
    saveState(stateId, { color }, "Renk güncellenemedi.");
  }

  function handleGroupChange(stateId: string, group: StateGroup) {
    patchItem(stateId, { group });
    saveState(stateId, { group }, "Durum grubu güncellenemedi.");
  }

  function handleDeleteConfirm() {
    if (!deleteTargetId) return;
    const targetId = deleteTargetId;
    startTransition(async () => {
      try {
        await deleteState(targetId);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Durum silinemedi.");
      } finally {
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
                isOnlyState={items.length <= 1}
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
  isOnlyState,
  onNameSave,
  onColorChange,
  onGroupChange,
  onDelete,
}: {
  item: StateItem;
  isOnlyState: boolean;
  onNameSave: (id: string, name: string) => void;
  onColorChange: (id: string, color: string) => void;
  onGroupChange: (id: string, group: StateGroup) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

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

      <InlineNameInput value={item.name} onSave={(name) => onNameSave(item.id, name)} />

      <GroupSelect
        value={item.group}
        onChange={(group) => onGroupChange(item.id, group)}
        className={`rounded-full border-0 px-2 py-1 text-xs font-medium outline-none ${GROUP_BADGE_CLASS[item.group]}`}
      />

      <button
        type="button"
        onClick={onDelete}
        disabled={isOnlyState}
        title={isOnlyState ? "Projede en az bir durum kalmalıdır." : undefined}
        aria-label="Durumu sil"
        className={`rounded-md p-1.5 text-zinc-300 transition-opacity ${
          isOnlyState
            ? "cursor-not-allowed opacity-40"
            : "opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950"
        }`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function GroupSelect({
  value,
  onChange,
  className,
}: {
  value: StateGroup;
  onChange: (group: StateGroup) => void;
  className: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as StateGroup)}
      className={className}
    >
      {GROUP_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function NewStateForm({ projectId }: { projectId: string }) {
  const [isOpen, setIsOpen] = useState(false);

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

  return <NewStateFormFields projectId={projectId} onClose={() => setIsOpen(false)} />;
}

function NewStateFormFields({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [group, setGroup] = useState<StateGroup>("BACKLOG");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Durum oluşturulamadı.");
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
          placeholder="Durum adı"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800"
        />
        <GroupSelect
          value={group}
          onChange={setGroup}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800"
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
