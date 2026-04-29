import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { importContacts } from '@/services/crmService';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'upload' | 'map' | 'preview' | 'done';

const CONTACT_FIELDS: { value: string; label: string }[] = [
  { value: '_ignore', label: '— Ignorar —' },
  { value: 'name',      label: 'Nome *' },
  { value: 'role',      label: 'Cargo' },
  { value: 'email',     label: 'E-mail' },
  { value: 'whatsapp',  label: 'WhatsApp' },
  { value: 'source',    label: 'Fonte' },
];

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };

  const splitLine = (line: string) => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    result.push(current.trim());
    return result;
  };

  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map(splitLine);
  return { headers, rows };
}

export function ImportCSV({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ inserted: number; skipped: number; errors: string[] } | null>(null);

  function reset() {
    setStep('upload');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.headers.length === 0) return toast.error('CSV vazio ou inválido.');
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      // Auto-map: tenta casar nomes de coluna
      const autoMap: Record<string, string> = {};
      parsed.headers.forEach((h) => {
        const lower = h.toLowerCase();
        if (lower.includes('nome') || lower === 'name')         autoMap[h] = 'name';
        else if (lower.includes('cargo') || lower === 'role')   autoMap[h] = 'role';
        else if (lower.includes('email'))                        autoMap[h] = 'email';
        else if (lower.includes('whats') || lower.includes('telefone')) autoMap[h] = 'whatsapp';
        else if (lower.includes('fonte') || lower === 'source') autoMap[h] = 'source';
        else                                                     autoMap[h] = '_ignore';
      });
      setMapping(autoMap);
      setStep('map');
    };
    reader.readAsText(file, 'UTF-8');
  }

  function buildPreviewRows() {
    return rows.slice(0, 5).map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (mapping[h] && mapping[h] !== '_ignore') obj[mapping[h]] = row[i] ?? '';
      });
      return obj;
    });
  }

  const mutation = useMutation({
    mutationFn: () => {
      const mapped = rows.map((row) => {
        const obj: Record<string, string | null> = {};
        headers.forEach((h, i) => {
          const field = mapping[h];
          if (field && field !== '_ignore') obj[field] = row[i]?.trim() || null;
        });
        return {
          name:       obj['name'] ?? '',
          role:       obj['role'] ?? null,
          email:      obj['email'] ?? null,
          whatsapp:   obj['whatsapp'] ?? null,
          source:     obj['source'] ?? null,
          company_id: null,
          owner_id:   profile!.id,
        };
      }).filter((r) => r.name.trim() !== '');

      return importContacts(mapped);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      setResult(res);
      setStep('done');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const previewRows = step === 'preview' ? buildPreviewRows() : [];
  const mappedFields = CONTACT_FIELDS.filter((f) => f.value !== '_ignore').map((f) => f.value);

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Importar contatos via CSV</SheetTitle>
        </SheetHeader>

        <div className="py-6 space-y-6">

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Selecione um arquivo <code>.csv</code> com cabeçalho na primeira linha.
                A primeira coluna mapeada como <strong>Nome</strong> é obrigatória.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="csv-file">Arquivo CSV</Label>
                <input
                  id="csv-file"
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFile}
                  className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-border file:bg-muted file:text-sm file:font-medium file:cursor-pointer hover:file:bg-secondary transition-colors"
                />
              </div>
            </div>
          )}

          {/* Step 2: Map columns */}
          {step === 'map' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Mapeie as colunas do seu CSV para os campos do Sistemas.
              </p>
              <div className="space-y-3">
                {headers.map((h) => (
                  <div key={h} className="grid grid-cols-2 items-center gap-3">
                    <span className="text-sm font-medium truncate">{h}</span>
                    <Select
                      value={mapping[h] ?? '_ignore'}
                      onValueChange={(v) => setMapping((m) => ({ ...m, [h]: v }))}
                    >
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONTACT_FIELDS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Primeiras 5 linhas do arquivo com o mapeamento aplicado. Total: <strong>{rows.length}</strong> contatos.
              </p>
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {mappedFields.filter((f) => Object.values(mapping).includes(f)).map((f) => (
                        <TableHead key={f} className="text-xs">{f}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, i) => (
                      <TableRow key={i}>
                        {mappedFields.filter((f) => Object.values(mapping).includes(f)).map((f) => (
                          <TableCell key={f} className="text-xs">{row[f] ?? '—'}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && result && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted p-4 space-y-1 text-sm">
                <p><span className="font-medium text-green-600">✓ Inseridos:</span> {result.inserted}</p>
                <p><span className="font-medium text-yellow-600">⊘ Ignorados (duplicados):</span> {result.skipped}</p>
                {result.errors.length > 0 && (
                  <div>
                    <p className="font-medium text-destructive">Erros:</p>
                    <ul className="ml-4 list-disc text-xs text-muted-foreground">
                      {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="gap-2">
          {step === 'upload' && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          )}
          {step === 'map' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>Voltar</Button>
              <Button onClick={() => setStep('preview')}>Pré-visualizar</Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('map')}>Voltar</Button>
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                {mutation.isPending ? 'Importando…' : `Importar ${rows.length} contatos`}
              </Button>
            </>
          )}
          {step === 'done' && (
            <>
              <Button variant="outline" onClick={reset}>Nova importação</Button>
              <Button onClick={() => { reset(); onOpenChange(false); }}>Fechar</Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
