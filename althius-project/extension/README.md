# Pipa Driven CRM Sync

Extensão Chrome MV3 para espelhamento seletivo de mensagens do WhatsApp Web para um CRM externo.

> **Aviso:** a pasta `dist/` é um artefato legado de build antigo e **não é carregada** pelo `manifest.json`. Não empacote a `dist/` e não adicione referências a ela. Ela pode ser removida com segurança.

## Fluxo

1. O operador abre o popup e informa a URL base da API e o token.
2. A extensão salva a sessão em `chrome.storage.local`.
3. O `ui-injector.js` injeta uma top bar na lista de conversas e uma sidebar direita com Shadow DOM, sem contaminar o CSS do WhatsApp.
4. No WhatsApp Web, o `inject-wa.js` roda no contexto da página e lê dados estruturados via `window.WPP`/Store e via propriedades React (`__reactFiber$...` / `__reactProps$...`) anexadas aos nós renderizados.
5. Se a leitura estruturada não estiver disponível, o `content_script.js` usa um fallback de DOM baseado em atributos estáveis (`data-id`, `data-pre-plain-text`, `aria-label`, `title`) e hierarquia de tags.
6. A extensão identifica a conversa ativa e extrai o telefone.
7. O `background.js` consulta o CRM antes de qualquer captura:

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

Também são aceitos formatos equivalentes como `{ "contact": { ... } }` ou `{ "data": { ... } }`.

8. Apenas se `exists` e `relevant` forem verdadeiros a extensão envia novas mensagens. A deduplicação usa o ID único da mensagem do WhatsApp e um `Set` em memória chamado `processedMessages`.
9. O observer trata apenas novos nós adicionados ao chat; o histórico visível é marcado como já visto ao abrir a conversa para evitar reenvio causado por lazy loading/virtualização.
10. O `content_script.js` repassa mensagens aprovadas com `chrome.runtime.sendMessage({ type: "NEW_MESSAGE", ... })`; o `background.js` também mantém `CRM_SYNC_MESSAGE` como alias legado.
11. O envio de drafts pela sidebar usa `WPP.chat.sendTextMessage` via bridge de página; o caminho antigo por `contenteditable`/clique DOM não é usado.

```http
POST /whatsapp/messages
Authorization: Bearer <token>
Content-Type: application/json
```

Payload enviado:

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
    "raw_id": "whatsapp-message-id",
    "direction": "in",
    "author": "Nome do autor",
    "type": "text",
    "text": "Mensagem",
    "content_md": "Mensagem",
    "raw_timestamp": "10:32, 23/04/2026",
    "timestamp": "2026-04-23T13:32:00.000Z",
    "timestamp_wa": "2026-04-23T13:32:00.000Z"
  },
  "captured_at": "2026-04-23T13:32:01.000Z",
  "extension": {
    "runtime_id": "chrome-extension-id",
    "version": "1.1.0"
  }
}
```

`GET /auth/me` é opcional. Se existir, a extensão usa para validar o token no login. Se retornar `404`, o token é salvo mesmo assim; se retornar `401` ou `403`, o login é recusado. Outras falhas de rede ou servidor bloqueiam o login para evitar uma sessão falsa positiva.

Para reduzir preflight desnecessário, a extensão não envia header customizado (`X-Pipa-Extension`) e não envia `Content-Type` em chamadas sem body.

## Instalar em modo dev

1. Abra `chrome://extensions/`.
2. Ative o modo de desenvolvedor.
3. Clique em "Carregar sem compactação".
4. Selecione a pasta `seamless-crm-suite/extension`.
5. Abra `https://web.whatsapp.com/`, faça login no popup da extensão e abra uma conversa.

## Arquivos principais

- `manifest.json` - Manifest V3, permissões e content script.
- `popup.html`, `popup.css`, `popup.js` - login e status.
- `background.js` - sessão, cache de contatos e chamadas ao CRM.
- `ui-injector.js` - top bar, sidebar CRM e ações visuais isoladas por Shadow DOM.
- `content_script.js` - mensageria MV3, deduplicação, validação do chat ativo e roteamento para o background.
- `lib/wa-bridge.js`, `inject-wa.js`, `vendor/wppconnect-wa.js` - ponte para ler dados estruturados no contexto da página, incluindo React Fiber/props, fallback DOM centralizado e envio via WPP.
