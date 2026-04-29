import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { DollarSign } from 'lucide-react';
import type { Deal } from '@/services/funnelService';

interface KanbanCardProps {
  deal: Deal;
}

export function KanbanCard({ deal }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: deal.id, data: { deal } });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow"
    >
      <p className="font-medium text-sm text-foreground truncate mb-2">{deal.title}</p>
      {deal.value != null && deal.value > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
          <DollarSign className="h-3 w-3 shrink-0" />
          <span>R$ {deal.value.toLocaleString('pt-BR')}</span>
        </div>
      )}
    </div>
  );
}
