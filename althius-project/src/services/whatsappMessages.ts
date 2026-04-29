import { supabase } from '@/lib/supabase'
import type { WhatsAppMessage } from '@/types/whatsapp'

export async function getMessagesByDeal(dealId: string): Promise<WhatsAppMessage[]> {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('crm_deal_id', dealId)
    .order('timestamp', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function getMessagesByChat(chatId: string): Promise<WhatsAppMessage[]> {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('timestamp', { ascending: true })

  if (error) throw error
  return data ?? []
}

export function subscribeToMessages(chatId: string, onMessage: (msg: WhatsAppMessage) => void) {
  return supabase
    .channel(`messages:${chatId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'whatsapp_messages',
      filter: `chat_id=eq.${chatId}`
    }, (payload) => onMessage(payload.new as WhatsAppMessage))
    .subscribe()
}
