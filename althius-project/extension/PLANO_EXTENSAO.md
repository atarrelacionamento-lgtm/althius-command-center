# Pipa Driven - Plano da Extensao

> **Doc canonico.** Esta pasta agora representa uma extensao Chrome Manifest V3 enxuta, sem build Vite, sem bundle `dist/` e sem cliente Supabase no navegador. A extensao sincroniza WhatsApp Web com uma API de CRM externa, capturando apenas conversas aprovadas pelo CRM.

---

## 1. Objetivo atual

A extensao deve espelhar mensagens novas do WhatsApp Web para o CRM Pipa Driven com seguranca operacional:

- So funciona depois do login no popup.
- So captura a conversa se o CRM confirmar que o contato existe e e relevante.
- Nunca envia mensagem para API externa a partir do content script.
- Deduplica por ID real da mensagem do WhatsApp.
- Usa leitura estruturada no contexto da pagina sempre que possivel.
- Usa fallback DOM apenas por atributos estaveis, nunca por classe CSS ofuscada.

---

## 2. Arquitetura ativa

```text
WhatsApp Web
  |
  | inject-wa.js (page context)
  | - WPP/Store quando disponivel
  | - React Fiber / React props nos nos renderizados
  | - MutationObserver de novos baloes
  v
lib/wa-bridge.js + content_script.js (isolated world)
  | - recebe eventos estruturados da pagina
  | - fallback DOM por data-id/data-pre-plain-text
  | - dedupe em memoria
  | - sanitizacao de telefone
  | - chrome.runtime.sendMessage
  v
background.js (MV3 service worker)
  | - sessao em chrome.storage.local
  | - cache de contatos aprovados
  | - fetch para CRM
  v
CRM API externa
```

### Arquivos carregados pelo Manifest

- `manifest.json`: Manifest V3, permissoes, content scripts e recursos acessiveis.
- `popup.html`, `popup.css`, `popup.js`: login, logout, status e contadores.
- `background.js`: unico lugar com `fetch()` externo.
- `lib/wa-bridge.js`: injeta o script de pagina e repassa comandos/eventos.
- `inject-wa.js`: roda no contexto real do WhatsApp Web e acessa WPP/Store/React.
- `ui-injector.js`: injeta top bar e sidebar CRM com Shadow DOM.
- `content_script.js`: orquestra chat ativo, dedupe, fallback DOM e mensageria MV3.
- `vendor/wppconnect-wa.js`: biblioteca local para ponte WPP.
- `icons/*`: icones do Chrome.

---

## 3. Decisoes tecnicas

### 3.1 Sem scraping visual por classe

Classes como `.x1xyz` ou similares nao sao contrato do WhatsApp. O codigo atual nao depende delas para identificar mensagens. O fallback DOM usa:

- `data-id`
- `data-pre-plain-text`
- `aria-label`
- `title`
- hierarquia e atributos semanticos

### 3.2 React Fiber fica no `inject-wa.js`

O acesso a `__reactFiber$...` e `__reactProps$...` precisa rodar no contexto da pagina, nao no mundo isolado do content script. Por isso a engenharia de React fica centralizada no `inject-wa.js`.

### 3.3 Content script sem rede externa

O `content_script.js` nao usa `fetch`, `XMLHttpRequest` nem `sendBeacon`. Ele envia dados para o background com `chrome.runtime.sendMessage`. Isso evita CORS e mantem separacao de responsabilidades.

### 3.4 Background como camada de API

O `background.js` e o unico componente que fala com o CRM:

- valida login com `GET /auth/me` quando existir;
- consulta contato com `GET /contacts/lookup`;
- sincroniza mensagem com `POST /whatsapp/messages`;
- mantem cache curto de contatos aprovados para reduzir chamadas repetidas.

### 3.5 Lazy loading e virtualizacao

O WhatsApp Web remove mensagens antigas do DOM. A extensao nao tenta capturar historico longo via tela. Ao abrir uma conversa, mensagens visiveis sao marcadas como vistas; depois disso, o observer se preocupa com novos baloes renderizados.

Existem dois observers:

- `inject-wa.js`: observer focado no container ativo de mensagens para pegar `addedNodes` e extrair o JSON via React Fiber.
- `content_script.js`: nao observa baloes; fica apenas com observer leve de layout para detectar troca de chat.

O fallback DOM de novas mensagens tambem vive em `inject-wa.js`, para evitar dois observers competindo pelo mesmo container.

### 3.6 Deduplicacao

Cada mensagem precisa ter um ID estavel:

1. ID estruturado vindo de WPP/Store/React.
2. `data-id` do balao, se o estruturado nao vier.
3. Hash de emergencia baseado em chat, timestamp, autor e texto.

O content script mantem `processedMessages: Set<string>` em memoria por sessao. O backend tambem deve tratar o ID como idempotente.

Tipos ignorados antes do sync:

- `vcard`
- `multi_vcard`
- `call_log`
- `e2e_notification`
- `notification`
- `protocol`
- `revoked`
- `ciphertext`

### 3.7 Sanitizacao de telefone

Telefones sao normalizados para digitos:

- remove `@c.us`, `@s.whatsapp.net`, `@g.us`;
- remove `+`, espacos, parenteses e tracos;
- gera variantes brasileiras com e sem nono digito;
- so gera variantes brasileiras quando o DDD existe na lista valida do Brasil;
- envia `phone` e `phone_variants` para o CRM.

### 3.8 UI injetada com Shadow DOM

A camada visual fica em `ui-injector.js` e nao participa da captura. Ela injeta:

- top bar acima de `#pane-side`, com abas operacionais;
- sidebar direita como irma de `#main`, usando largura fixa de 340px para empurrar o chat nativo;
- abas internas `Perfil`, `IA` e `Notas`;
- armazenamento local temporario para perfil, draft, notas e follow-up enquanto os endpoints finais do CRM nao existem.

O `content_script.js` publica estado para a UI via evento `pipa:crm-state`. A UI nao faz chamadas externas.

### 3.9 Roteamento CORS

O content script nunca faz chamada externa. O fluxo de mensagem nova e:

```text
inject-wa.js -> window.postMessage(WA_MESSAGE)
content_script.js -> chrome.runtime.sendMessage({ type: "NEW_MESSAGE" })
background.js -> fetch(POST /whatsapp/messages)
```

`background.js` aceita payload plano (`raw_id`, `content_md`, `timestamp_wa`) e o formato legado com `message`. O tipo `CRM_SYNC_MESSAGE` continua como alias para compatibilidade interna.

Para reduzir preflight desnecessario, o background nao envia header customizado (`X-Pipa-Extension`) e nao envia `Content-Type` em requests sem body.

### 3.10 Envio via WPP

O botao da aba IA envia texto por `window.WPP.chat.sendTextMessage` atraves da bridge `SEND_TEXT_MESSAGE`. O caminho antigo por `contenteditable`, `document.execCommand` e clique no botao nativo foi removido para reduzir fragilidade de DOM.

---

## 4. Contrato minimo da API CRM

### Login

`GET /auth/me` e opcional.

- `200`: token valido.
- `404`: endpoint inexistente, token e salvo mesmo assim.
- `401` ou `403`: login recusado.

### Verificacao de contato

```http
GET /contacts/lookup?phone=5511999999999&phone_variants=5511999999999,551199999999&chat_title=Nome
Authorization: Bearer <token>
```

Resposta esperada:

```json
{
  "exists": true,
  "relevant": true,
  "contact_id": "crm-contact-id",
  "opportunity_id": "crm-opportunity-id",
  "name": "Nome do contato"
}
```

Tambem sao aceitos envelopes como `{ "data": { ... } }` ou `{ "contact": { ... } }`.

### Sincronizacao de mensagem

```http
POST /whatsapp/messages
Authorization: Bearer <token>
Content-Type: application/json
```

Payload principal:

```json
{
  "source": "whatsapp_web",
  "phone": "5511999999999",
  "phone_variants": ["5511999999999", "551199999999"],
  "contact_id": "crm-contact-id",
  "opportunity_id": "crm-opportunity-id",
  "chat": {
    "id": "phone:5511999999999",
    "title": "Nome do contato",
    "url": "https://web.whatsapp.com/"
  },
  "message": {
    "id": "whatsapp-message-id",
    "direction": "in",
    "author": "5511999999999@c.us",
    "type": "text",
    "text": "Mensagem",
    "raw_timestamp": null,
    "timestamp": "2026-04-23T13:32:00.000Z"
  },
  "captured_at": "2026-04-23T13:32:01.000Z",
  "extension": {
    "runtime_id": "chrome-extension-id",
    "version": "1.1.0"
  }
}
```

---

## 5. Tabela anti-bugs

| Bug | Risco | Mitigacao atual |
|---|---|---|
| CSS do WhatsApp muda | Captura quebra | Nao usar classes; usar WPP/React/atributos estaveis |
| Content script nao enxerga React expandos | Leitura estruturada falha | React Fiber roda em `inject-wa.js`, no contexto da pagina |
| Mensagem duplicada | CRM recebe repetido | `Set` em memoria + ID unico + backend idempotente |
| DOM virtualizado | Historico fica incompleto | Nao prometer historico por DOM; observar novos nos |
| Evento de digitacao vira mensagem | Lixo no CRM | Capturar apenas nos com assinatura de mensagem |
| vCard/chamada/notificacao entra no CRM | Historico poluido | Filtro por `type` antes do `NEW_MESSAGE` |
| CORS | POST falha no content script | So `background.js` chama API externa |
| Contato pessoal capturado | Vazamento operacional | `contacts/lookup` obrigatorio antes do sync |
| Numero em formato inconsistente | CRM nao encontra contato | `normalizePhone` + `phone_variants` |
| Store/WPP demora a carregar | Captura estruturada nao sobe | Observer React inicia antes; WPP continua tentando carregar |
| Mensagem sem texto, midia ou sistema | Dados ruins | Tipagem `text/audio/media/system` e filtro de texto vazio |
| CSS da extensao quebra WhatsApp | Layout instavel | UI em Shadow DOM; so host recebe estilos inline minimos |
| Sidebar cobre o chat | Vendedor perde area util | Host entra como irmao de `#main` e usa flex fixo de 340px |
| WPP demora a iniciar | Chat ativo demora ou fallback fica bloqueado | Bridge sobe em background; DOM fallback nao espera WPP |
| Mensagem chega durante lookup do CRM | Mensagem perdida ou vazada | Fila curta durante `lookupInProgress`; limpa se contato for ignorado |
| Cache cresce sem limite | `chrome.storage.local` fica pesado | Limite em cache de contatos, estados locais e mensagens processadas |
| Render da sidebar rouba foco | Vendedor perde texto digitado | Nao re-renderizar sidebar enquanto input/textarea/select esta ativo |
| IA envia em contato nao aprovado | Vazamento para conversa pessoal | Acoes de IA/envio ficam desabilitadas sem `monitoring=true` |
| API do CRM pendura | Service worker fica esperando indefinidamente | `AbortController` com timeout de 15s |
| DDD invalido gera telefone alternativo | CRM acha contato errado | Variantes BR so para DDD valido |
| Envio DOM quebra por mudanca visual | Draft nao sai | Envio primario via WPP bridge |

---

## 6. Checklist de pronto

- `npm run check` passa.
- `manifest.json` e JSON valido.
- `content_script.js` e `inject-wa.js` nao contem chamadas externas.
- `ui-injector.js` nao contem chamadas externas.
- `background.js` e o unico arquivo com `fetch()`.
- `chrome://extensions/` carrega a pasta `extension/` sem erro.
- Login salva sessao em `chrome.storage.local`.
- Ao abrir conversa relevante, o CRM recebe novas mensagens uma unica vez.
- Ao abrir conversa nao relevante, nenhuma mensagem e enviada.
- Sidebar direita aparece sem sobrepor o chat.
- Top bar aparece acima da lista de conversas.

---

## 7. Proximas fases

1. Validar captura em chat real com texto, audio, imagem, citacao e mensagem enviada pelo vendedor.
2. Adicionar log de diagnostico no popup para mostrar ultima conversa monitorada e ultimo erro.
3. Implementar envio CRM -> WhatsApp com fila, delays humanos e confirmacao de chat ativo.
4. Depois do inbound/outbound estar estavel, reabrir o escopo de IA, RAG e regras de follow-up no backend.
