import { useDroppable } from '@dnd-kit/core';
import { KanbanCard } from './KanbanCard';
import type { Stage, Deal } from '@/services/funnelService';

interface StageColumnProps {
  stage: Stage;
  deals: Deal[];
}

export function StageColumn({ stage, deals }: StageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className="flex flex-col min-w-[272px] max-w-[272px]">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider truncate">
          {stage.name}
        </h3>
        <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5 shrink-0">
          {deals.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] rounded-lg p-2 space-y-2 border-2 transition-colors ${
          isOver
            ? 'bg-primary/10 border-primary/40'
            : 'bg-muted/30 border-transparent'
        }`}
      >
        {deals.map((deal) => (
          <KanbanCard key={deal.id} deal={deal} />
        ))}
      </div>
    </div>
  );
}
