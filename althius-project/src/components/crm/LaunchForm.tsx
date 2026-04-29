import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import type { CompanyLaunch } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  launch?: CompanyLaunch | null;
}

type LaunchStatus = CompanyLaunch['status'];

interface FormState {
  name: string;
  status: LaunchStatus;
  launch_date: string;
  delivery_date: string;
  units_total: string;
  units_sold: string;
  vgv: string;
  price_per_sqm: string;
  neighborhood: string;
  city: string;
  website_url: string;
  landing_page_url: string;
  instagram_url: string;
  notes: string;
}

const STATUS_OPTIONS: { value: LaunchStatus; label: string }[] = [
  { value: 'active', label: 'Ativo' },
  { value: 'upcoming', label: 'Previsto' },
  { value: 'sold_out', label: 'Esgotado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const EMPTY: FormState = {
  name: '',
  status: 'active',
  launch_date: '',
  delivery_date: '',
  units_total: '',
  units_sold: '',
  vgv: '',
  price_per_sqm: '',
  neighborhood: '',
  city: '',
  website_url: '',
  landing_page_url: '',
  instagram_url: '',
  notes: '',
};

function toOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toOptionalText(value: string) {
  return value.trim() || null;
}

function toDateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : '';
}

export function LaunchForm({ open, onOpenChange, companyId, launch }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);

  useEffect(() => {
    if (!open) return;

    if (launch) {
      setForm({
        name:             launch.name,
        status:           launch.status,
        launch_date:      toDateInputValue(launch.launch_date),
        delivery_date:    toDateInputValue(launch.delivery_date),
        units_total:      launch.units_total != null ? String(launch.units_total) : '',
        units_sold:       launch.units_sold != null ? String(launch.units_sold) : '',
        vgv:              launch.vgv != null ? String(launch.vgv) : '',
        price_per_sqm:    launch.price_per_sqm != null ? String(launch.price_per_sqm) : '',
        neighborhood:     launch.neighborhood ?? '',
        city:             launch.city ?? '',
        website_url:      launch.website_url ?? '',
        landing_page_url: launch.landing_page_url ?? '',
        instagram_url:    launch.instagram_url ?? '',
        notes:            launch.notes ?? '',
      });
    } else {
      setForm(EMPTY);
    }
  }, [launch, open]);

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        company_id:        companyId,
        name:              form.name.trim(),
        status:            form.status,
        launch_date:       form.launch_date || null,
        delivery_date:     form.delivery_date || null,
        units_total:       toOptionalNumber(form.units_total),
        units_sold:        toOptionalNumber(form.units_sold),
        vgv:               toOptionalNumber(form.vgv),
        price_per_sqm:     toOptionalNumber(form.price_per_sqm),
        neighborhood:      toOptionalText(form.neighborhood),
        city:              toOptionalText(form.city),
        website_url:       toOptionalText(form.website_url),
        landing_page_url:  toOptionalText(form.landing_page_url),
        instagram_url:     toOptionalText(form.instagram_url),
        notes:             toOptionalText(form.notes),
      };

      const result = launch
        ? await supabase
          .from('company_launches')
          .update(payload)
          .eq('id', launch.id)
          .select('*')
          .single()
        : await supabase
          .from('company_launches')
          .insert(payload)
          .select('*')
          .single();

      if (result.error) throw result.error;
      return result.data as CompanyLaunch;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['launches', companyId] });
      qc.invalidateQueries({ queryKey: ['company', companyId] });
      toast.success(launch ? 'Lançamento atualizado.' : 'Lançamento criado.');
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Nome do empreendimento é obrigatório.');
    mutation.mutate();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{launch ? 'Editar lançamento' : 'Novo lançamento'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-6">
          <div className="space-y-1.5">
            <Label htmlFor="launch-name">Nome do empreendimento *</Label>
            <Input id="launch-name" value={form.name} onChange={set('name')} required />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((p) => ({ ...p, status: v as LaunchStatus }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="launch-date">Data de lançamento</Label>
              <Input id="launch-date" type="date" value={form.launch_date} onChange={set('launch_date')} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="launch-delivery-date">Previsão de entrega</Label>
              <Input id="launch-delivery-date" type="date" value={form.delivery_date} onChange={set('delivery_date')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="launch-units-total">Total de unidades</Label>
              <Input id="launch-units-total" type="number" min="0" step="1" value={form.units_total} onChange={set('units_total')} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="launch-units-sold">Unidades vendidas</Label>
              <Input id="launch-units-sold" type="number" min="0" step="1" value={form.units_sold} onChange={set('units_sold')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="launch-vgv">VGV total (R$)</Label>
              <Input id="launch-vgv" type="number" min="0" step="0.01" value={form.vgv} onChange={set('vgv')} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="launch-price-per-sqm">Preço por m² (R$)</Label>
              <Input id="launch-price-per-sqm" type="number" min="0" step="0.01" value={form.price_per_sqm} onChange={set('price_per_sqm')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="launch-neighborhood">Bairro</Label>
              <Input id="launch-neighborhood" value={form.neighborhood} onChange={set('neighborhood')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="launch-city">Cidade</Label>
            <Input id="launch-city" value={form.city} onChange={set('city')} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="launch-website-url">Site do empreendimento</Label>
              <Input id="launch-website-url" value={form.website_url} onChange={set('website_url')} placeholder="https://" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="launch-landing-page-url">Landing page</Label>
              <Input id="launch-landing-page-url" value={form.landing_page_url} onChange={set('landing_page_url')} placeholder="https://" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="launch-instagram-url">Instagram do empreendimento</Label>
            <Input id="launch-instagram-url" value={form.instagram_url} onChange={set('instagram_url')} placeholder="https://" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="launch-notes">Observações</Label>
            <Textarea id="launch-notes" value={form.notes} onChange={set('notes')} rows={4} />
          </div>

          <SheetFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
