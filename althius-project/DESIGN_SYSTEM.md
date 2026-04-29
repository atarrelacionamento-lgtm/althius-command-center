# Pipa Driven — Design System

> Referência de design para toda a extensão Chrome e o CRM web.
> Inspirado no Claude.ai + Linear.app. Dark mode nativo. Sem excessos.

---

## Princípios

1. **Escuro por padrão** — fundo quase preto, sem branco puro em nenhum lugar
2. **Laranja como sinal** — usado só para ação primária e status ativo, nunca decorativo
3. **Tipografia limpa** — Inter ou system-ui, sem serifa, hierarquia via peso e opacidade
4. **Sem sombras pesadas** — bordas sutis fazem o trabalho de separação
5. **Densidade inteligente** — informação densa mas respira (não minimalismo vazio)

---

## Paleta de Cores

### Brand
| Token | Hex | Uso |
|---|---|---|
| `--pipa-orange` | `#F97316` | CTA principal, ícone de marca, status ativo |
| `--pipa-amber` | `#F59E0B` | Alertas, pendente, destaques secundários |
| `--pipa-orange-muted` | `#F9731620` | Background de badge laranja |

### Backgrounds
| Token | Hex | Uso |
|---|---|---|
| `--bg-base` | `#0A0A0A` | Fundo da página / extensão |
| `--bg-card` | `#141414` | Cards, painéis, popups |
| `--bg-card-hover` | `#1C1C1C` | Hover em cards interativos |
| `--bg-elevated` | `#202020` | Dropdowns, tooltips, modais |
| `--bg-input` | `#181818` | Inputs, textareas |

### Bordas
| Token | Hex | Uso |
|---|---|---|
| `--border-subtle` | `#242424` | Separadores, bordas de card |
| `--border-default` | `#2E2E2E` | Bordas de input, divisores |
| `--border-strong` | `#404040` | Bordas em foco, hover |

### Texto
| Token | Hex | Uso |
|---|---|---|
| `--text-primary` | `#EBEBEB` | Títulos, labels principais |
| `--text-secondary` | `#A0A0A0` | Descrições, metadados |
| `--text-muted` | `#606060` | Placeholders, dicas, disabled |
| `--text-inverse` | `#0A0A0A` | Texto sobre fundo laranja |

### Status
| Token | Hex | Uso |
|---|---|---|
| `--status-success` | `#22C55E` | Conectado, salvo, ok |
| `--status-success-bg` | `#22C55E18` | Background do badge verde |
| `--status-warning` | `#F59E0B` | Pendente, processando |
| `--status-warning-bg` | `#F59E0B18` | Background do badge amarelo |
| `--status-error` | `#EF4444` | Erro, falha, desconectado |
| `--status-error-bg` | `#EF444418` | Background do badge vermelho |
| `--status-neutral` | `#525252` | Inativo, sem dados |

### WhatsApp (bolhas de chat)
| Token | Hex | Uso |
|---|---|---|
| `--bubble-out` | `#1A3329` | Mensagem enviada (outbound) |
| `--bubble-out-border` | `#2D4A3E` | Borda da bolha outbound |
| `--bubble-in` | `#141428` | Mensagem recebida (inbound) |
| `--bubble-in-border` | `#1E1E3A` | Borda da bolha inbound |

---

## Tipografia

### Família
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Escala
| Classe | Size | Weight | Line-height | Uso |
|---|---|---|---|---|
| `.text-display` | 20px | 600 | 1.3 | Títulos de página |
| `.text-title` | 15px | 600 | 1.4 | Títulos de card/seção |
| `.text-body` | 13px | 400 | 1.5 | Corpo de texto padrão |
| `.text-label` | 11px | 500 | 1.4 | Labels, badges, tabs |
| `.text-caption` | 10px | 400 | 1.4 | Timestamps, metadados |
| `.text-micro` | 9px | 500 | 1.3 | Contadores, super-labels |

### Hierarquia na prática
```
SEÇÃO (text-micro, muted, uppercase, letter-spacing: 0.08em)
  Título (text-title, primary)
  Descrição (text-body, secondary)
    Detalhe (text-caption, muted)
```

---

## Espaçamento

Sistema baseado em múltiplos de 4px:

| Token | Valor | Uso típico |
|---|---|---|
| `--space-1` | 4px | Gap entre ícone e texto |
| `--space-2` | 8px | Padding interno de badge |
| `--space-3` | 12px | Padding de item de lista |
| `--space-4` | 16px | Padding de card |
| `--space-5` | 20px | Gap entre cards |
| `--space-6` | 24px | Padding de seção |
| `--space-8` | 32px | Espaço entre seções |

---

## Componentes

### Badge / Status Pill

```html
<!-- Verde: ativo/ok -->
<span class="badge badge-success">Ativo</span>

<!-- Amarelo: pendente -->
<span class="badge badge-warning">Pendente</span>

<!-- Vermelho: erro -->
<span class="badge badge-error">Erro</span>

<!-- Laranja: brand -->
<span class="badge badge-brand">Salva</span>
```

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 100px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.badge-success { background: #22C55E18; color: #22C55E; }
.badge-warning  { background: #F59E0B18; color: #F59E0B; }
.badge-error    { background: #EF444418; color: #EF4444; }
.badge-brand    { background: #F9731620; color: #F97316; }
.badge-neutral  { background: #52525218; color: #A0A0A0; }
```

---

### Card

```css
.card {
  background: #141414;
  border: 1px solid #242424;
  border-radius: 10px;
  padding: 16px;
  transition: border-color 150ms ease;
}
.card:hover {
  border-color: #2E2E2E;
}
.card-interactive:hover {
  background: #1C1C1C;
  cursor: pointer;
}
```

---

### Botão Primário

```css
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #F97316;
  color: #0A0A0A;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: background 150ms ease, transform 100ms ease;
}
.btn-primary:hover  { background: #EA6C0A; }
.btn-primary:active { transform: scale(0.98); }
```

### Botão Secundário

```css
.btn-secondary {
  background: transparent;
  color: #A0A0A0;
  border: 1px solid #2E2E2E;
  font-size: 13px;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 150ms, color 150ms;
}
.btn-secondary:hover {
  border-color: #404040;
  color: #EBEBEB;
}
```

### Botão Ghost (ícone)

```css
.btn-ghost {
  background: transparent;
  border: none;
  color: #606060;
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 120ms, color 120ms;
}
.btn-ghost:hover {
  background: #1C1C1C;
  color: #A0A0A0;
}
```

---

### Input

```css
.input {
  width: 100%;
  background: #181818;
  border: 1px solid #2E2E2E;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: #EBEBEB;
  outline: none;
  transition: border-color 150ms;
}
.input::placeholder { color: #606060; }
.input:focus {
  border-color: #F97316;
  box-shadow: 0 0 0 3px #F9731615;
}
```

---

### Indicador de Status (dot animado)

```css
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-dot.active {
  background: #22C55E;
  box-shadow: 0 0 0 0 #22C55E40;
  animation: pulse-green 2s infinite;
}
.status-dot.error   { background: #EF4444; }
.status-dot.warning { background: #F59E0B; }
.status-dot.neutral { background: #525252; }

@keyframes pulse-green {
  0%   { box-shadow: 0 0 0 0 #22C55E40; }
  70%  { box-shadow: 0 0 0 6px #22C55E00; }
  100% { box-shadow: 0 0 0 0 #22C55E00; }
}
```

---

### Divisor de Seção

```css
.section-label {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #606060;
  padding: 12px 16px 6px;
}
```

---

### Bolha de Mensagem WhatsApp

```css
.bubble {
  max-width: 75%;
  border-radius: 14px;
  padding: 8px 12px;
  position: relative;
}
.bubble-out {
  background: #1A3329;
  border: 1px solid #2D4A3E;
  border-bottom-right-radius: 4px;
  margin-left: auto;
}
.bubble-in {
  background: #141428;
  border: 1px solid #1E1E3A;
  border-bottom-left-radius: 4px;
  margin-right: auto;
}
.bubble .sender {
  font-size: 11px;
  font-weight: 600;
  color: #F97316;
  margin-bottom: 3px;
}
.bubble .content {
  font-size: 13px;
  color: #EBEBEB;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.bubble .meta {
  display: flex;
  align-items: center;
  gap: 3px;
  justify-content: flex-end;
  margin-top: 4px;
  opacity: 0.5;
  font-size: 10px;
}
```

---

### Separador de Data (chat)

```css
.date-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 12px 0;
}
.date-divider span {
  font-size: 11px;
  color: #606060;
  background: #141414;
  padding: 3px 12px;
  border-radius: 100px;
  border: 1px solid #242424;
}
```

---

## Ícones

Usar **Lucide** (já incluso no projeto via shadcn). Tamanhos padrão:

| Contexto | Size | Stroke |
|---|---|---|
| Inline com texto | 12px | 2 |
| Item de lista | 14px | 2 |
| Ação de card | 16px | 1.75 |
| Hero / destaque | 20px | 1.5 |

```tsx
// Correto
<MessageCircle className="w-4 h-4 text-muted-foreground" />

// Nunca usar tamanhos hardcoded com style={{}}
```

---

## Layout da Extensão (popup 380px)

```
┌─────────────────────────────────────┐  ← bg-base
│                                     │
│  Header (56px)                      │  ← border-b border-subtle
│  [Logo P] Pipa Driven  [dot] [⚙]   │
│                                     │
│  Status Banner (40px, condicional)  │  ← badge verde/vermelho
│                                     │
│  Seção: PROCESSAMENTOS              │  ← section-label
│  Toggles IA + Transcrição           │  ← card
│                                     │
│  Grid 2x2: Stats                    │  ← 4 cards numéricos
│  [Monit.][Chats][Saves][Pendentes]  │
│                                     │
│  Seção: STATUS DA BRIDGE            │  ← section-label
│  3 linhas de status                 │  ← lista com dots
│                                     │
│  Seção: CHATS MONITORADOS (N)       │  ← section-label
│  Lista de chats                     │  ← cards interativos
│                                     │
│  CTA: Abrir um chat                 │  ← btn-primary full-width
│                                     │
└─────────────────────────────────────┘
```

---

## Regras de Uso — O que NÃO fazer

| Proibido | Alternativa |
|---|---|
| Fundo branco (`#FFFFFF`) | `--bg-card` ou `--bg-elevated` |
| Gradientes decorativos | Bordas com `--border-subtle` |
| Sombras `box-shadow` grandes | Bordas `1px solid --border-default` |
| Mais de 2 cores de brand na tela | Só laranja para CTA, amber para alerta |
| Texto pequeno demais (< 9px) | Mínimo 9px, prefira 11px+ |
| Ícones sem `aria-label` | Sempre `aria-label` ou `title` em ícones standalone |
| Animações > 300ms | `transition: 150ms ease` para micro-interações |
| `!important` em CSS | Aumentar especificidade do seletor |

---

## Referências Visuais

- **Claude.ai** — hierarquia tipográfica, dark mode, sidebar
- **Linear.app** — densidade de informação, cards, badges
- **WhatsApp Web** — bolhas de mensagem (adaptadas para dark)
- **Raycast** — micro-interações, ícones com opacidade

---

## Tailwind Config (CRM)

Adicionar ao `tailwind.config.ts`:

```ts
extend: {
  colors: {
    pipa: {
      orange: '#F97316',
      amber:  '#F59E0B',
    },
    surface: {
      base:     '#0A0A0A',
      card:     '#141414',
      elevated: '#202020',
      input:    '#181818',
    },
    border: {
      subtle:  '#242424',
      default: '#2E2E2E',
      strong:  '#404040',
    },
    bubble: {
      out:    '#1A3329',
      'out-border': '#2D4A3E',
      in:     '#141428',
      'in-border':  '#1E1E3A',
    }
  }
}
```
