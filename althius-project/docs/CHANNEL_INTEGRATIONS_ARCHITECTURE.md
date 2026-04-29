# Channel Integrations Architecture

Objetivo: preparar a base para integrar e operar canais dentro do CRM sem acoplar a aplicacao a um unico provedor.

## Canais previstos

- E-mail
- LinkedIn
- WhatsApp
- Espelhamento de WhatsApp Web

## Principios

1. A camada de negocio nao deve conhecer o provedor final.
2. Cada canal precisa expor o mesmo conjunto minimo de capacidades:
   - conectar sessao;
   - sincronizar conversas;
   - enviar mensagem;
   - marcar status de entrega;
   - receber inbound;
   - gerar log em `interactions`.
3. A execucao de tarefas da cadencia deve chamar um `channel hub`, nao APIs soltas.
4. Toda mensagem enviada ou recebida deve virar dado estruturado no CRM.

## Modelo sugerido

- `channel_connections`
  - empresa / workspace
  - channel_type
  - provider
  - status
  - metadata

- `channel_threads`
  - company_id
  - contact_id
  - channel_type
  - external_thread_id
  - last_message_at

- `channel_messages`
  - thread_id
  - direction
  - content
  - external_message_id
  - delivery_status
  - sent_at

## Fluxo

1. Cadencia gera uma tarefa.
2. Operador ou automacao chama `channelHub.sendMessage(...)`.
3. O provider envia no canal real.
4. O retorno grava `channel_messages`.
5. Um log resumido entra em `interactions`.
6. O copiloto le o historico consolidado por conta.

## Proximos passos

1. Criar tabelas de conexao, thread e mensagem.
2. Criar `channelHub` com providers abstratos.
3. Comecar por e-mail.
4. Depois LinkedIn.
5. Depois WhatsApp espelhado / WhatsApp Web.
