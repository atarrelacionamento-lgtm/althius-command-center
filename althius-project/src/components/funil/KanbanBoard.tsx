import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { StageColumn } from './StageColumn';
import { KanbanCard } from './KanbanCard';
import { moveDeal } from '@/services/funnelService';
import { useAuth } from '@/hooks/useAuth';
import type { Stage, Deal } from '@/services/funnelService';

interface KanbanBoardProps {
  stages: Stage[];
  deals: Deal[];
  onDealsChange: (deals: Deal[]) => void;
}

export function KanbanBoard({ stages, deals, onDealsChange }: KanbanBoardProps) {
  const { session } = useAuth();
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const deal = deals.find((d) => d.id === event.active.id);
      setActiveDeal(deal ?? null);
    },
    [deals]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDeal(null);
      const { active, over } = event;
      if (!over) return;

      const draggedDeal = deals.find((d) => d.id === active.id);
      if (!draggedDeal) return;

      const toStageId = over.id as string;
      if (draggedDeal.stage_id === toStageId) return;

      // Optimistic update
      const updated = deals.map((d) =>
        d.id === draggedDeal.id ? { ...d, stage_id: toStageId } : d
      );
      onDealsChange(updated);

      try {
        await moveDeal(
          draggedDeal.id,
          draggedDeal.stage_id,
          toStageId,
          session?.user.id ?? ''
        );
      } catch {
        // Revert on error
        onDealsChange(deals);
      }
    },
    [deals, onDealsChange, session]
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px]">
        {stages.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            deals={deals.filter((d) => d.stage_id === stage.id)}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeDeal ? <KanbanCard deal={activeDeal} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
