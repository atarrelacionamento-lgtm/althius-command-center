import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { DealForm } from '@/components/crm/DealForm';
import { Can } from '@/components/Can';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getDeals, deleteDeal, getProfiles } from '@/services/crmService';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { Deal } from '@/types';
import { DEAL_STAGES } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STAGE_COLORS: Record<string, string> = {
  'Qualificação':       'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  'Proposta':           'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  'Negociação':         'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  'Fechado - Ganho':    'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  'Fechado - Perdido':  'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

function formatCurrency(value: number | null): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return format(new Date(year, month - 1, day), 'dd/MM/yyyy', { locale: ptBR });
}

export default function Deals() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('__all__');
  const [ownerFilter, setOwnerFilter] = useState('__all__');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [deleting, setDeleting] = useState<Deal | null>(null);

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['deals', search, stageFilter, ownerFilter],
    queryFn: () => getDeals({
      search,
      stage:   stageFilter === '__all__' ? undefined : stageFilter,
      ownerId: ownerFilter === '__all__' ? undefined : ownerFilter,
    }),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: getProfiles,
    enabled: isAdmin,
  });

  useEffect(() => {
    const channel = supabase
      .channel('deals-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => {
        qc.invalidateQueries({ queryKey: ['deals'] });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'companies' }, () => {
        qc.invalidateQueries({ queryKey: ['deals'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const deleteMutation = useMutation({
    mutationFn: () => deleteDeal(deleting!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Negócio removido.');
      setDeleting(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openCreate() { setEditing(null); setFormOpen(true); }
  function openEdit(d: Deal) { setEditing(d); setFormOpen(true); }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Negócios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Oportunidades comerciais por conta e estágio</p>
        </div>
        <Can admin>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" /> Criar negócio
          </Button>
        </Can>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos os estágios" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os estágios</SelectItem>
            {DEAL_STAGES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAdmin && profiles.length > 0 && (
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todos os responsáveis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os responsáveis</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name ?? p.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Estágio</TableHead>
              <TableHead>Funil</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Data prevista</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && deals.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Nenhum negócio encontrado.
                </TableCell>
              </TableRow>
            )}
            {deals.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium max-w-[180px] truncate">{d.title}</TableCell>
                <TableCell className="font-mono text-sm">{formatCurrency(d.value)}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[d.stage] ?? 'bg-muted text-muted-foreground'}`}>
                    {d.stage}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{d.funnel?.name ?? '—'}</TableCell>
                <TableCell>{d.contact?.name ?? '—'}</TableCell>
                <TableCell>
                  {d.company ? (
                    <button
                      type="button"
                      className="text-left font-medium hover:text-primary hover:underline"
                      onClick={() => navigate(`/crm/empresas/${d.company!.id}`)}
                    >
                      {d.company.name}
                    </button>
                  ) : '—'}
                </TableCell>
                <TableCell>{d.owner?.name ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {d.expected_close
                    ? formatDateOnly(d.expected_close)
                    : '—'}
                </TableCell>
                <TableCell>
                  <Can admin>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleting(d)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Can>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <DealForm open={formOpen} onOpenChange={setFormOpen} deal={editing} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover negócio</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleting?.title}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Removendo…' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
