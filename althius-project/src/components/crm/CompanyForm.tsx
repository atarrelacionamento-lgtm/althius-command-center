import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { createCompany, updateCompany, getProfiles } from '@/services/crmService';
import { useAuth } from '@/hooks/useAuth';
import type { Company, SalesModel } from '@/types';
import { COMPANY_SEGMENTS } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: Company | null;
}

interface FormState {
  name: string;
  cnpj: string;
  city: string;
  state: string;
  segment: string;
  website: string;
  sales_model: SalesModel | '';
  has_active_launch: boolean;
  upcoming_launch: boolean;
  vgv_projected: string;
  monthly_media_spend: string;
  linkedin_url: string;
  instagram_url: string;
  facebook_url: string;
  employees_count: string;
  founded_year: string;
  owner_id: string;
}

const NO_SEGMENT = '__none__';
const NO_SALES_MODEL = '__none__';

const SALES_MODEL_OPTIONS: { value: SalesModel; label: string }[] = [
  { value: 'internal', label: 'Somente interno' },
  { value: 'external', label: 'Somente externo corretores' },
  { value: 'hybrid', label: 'Híbrido (interno + externo)' },
];

const EMPTY: FormState = {
  name: '',
  cnpj: '',
  city: '',
  state: '',
  segment: '',
  website: '',
  sales_model: '',
  has_active_launch: false,
  upcoming_launch: false,
  vgv_projected: '',
  monthly_media_spend: '',
  linkedin_url: '',
  instagram_url: '',
  facebook_url: '',
  employees_count: '',
  founded_year: '',
  owner_id: '',
};

function toOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function CompanyForm({ open, onOpenChange, company }: Props) {
  const qc = useQueryClient();
  const { profile, isAdmin } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY);

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: getProfiles,
    enabled: isAdmin,
  });

  useEffect(() => {
    if (company) {
      setForm({
        name:                company.name,
        cnpj:                company.cnpj ?? '',
        city:                company.city ?? '',
        state:               company.state ?? '',
        segment:             company.segment ?? '',
        website:             company.website ?? '',
        sales_model:         company.sales_model ?? '',
        has_active_launch:   company.has_active_launch,
        upcoming_launch:     company.upcoming_launch,
        vgv_projected:       company.vgv_projected != null ? String(company.vgv_projected) : '',
        monthly_media_spend: company.monthly_media_spend != null ? String(company.monthly_media_spend) : '',
        linkedin_url:        company.linkedin_url ?? '',
        instagram_url:       company.instagram_url ?? '',
        facebook_url:        company.facebook_url ?? '',
        employees_count:     company.employees_count != null ? String(company.employees_count) : '',
        founded_year:        company.founded_year != null ? String(company.founded_year) : '',
        owner_id:            company.owner_id,
      });
    } else {
      setForm({ ...EMPTY, owner_id: profile?.id ?? '' });
    }
  }, [company, profile?.id, open]);

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name:                form.name,
        cnpj:                form.cnpj || null,
        city:                form.city || null,
        state:               form.state || null,
        segment:             form.segment || null,
        website:             form.website || null,
        sales_model:         form.sales_model || null,
        has_active_launch:   form.has_active_launch,
        upcoming_launch:     form.upcoming_launch,
        vgv_projected:       toOptionalNumber(form.vgv_projected),
        monthly_media_spend: toOptionalNumber(form.monthly_media_spend),
        linkedin_url:        form.linkedin_url || null,
        instagram_url:       form.instagram_url || null,
        facebook_url:        form.facebook_url || null,
        employees_count:     toOptionalNumber(form.employees_count),
        founded_year:        toOptionalNumber(form.founded_year),
        owner_id:            form.owner_id || profile!.id,
      };
      return company
        ? updateCompany(company.id, payload)
        : createCompany({
          ...payload,
          status:              'new',
          score_tier:          'C',
          buying_signal:       'cold',
          icp_score:           0,
          launch_count_year:   0,
          cadence_status:      'not_started',
          cadence_day:         0,
          cadence_started_at:  null,
          last_interaction_at: null,
          connection_count:    0,
          domain:              null,
        });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      toast.success(company ? 'Empresa atualizada.' : 'Empresa criada.');
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Razão social é obrigatória.');
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{company ? 'Editar empresa' : 'Nova empresa'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Razão Social *</Label>
            <Input id="c-name" value={form.name} onChange={set('name')} required />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-cnpj">CNPJ</Label>
              <Input id="c-cnpj" value={form.cnpj} onChange={set('cnpj')} placeholder="00.000.000/0001-00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-city">Cidade</Label>
              <Input id="c-city" value={form.city} onChange={set('city')} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-state">Estado</Label>
              <Input id="c-state" value={form.state} onChange={set('state')} placeholder="Ex: Santa Catarina" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-founded-year">Ano de fundação</Label>
              <Input id="c-founded-year" type="number" min="1800" max="2099" value={form.founded_year} onChange={set('founded_year')} placeholder="Ex: 2010" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Segmento</Label>
              <Select
                value={form.segment || NO_SEGMENT}
                onValueChange={(v) => setForm((p) => ({ ...p, segment: v === NO_SEGMENT ? '' : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SEGMENT}>— Não informado —</SelectItem>
                  {COMPANY_SEGMENTS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-website">Website</Label>
              <Input id="c-website" value={form.website} onChange={set('website')} placeholder="https://" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Modelo de vendas</Label>
            <Select
              value={form.sales_model || NO_SALES_MODEL}
              onValueChange={(v) => setForm((p) => ({
                ...p,
                sales_model: v === NO_SALES_MODEL ? '' : v as SalesModel,
              }))}
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SALES_MODEL}>— Não informado —</SelectItem>
                {SALES_MODEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-md border p-3">
              <Label htmlFor="c-has-active-launch" className="cursor-pointer">
                Tem lançamento ativo?
              </Label>
              <Switch
                id="c-has-active-launch"
                checked={form.has_active_launch}
                onCheckedChange={(checked) => setForm((p) => ({ ...p, has_active_launch: checked }))}
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-md border p-3">
              <Label htmlFor="c-upcoming-launch" className="cursor-pointer">
                Tem lançamento previsto (próx. 6 meses)?
              </Label>
              <Switch
                id="c-upcoming-launch"
                checked={form.upcoming_launch}
                onCheckedChange={(checked) => setForm((p) => ({ ...p, upcoming_launch: checked }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-vgv-projected">VGV Projetado (R$)</Label>
              <Input
                id="c-vgv-projected"
                type="number"
                min="0"
                step="0.01"
                value={form.vgv_projected}
                onChange={set('vgv_projected')}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-monthly-media-spend">Investimento mensal em mídia (R$)</Label>
              <Input
                id="c-monthly-media-spend"
                type="number"
                min="0"
                step="0.01"
                value={form.monthly_media_spend}
                onChange={set('monthly_media_spend')}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-employees-count">Nº de funcionários</Label>
              <Input id="c-employees-count" type="number" min="0" value={form.employees_count} onChange={set('employees_count')} placeholder="Ex: 50" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-linkedin-url">LinkedIn da empresa</Label>
              <Input id="c-linkedin-url" value={form.linkedin_url} onChange={set('linkedin_url')} placeholder="https://" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-instagram-url">Instagram</Label>
              <Input id="c-instagram-url" value={form.instagram_url} onChange={set('instagram_url')} placeholder="https://" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-facebook-url">Facebook</Label>
              <Input id="c-facebook-url" value={form.facebook_url} onChange={set('facebook_url')} placeholder="https://" />
            </div>
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
