import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Upload, Search, Pencil, Trash2, Linkedin, Sparkles, ChevronRight } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ContactForm } from '@/components/crm/ContactForm';
import { ImportCSV } from '@/components/crm/ImportCSV';
import { Can } from '@/components/Can';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Skeleton } from '@/components/ui/skeleton';
import { getContacts, deleteContact, getProfiles } from '@/services/crmService';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { Contact } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Contacts() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('__all__');
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState<Contact | null>(null);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', search, ownerFilter],
    queryFn: () => getContacts({ search, ownerId: ownerFilter === '__all__' ? undefined : ownerFilter }),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: getProfiles,
    enabled: isAdmin,
  });

  useEffect(() => {
    const channel = supabase
      .channel('contacts-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        qc.invalidateQueries({ queryKey: ['contacts'] });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'companies' }, () => {
        qc.invalidateQueries({ queryKey: ['contacts'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteContact(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contato removido.');
      setDeleting(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function confirmDelete() {
    if (!deleting) return;
    deleteMutation.mutate(deleting.id);
  }

  function openCreate() { setEditing(null); setFormOpen(true); }
  function openEdit(c: Contact, event: React.MouseEvent) {
    event.stopPropagation();
    setEditing(c);
    setFormOpen(true);
  }
  function goToContact(c: Contact) {
    navigate(`/crm/contatos/${c.id}`);
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contatos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Pessoas ligadas às contas e oportunidades</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1.5" /> Importar CSV
          </Button>
          <Can admin>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" /> Criar contato
            </Button>
          </Can>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
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
              <TableHead>Nome</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>LinkedIn</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell className="w-20"><Skeleton className="h-4 w-4 ml-auto" /></TableCell>
              </TableRow>
            ))}
            {!isLoading && contacts.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Nenhum contato encontrado.
                </TableCell>
              </TableRow>
            )}
            {contacts.map((c) => (
              <TableRow
                key={c.id}
                className="group cursor-pointer hover:bg-muted/40"
                onClick={() => goToContact(c)}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span className="hover:underline">{c.name}</span>
                    {c.enrichment_source && (
                      <Sparkles className="h-3 w-3 text-primary" aria-label="Enriquecido" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{c.role ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{c.email ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{c.whatsapp ?? c.phone ?? '—'}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {c.linkedin_url ? (
                    <a
                      href={c.linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <Linkedin className="h-3.5 w-3.5" /> Perfil
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {c.company ? (
                    <button
                      type="button"
                      className="text-left font-medium hover:text-primary hover:underline"
                      onClick={() => navigate(`/crm/empresas/${c.company!.id}`)}
                    >
                      {c.company.name}
                    </button>
                  ) : '—'}
                </TableCell>
                <TableCell>{c.owner?.name ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(c.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <Can admin>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => openEdit(c, e)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleting(c); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </Can>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ContactForm open={formOpen} onOpenChange={setFormOpen} contact={editing} />
      <ImportCSV open={importOpen} onOpenChange={setImportOpen} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover contato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleting?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending || !deleting}
            >
              {deleteMutation.isPending ? 'Removendo…' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
