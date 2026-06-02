import { type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type SortableListProps<T extends { id: string }> = {
  items: T[];
  onReorder: (next: T[]) => void;
  renderItem: (item: T, handle: ReactNode) => ReactNode;
  // Optional predicate — items returning false are rendered but locked in place.
  isDraggable?: (item: T) => boolean;
};

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  isDraggable,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    // Respect lock predicate — if either endpoint is locked, refuse the move.
    if (isDraggable && (!isDraggable(items[from]) || !isDraggable(items[to]))) return;
    onReorder(arrayMove(items, from, to));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {items.map((item) => (
          <SortableRow
            key={item.id}
            id={item.id}
            disabled={isDraggable ? !isDraggable(item) : false}
            renderItem={(handle) => renderItem(item, handle)}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  disabled,
  renderItem,
}: {
  id: string;
  disabled: boolean;
  renderItem: (handle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
    zIndex: isDragging ? 50 : "auto",
  };

  const handle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      title={disabled ? "Locked" : "Drag to reorder"}
      disabled={disabled}
      className={`px-1 text-sm leading-none select-none ${
        disabled
          ? "opacity-20 cursor-not-allowed"
          : "cursor-grab active:cursor-grabbing hover:text-[color:var(--gold)]"
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      ⋮⋮
    </button>
  );

  return (
    <div ref={setNodeRef} style={style}>
      {renderItem(handle)}
    </div>
  );
}
