import { useEffect, useRef, useState } from 'react'
import { format, parseISO, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MessageCircle, RefreshCw } from 'lucide-react'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import {
  getMessagesByChat,
  getMessagesByDeal,
  subscribeMessages,
} from '@/services/whatsappSync'
import type { WhatsAppMessage } from '@/types/whatsapp'

interface Props {
  chatId: string
  dealId?: string
}

export function WhatsAppConversation({ chatId, dealId }: Props) {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)

    const load = dealId ? getMessagesByDeal(dealId) : getMessagesByChat(chatId)
    load
      .then((rows) => mounted && setMessages(rows))
      .catch((e) => mounted && setError((e as Error).message))
      .finally(() => mounted && setLoading(false))

    return () => { mounted = false }
  }, [chatId, dealId])

  useEffect(() => {
    const sub = subscribeMessages(chatId, (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.raw_id === msg.raw_id)) return prev
        return [...prev, msg]
      })
    })
    return () => { sub.unsubscribe() }
  }, [chatId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: '#606060', background: '#0A0A0A' }}
      >
        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
        <span className="text-sm">Carregando conversa…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="p-4 text-sm m-4 rounded-lg"
        style={{ color: '#FCA5A5', background: '#2A0F12', border: '1px solid #5C1A1F' }}
      >
        Erro ao carregar mensagens: {error}
      </div>
    )
  }

  let lastDate: Date | null = null

  return (
    <div className="flex flex-col h-full" style={{ background: '#0A0A0A' }}>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-full"
            style={{ color: '#606060' }}
          >
            <MessageCircle className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Nenhuma mensagem ainda</p>
            <p className="text-xs mt-1">
              Monitore este chat na extensão Althius
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            let divider: JSX.Element | null = null
            try {
              const d = parseISO(msg.timestamp_wa)
              if (!lastDate || !isSameDay(lastDate, d)) {
                divider = (
                  <div className="flex items-center justify-center my-3">
                    <span
                      className="text-xs px-3 py-1 rounded-full"
                      style={{
                        color: '#606060',
                        background: '#141414',
                        border: '1px solid #242424',
                      }}
                    >
                      {format(d, "d 'de' MMMM", { locale: ptBR })}
                    </span>
                  </div>
                )
                lastDate = d
              }
            } catch { /* noop */ }

            return (
              <div key={msg.id}>
                {divider}
                <MessageBubble msg={msg} />
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <MessageInput chatId={chatId} />
    </div>
  )
}
