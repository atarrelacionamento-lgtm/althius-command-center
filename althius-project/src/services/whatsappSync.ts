import { supabase } from '@/lib/supabase'
import type { WhatsAppMessage, OutboxMessage, ChatRow } from '@/types/whatsapp'

/**
 * Althius WhatsApp Sync Service
 * Refatorado para usar o cliente global e o novo schema de conversas.
 */

export async function getMessagesByChat(chat_id: string): Promise<WhatsAppMessage[]> {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('chat_key', chat_id)
    .order('occurred_at', { ascending: true })
    .limit(500)
  if (error) throw error
  return (data ?? []) as unknown as WhatsAppMessage[]
}

export async function getMessagesByDeal(deal_id: string): Promise<WhatsAppMessage[]> {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('crm_deal_id', deal_id)
    .order('occurred_at', { ascending: true })
    .limit(500)
  if (error) throw error
  return (data ?? []) as unknown as WhatsAppMessage[]
}

export async function listChats(): Promise<ChatRow[]> {
  // O novo schema usa whatsapp_conversations em vez de chats
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .order('last_message_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []) as unknown as ChatRow[]
}

export async function sendMessage(chat_id: string, content_md: string): Promise<string> {
  // Mantém a lógica de outbox para processamento assíncrono via Edge Function ou n8n
  const { data, error } = await supabase
    .from('whatsapp_outbox')
    .insert({ 
      chat_key: chat_id, 
      content: content_md, 
      status: 'pending' 
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export function subscribeMessages(chat_id: string, onMessage: (m: WhatsAppMessage) => void) {
  return supabase
    .channel(`mirror:${chat_id}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'whatsapp_messages',
      filter: `chat_key=eq.${chat_id}`,
    }, (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        onMessage(payload.new as unknown as WhatsAppMessage)
      }
    })
    .subscribe()
}

export async function linkChatToDeal(chat_id: string, deal_id: string): Promise<void> {
  // Atualiza tanto a conversa quanto as mensagens vinculadas
  await supabase.from('whatsapp_conversations').update({ crm_deal_id: deal_id }).eq('chat_key', chat_id)
  await supabase.from('whatsapp_messages').update({ crm_deal_id: deal_id }).eq('chat_key', chat_id)
}
