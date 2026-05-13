import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Module } from '@/types';

function SortableModule({
  module,
  isComplete,
}: {
  module: Module;
  isComplete: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: module.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-3 rounded-xl bg-surface p-3 border shadow-sm cursor-grab active:cursor-grabbing ${
        isComplete ? 'opacity-60 border-green/30' : 'border-border'
      }`}
    >
      <span className="text-text-3 text-lg">⋮⋮</span>
      <div className="flex-1">
        <p className={`font-semibold text-sm ${isComplete ? 'line-through text-text-3' : 'text-primary'}`}>
          {module.title}
        </p>
        <p className="text-xs text-text-3">{module.goal}</p>
      </div>
    </div>
  );
}

interface ModuleReorderProps {
  modules: Module[];
  onReorder: (modules: Module[]) => void;
}

export default function ModuleReorder({ modules, onReorder }: ModuleReorderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = modules.findIndex((m) => m.id === active.id);
      const newIndex = modules.findIndex((m) => m.id === over.id);
      onReorder(arrayMove(modules, oldIndex, newIndex));
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {modules.map((mod) => (
            <SortableModule key={mod.id} module={mod} isComplete={mod.isComplete} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
