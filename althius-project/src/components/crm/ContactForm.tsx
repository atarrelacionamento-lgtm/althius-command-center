import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { createContact, updateContact, getCompanies, getProfiles } from '@/services/crmService';
import { useAuth } from '@/hooks/useAuth';
import type { Contact } from '@/types';
import { CONTACT_SOURCES } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  defaultCompanyId?: string;
}

interface FormState {
  name: string;
  role: string;
  email: string;
  whatsapp: string;
  company_id: string;
  source: string;
  owner_id: string;
}

const EMPTY: FormState = {
  name: '', role: '', email: '', whatsapp: '', company_id: '', source: '', owner_id: '',
};

const NO_SOURCE = '__none__';

export function ContactForm({ open, onOpenChange, contact, defaultCompanyId = '' }: Props) {
  const qc = useQueryClient();
  const { profile, isAdmin } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY);

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => getCompanies(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: getProfiles,
    enabled: isAdmin,
  });

  useEffect(() => {
    if (contact) {
      setForm({
        name:       contact.name,
        role:       contact.role ?? '',
        email:      contact.email ?? '',
        whatsapp:   contact.whatsapp ?? '',
        company_id: contact.company_id ?? '',
        source:     contact.source ?? '',
        owner_id:   contact.owner_id,
      });
    } else {
      setForm({ ...EMPTY, company_id: defaultCompanyId, owner_id: profile?.id ?? '' });
    }
  }, [contact, defaultCompanyId, profile?.id, open]);

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name:       form.name,
        role:       form.role || null,
        email:      form.email || null,
        whatsapp:   form.whatsapp || null,
        company_id: form.company_id || null,
        source:     form.source || null,
        owner_id:   form.owner_id || profile!.id,
      };
      return contact
        ? updateContact(contact.id, payload)
        : createContact(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      if (form.company_id) qc.invalidateQueries({ queryKey: ['contacts-by-company', form.company_id] });
      toast.success(contact ? 'Contato atualizado.' : 'Contato criado.');
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Nome é obrigatório.');
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{contact ? 'Editar contato' : 'Novo contato'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ct-name">Nome *</Label>
            <Input id="ct-name" value={form.name} onChange={set('name')} required />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ct-role">Cargo</Label>
              <Input id="ct-role" value={form.role} onChange={set('role')} placeholder="Ex: Diretor" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-email">E-mail</Label>
              <Input id="ct-email" type="email" value={form.email} onChange={set('email')} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ct-whatsapp">WhatsApp</Label>
              <Input id="ct-whatsapp" value={form.whatsapp} onChange={set('whatsapp')} placeholder="+55 11 9..." />
            </div>
            <div className="space-y-1.5">
              <Label>Fonte</Label>
              <Select
                value={form.source || NO_SOURCE}
                onValueChange={(v) => setForm((p) => ({ ...p, source: v === NO_SOURCE ? '' : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SOURCE}>— Não informado —</SelectItem>
                  {CONTACT_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Empresa vinculada</Label>
            <Select
              value={form.company_id || '__none__'}
              onValueChange={(v) => setForm((p) => ({ ...p, company_id: v === '__none__' ? '' : v }))}
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Nenhuma —</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isAdmin && profiles.length > 0 && (
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select
                value={form.owner_id}
                onValueChange={(v) => setForm((p) => ({ ...p, owner_id: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name ?? p.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
