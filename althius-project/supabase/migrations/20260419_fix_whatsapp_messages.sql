-- Garante que a tabela existe com todas as colunas corretas
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id text NOT NULL,
  chat_name text,
  sender_name text,
  sender_phone text,
  content text,
  message_type text DEFAULT 'text',
  media jsonb,
  media_url text,
  media_type text,
  timestamp timestamptz DEFAULT now(),
  raw_timestamp text,
  direction text DEFAULT 'inbound',
  crm_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  crm_deal_id uuid REFERENCES deals(id) ON DELETE SET NULL,
  processed boolean DEFAULT false,
  ai_analysis jsonb,
  transcript text,
  created_at timestamptz DEFAULT now()
);

-- Adiciona colunas que podem estar faltando (idempotente)
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media jsonb;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_type text;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS chat_name text;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS raw_timestamp text;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS processed boolean DEFAULT false;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS ai_analysis jsonb;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS transcript text;

-- RLS
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Política: usuário autenticado vê suas mensagens
CREATE POLICY IF NOT EXISTS "Users can view own messages"
  ON whatsapp_messages FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Users can insert messages"
  ON whatsapp_messages FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Index para queries por chat
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_chat_id ON whatsapp_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_deal_id ON whatsapp_messages(crm_deal_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_timestamp ON whatsapp_messages(timestamp DESC);

-- Tabela de chats monitorados
CREATE TABLE IF NOT EXISTS monitored_chats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id text UNIQUE NOT NULL,
  chat_name text NOT NULL,
  crm_deal_id uuid REFERENCES deals(id) ON DELETE SET NULL,
  crm_deal_name text,
  active boolean DEFAULT true,
  message_count integer DEFAULT 0,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE monitored_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users can manage monitored chats"
  ON monitored_chats FOR ALL
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');
