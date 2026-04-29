-- ============================================================
-- Pipa Driven — Mirror Schema (MVP)
-- WhatsApp Web ↔ CRM bidirectional sync
-- ============================================================

-- 1. Tabela de chats (lista de conversas monitoradas)
CREATE TABLE IF NOT EXISTS chats (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id         text UNIQUE NOT NULL,
  chat_name       text NOT NULL,
  is_group        boolean DEFAULT false,
  phone           text,
  last_seen_at    timestamptz DEFAULT now(),
  crm_deal_id     uuid,
  crm_contact_id  uuid,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chats_chat_id    ON chats(chat_id);
CREATE INDEX IF NOT EXISTS idx_chats_deal_id    ON chats(crm_deal_id);
CREATE INDEX IF NOT EXISTS idx_chats_last_seen  ON chats(last_seen_at DESC);

-- 2. Tabela de mensagens capturadas (espelho do WhatsApp)
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  raw_id           text UNIQUE NOT NULL,  -- data-id do WhatsApp (dedup)
  chat_id          text NOT NULL,
  chat_name        text,
  author           text,
  author_phone     text,
  direction        text NOT NULL,  -- 'in' | 'out'
  type             text NOT NULL DEFAULT 'text',  -- text|audio|image|video|document|sticker|system
  content_md       text,
  media_url        text,
  media_mime       text,
  reply_to_raw_id  text,
  timestamp_wa     timestamptz,
  captured_at      timestamptz DEFAULT now(),
  deleted_at       timestamptz,
  edit_history     jsonb DEFAULT '[]'::jsonb,
  crm_deal_id      uuid,
  crm_contact_id   uuid
);

CREATE INDEX IF NOT EXISTS idx_wa_msg_raw_id     ON whatsapp_messages(raw_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_chat_id    ON whatsapp_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_deal_id    ON whatsapp_messages(crm_deal_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_timestamp  ON whatsapp_messages(timestamp_wa DESC);

-- 3. Tabela de outbox (mensagens do CRM pro WhatsApp)
CREATE TABLE IF NOT EXISTS whatsapp_outbox (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id      text NOT NULL,
  content_md   text NOT NULL,
  status       text NOT NULL DEFAULT 'pending',  -- pending|sending|sent|failed
  raw_id       text,
  error        text,
  created_by   uuid,
  created_at   timestamptz DEFAULT now(),
  sent_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_outbox_status   ON whatsapp_outbox(status);
CREATE INDEX IF NOT EXISTS idx_outbox_chat_id  ON whatsapp_outbox(chat_id);

-- ============================================================
-- RLS — Policies permissivas no MVP (apertar depois)
-- ============================================================

ALTER TABLE chats              ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_outbox    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chats_all"    ON chats;
DROP POLICY IF EXISTS "wa_msg_all"   ON whatsapp_messages;
DROP POLICY IF EXISTS "outbox_all"   ON whatsapp_outbox;

CREATE POLICY "chats_all"  ON chats              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "wa_msg_all" ON whatsapp_messages  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "outbox_all" ON whatsapp_outbox    FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Realtime (habilita para subscriptions)
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_outbox;
ALTER PUBLICATION supabase_realtime ADD TABLE chats;

-- ============================================================
-- Storage bucket para mídia
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY IF NOT EXISTS "wa_media_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'whatsapp-media');

CREATE POLICY IF NOT EXISTS "wa_media_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'whatsapp-media');

CREATE POLICY IF NOT EXISTS "wa_media_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'whatsapp-media');
