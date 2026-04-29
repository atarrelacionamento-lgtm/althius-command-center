import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, Pencil, Check, X } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import {
  getFunnels,
  getStages,
  createFunnel,
  updateFunnel,
  deleteFunnel,
  createStage,
  updateStage,
  deleteStage,
} from '@/services/funnelService';
import type { Funnel, Stage } from '@/services/funnelService';

export default function FunnelConfig() {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);

  // Inline edit state
  const [editingFunnelId, setEditingFunnelId] = useState<string | null>(null);
  const [editingFunnelName, setEditingFunnelName] = useState('');
  const [newFunnelName, setNewFunnelName] = useState('');
  const [addingFunnel, setAddingFunnel] = useState(false);

  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStgName, setEditingStgName] = useState('');
  const [newStageName, setNewStageName] = useState('');
  const [addingStage, setAddingStage] = useState(false);

  useEffect(() => {
    getFunnels()
      .then((data) => {
        setFunnels(data);
        if (data.length > 0) setSelectedFunnelId(data[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedFunnelId) return;
    getStages(selectedFunnelId).then(setStages).catch(console.error);
  }, [selectedFunnelId]);

  // ── Funnel actions ────────────────────────────────────────

  async function handleCreateFunnel() {
    if (!newFunnelName.trim()) return;
    const funnel = await createFunnel(newFunnelName.trim());
    setFunnels((prev) => [...prev, funnel]);
    setNewFunnelName('');
    setAddingFunnel(false);
    setSelectedFunnelId(funnel.id);
  }

  async function handleRenameFunnel(id: string) {
    if (!editingFunnelName.trim()) return;
    await updateFunnel(id, editingFunnelName.trim());
    setFunnels((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name: editingFunnelName.trim() } : f))
    );
    setEditingFunnelId(null);
  }

  async function handleDeleteFunnel(id: string) {
    if (!confirm('Excluir este funil e todos os seus estágios?')) return;
    await deleteFunnel(id);
    const updated = funnels.filter((f) => f.id !== id);
    setFunnels(updated);
    if (selectedFunnelId === id) {
      setSelectedFunnelId(updated[0]?.id ?? null);
      setStages([]);
    }
  }

  // ── Stage actions ─────────────────────────────────────────

  async function handleCreateStage() {
    if (!newStageName.trim() || !selectedFunnelId) return;
    const stage = await createStage(selectedFunnelId, newStageName.trim(), stages.length);
    setStages((prev) => [...prev, stage]);
    setNewStageName('');
    setAddingStage(false);
  }

  async function handleRenameStage(id: string) {
    if (!editingStgName.trim()) return;
    const stage = stages.find((s) => s.id === id)!;
    await updateStage(id, editingStgName.trim(), stage.order);
    setStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name: editingStgName.trim() } : s))
    );
    setEditingStageId(null);
  }

  async function handleDeleteStage(id: string) {
    await deleteStage(id);
    const remaining = stages.filter((s) => s.id !== id);
    // Re-order
    const reordered = remaining.map((s, i) => ({ ...s, order: i }));
    setStages(reordered);
    await Promise.all(reordered.map((s) => updateStage(s.id, s.name, s.order)));
  }

  const selectedFunnel = funnels.find((f) => f.id === selectedFunnelId);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          Carregando...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Configuração de Funis</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Funis ── */}
        <div className="chart-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Funis
            </h2>
            <button
              onClick={() => setAddingFunnel(true)}
              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1">
            {funnels.map((f) => (
              <div
                key={f.id}
                onClick={() => {
                  setSelectedFunnelId(f.id);
                  setEditingFunnelId(null);
                }}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  f.id === selectedFunnelId
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted text-foreground'
                }`}
              >
                {editingFunnelId === f.id ? (
                  <div
                    className="flex-1 flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      autoFocus
                      value={editingFunnelName}
                      onChange={(e) => setEditingFunnelName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameFunnel(f.id);
                        if (e.key === 'Escape') setEditingFunnelId(null);
                      }}
                      className="flex-1 text-sm bg-background border border-border rounded px-2 py-0.5 text-foreground"
                    />
                    <button onClick={() => handleRenameFunnel(f.id)}>
                      <Check className="h-3.5 w-3.5 text-primary" />
                    </button>
                    <button onClick={() => setEditingFunnelId(null)}>
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium truncate">{f.name}</span>
                    <div className="hidden group-hover:flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingFunnelId(f.id);
                          setEditingFunnelName(f.name);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFunnel(f.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {addingFunnel && (
              <div className="flex items-center gap-1 px-3 py-2">
                <input
                  autoFocus
                  value={newFunnelName}
                  onChange={(e) => setNewFunnelName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateFunnel();
                    if (e.key === 'Escape') setAddingFunnel(false);
                  }}
                  placeholder="Nome do funil"
                  className="flex-1 text-sm bg-background border border-border rounded px-2 py-0.5 text-foreground placeholder:text-muted-foreground"
                />
                <button onClick={handleCreateFunnel}>
                  <Check className="h-3.5 w-3.5 text-primary" />
                </button>
                <button onClick={() => setAddingFunnel(false)}>
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Estágios ── */}
        <div className="lg:col-span-2 chart-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Estágios — {selectedFunnel?.name ?? ''}
            </h2>
            {selectedFunnelId && (
              <button
                onClick={() => setAddingStage(true)}
                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>

          {!selectedFunnelId ? (
            <p className="text-sm text-muted-foreground">Selecione um funil à esquerda.</p>
          ) : (
            <div className="space-y-1">
              {stages.map((s, idx) => (
                <div
                  key={s.id}
                  className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  <span className="text-xs text-muted-foreground w-5 shrink-0">{idx + 1}</span>

                  {editingStageId === s.id ? (
                    <div className="flex-1 flex items-center gap-1">
                      <input
                        autoFocus
                        value={editingStgName}
                        onChange={(e) => setEditingStgName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameStage(s.id);
                          if (e.key === 'Escape') setEditingStageId(null);
                        }}
                        className="flex-1 text-sm bg-background border border-border rounded px-2 py-0.5 text-foreground"
                      />
                      <button onClick={() => handleRenameStage(s.id)}>
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </button>
                      <button onClick={() => setEditingStageId(null)}>
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-foreground">{s.name}</span>
                      <div className="hidden group-hover:flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingStageId(s.id);
                            setEditingStgName(s.name);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        </button>
                        <button onClick={() => handleDeleteStage(s.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {stages.length === 0 && !addingStage && (
                <p className="text-sm text-muted-foreground px-3 py-2">
                  Nenhum estágio ainda. Clique em + para adicionar.
                </p>
              )}

              {addingStage && (
                <div className="flex items-center gap-2 px-3 py-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  <span className="text-xs text-muted-foreground w-5 shrink-0">
                    {stages.length + 1}
                  </span>
                  <input
                    autoFocus
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateStage();
                      if (e.key === 'Escape') setAddingStage(false);
                    }}
                    placeholder="Nome do estágio"
                    className="flex-1 text-sm bg-background border border-border rounded px-2 py-0.5 text-foreground placeholder:text-muted-foreground"
                  />
                  <button onClick={handleCreateStage}>
                    <Check className="h-3.5 w-3.5 text-primary" />
                  </button>
                  <button onClick={() => setAddingStage(false)}>
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              )}

              <div className="pt-4">
                <Button
                  size="sm"
                  onClick={() => setAddingStage(true)}
                  variant="outline"
                  className="text-xs"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar estágio
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
