export type MessageType =
  | 'text'
  | 'audio'
  | 'image'
  | 'video'
  | 'document'
  | 'sticker'
  | 'system'

export type MessageDirection = 'in' | 'out'

export interface WhatsAppMessage {
  id: string
  chat_id: string
  deal_id: string | null
  raw_id: string
  direction: MessageDirection
  type: MessageType
  author: string | null
  phone: string | null
  content_md: string | null
  media_url: string | null
  media_mime: string | null
  quoted_raw_id: string | null
  timestamp_wa: string
  captured_at: string
}

export interface ChatRow {
  id: string
  chat_id: string
  chat_name: string
  phone: string | null
  is_group: boolean
  deal_id: string | null
  last_seen_at: string
  created_at: string
}

export type OutboxStatus = 'pending' | 'sending' | 'sent' | 'failed'

export interface OutboxRow {
  id: string
  chat_id: string
  content_md: string
  status: OutboxStatus
  error: string | null
  attempts: number
  created_at: string
  sent_at: string | null
}
