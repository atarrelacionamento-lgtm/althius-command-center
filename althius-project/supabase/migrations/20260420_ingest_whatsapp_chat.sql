-- ============================================================
-- Pipa Driven — RPC para captura on-click da extensão
-- ============================================================
-- ATENÇÃO: esta migration alinha o schema existente (RODAR_TUDO.sql)
-- com a captura on-click da extensão. Ela é IDEMPOTENTE: adiciona
-- colunas apenas quando faltam e usa CREATE OR REPLACE.
--
-- Tabelas usadas (schema real, após RODAR_TUDO.sql):
--   - contacts(id, name, whatsapp, owner_id, source, company_id, ...)
--   - whatsapp_conversations(id, contact_id, company_id, phone_number, source, ...)
--   - whatsapp_messages(id, conversation_id NOT NULL, direction, body,
--                        wa_message_id UNIQUE, sent_at, contact_id, company_id)
-- ============================================================

-- 1. Extensões novas em `contacts` para contatos órfãos
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS is_orphan boolean NOT NULL DEFAULT false;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS wa_push_name text;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS wa_profile_pic_url text;

-- Unicidade parcial no whatsapp (permite múltiplos NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS contacts_whatsapp_unique
  ON public.contacts (whatsapp)
  WHERE whatsapp IS NOT NULL;

-- 2. Extensões novas em `whatsapp_conversations` para dedup por chat_id
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS wa_chat_id text;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conversations_wa_chat_id_key
  ON public.whatsapp_conversations (wa_chat_id)
  WHERE wa_chat_id IS NOT NULL;

-- 3. Garantir que `whatsapp_messages.wa_message_id` aceita dedup
-- (A tabela já tem UNIQUE via RODAR_TUDO.sql: wa_message_id UNIQUE.
--  Aqui só criamos um índice adicional caso a constraint unique ainda não exista.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'whatsapp_messages_wa_message_id_key'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_wa_message_id_key'
  ) THEN
    CREATE UNIQUE INDEX whatsapp_messages_wa_message_id_key
      ON public.whatsapp_messages (wa_message_id)
      WHERE wa_message_id IS NOT NULL;
  END IF;
END $$;

-- 4. Campo para guardar tipo original (text/audio/image/...) e from_me
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS message_type text;

-- 5. RPC: ingest_whatsapp_chat
-- ------------------------------------------------------------
-- p_chat:    { chat_id, number_e164, display_name, push_name, profile_pic_url }
-- p_messages: [{ wa_msg_id, chat_id, from_me, author, type, body, timestamp, has_media, quoted_msg_id }]
-- Retorna:   contact_id, contact_created, messages_inserted, messages_skipped
-- ------------------------------------------------------------

DROP FUNCTION IF EXISTS public.ingest_whatsapp_chat(jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.ingest_whatsapp_chat(
  p_chat     jsonb,
  p_messages jsonb
)
RETURNS TABLE (
  contact_id         uuid,
  contact_created    boolean,
  messages_inserted  integer,
  messages_skipped   integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number_e164    text := p_chat->>'number_e164';
  v_wa_chat_id     text := p_chat->>'chat_id';
  v_display_name   text := coalesce(nullif(p_chat->>'display_name',''), v_number_e164);
  v_push_name      text := p_chat->>'push_name';
  v_pic_url        text := p_chat->>'profile_pic_url';
  v_contact_id     uuid;
  v_company_id     uuid;
  v_conversation_id uuid;
  v_created        boolean := false;
  v_inserted       integer := 0;
  v_skipped        integer := 0;
  v_owner          uuid := auth.uid();
  v_msg            jsonb;
  v_wa_msg_id      text;
  v_direction      text;
  v_type           text;
  v_body           text;
  v_ts             timestamptz;
  v_ins            uuid;
BEGIN
  -- Sem owner autenticado não dá pra criar órfão (owner_id é NOT NULL)
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'usuário não autenticado';
  END IF;

  IF v_number_e164 IS NULL OR length(v_number_e164) < 4 THEN
    RAISE EXCEPTION 'número E.164 ausente ou inválido';
  END IF;

  -- ── 1. Resolver contato ─────────────────────────────────────
  SELECT c.id, c.company_id
    INTO v_contact_id, v_company_id
  FROM public.contacts c
  WHERE c.whatsapp = v_number_e164
  LIMIT 1;

  IF v_contact_id IS NULL THEN
    INSERT INTO public.contacts (
      name, whatsapp, owner_id, source, is_orphan,
      wa_push_name, wa_profile_pic_url
    )
    VALUES (
      v_display_name, v_number_e164, v_owner, 'whatsapp_capture', true,
      v_push_name, v_pic_url
    )
    RETURNING id, company_id INTO v_contact_id, v_company_id;
    v_created := true;
  ELSE
    UPDATE public.contacts
       SET wa_push_name       = COALESCE(wa_push_name, v_push_name),
           wa_profile_pic_url = COALESCE(wa_profile_pic_url, v_pic_url)
     WHERE id = v_contact_id;
  END IF;

  -- ── 2. Resolver / criar conversa ────────────────────────────
  SELECT id INTO v_conversation_id
    FROM public.whatsapp_conversations
   WHERE wa_chat_id = v_wa_chat_id
   LIMIT 1;

  IF v_conversation_id IS NULL THEN
    -- fallback: talvez já exista uma conversa pelo contact_id + phone
    SELECT id INTO v_conversation_id
      FROM public.whatsapp_conversations
     WHERE contact_id = v_contact_id
       AND coalesce(phone_number,'') = coalesce(v_number_e164,'')
     ORDER BY created_at DESC
     LIMIT 1;
  END IF;

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.whatsapp_conversations (
      contact_id, company_id, source, phone_number,
      raw_text, wa_chat_id, created_by
    )
    VALUES (
      v_contact_id, v_company_id, 'extension', v_number_e164,
      null, v_wa_chat_id, v_owner
    )
    RETURNING id INTO v_conversation_id;
  ELSE
    UPDATE public.whatsapp_conversations
       SET wa_chat_id   = COALESCE(wa_chat_id, v_wa_chat_id),
           phone_number = COALESCE(phone_number, v_number_e164),
           contact_id   = COALESCE(contact_id, v_contact_id)
     WHERE id = v_conversation_id;
  END IF;

  -- ── 3. Iterar mensagens ─────────────────────────────────────
  FOR v_msg IN SELECT * FROM jsonb_array_elements(coalesce(p_messages, '[]'::jsonb))
  LOOP
    v_wa_msg_id := v_msg->>'wa_msg_id';
    v_direction := CASE WHEN (v_msg->>'from_me')::boolean THEN 'outbound' ELSE 'inbound' END;
    v_type      := coalesce(v_msg->>'type', 'text');
    v_body      := coalesce(v_msg->>'body', '');

    BEGIN
      v_ts := (v_msg->>'timestamp')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      v_ts := now();
    END;

    IF v_wa_msg_id IS NULL OR v_wa_msg_id = '' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.whatsapp_messages (
      conversation_id, contact_id, company_id,
      direction, body, wa_message_id, sent_at, message_type
    )
    VALUES (
      v_conversation_id, v_contact_id, v_company_id,
      v_direction, v_body, v_wa_msg_id, v_ts, v_type
    )
    ON CONFLICT (wa_message_id) DO NOTHING
    RETURNING id INTO v_ins;

    IF v_ins IS NOT NULL THEN
      v_inserted := v_inserted + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_contact_id, v_created, v_inserted, v_skipped;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ingest_whatsapp_chat(jsonb, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.ingest_whatsapp_chat(jsonb, jsonb) FROM anon, public;
