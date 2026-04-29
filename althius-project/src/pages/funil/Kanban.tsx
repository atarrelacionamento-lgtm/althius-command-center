import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { KanbanBoard } from '@/components/funil/KanbanBoard';
import { getFunnels, getStages, getDeals } from '@/services/funnelService';
import type { Funnel, Stage, Deal } from '@/services/funnelService';

export default function Kanban() {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    getFunnels()
      .then((data) => {
        setFunnels(data);
        if (data.length > 0) {
          setSelectedFunnelId(data[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedFunnelId) return;
    setLoading(true);
    Promise.all([getStages(selectedFunnelId), getDeals(selectedFunnelId)])
      .then(([s, d]) => {
        setStages(s);
        setDeals(d);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedFunnelId]);

  const selectedFunnel = funnels.find((f) => f.id === selectedFunnelId);

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Funil</h1>

        {/* Funnel selector */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-secondary transition-colors text-foreground"
          >
            {selectedFunnel?.name ?? 'Selecionar funil'}
            <ChevronDown className="h-4 w-4" />
          </button>

          {dropdownOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg z-20 min-w-[200px]">
                {funnels.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      setSelectedFunnelId(f.id);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-secondary transition-colors first:rounded-t-lg last:rounded-b-lg ${
                      f.id === selectedFunnelId
                        ? 'text-primary font-semibold'
                        : 'text-foreground'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
                {funnels.length === 0 && (
                  <p className="px-4 py-2.5 text-sm text-muted-foreground">
                    Nenhum funil cadastrado
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          Carregando...
        </div>
      ) : stages.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          Nenhum estágio configurado para este funil.
        </div>
      ) : (
        <KanbanBoard stages={stages} deals={deals} onDealsChange={setDeals} />
      )}
    </DashboardLayout>
  );
}
