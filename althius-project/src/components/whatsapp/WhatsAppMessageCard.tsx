import { format, isToday, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Mic, FileText, Image, Check } from 'lucide-react'
import type { WhatsAppMessage } from '@/types/whatsapp'

interface Props {
  message: WhatsAppMessage
}

export function WhatsAppMessageCard({ message }: Props) {
  const isOutbound = message.direction === 'outbound'
  const ts = parseISO(message.timestamp)
  const timeStr = isToday(ts)
    ? format(ts, 'HH:mm')
    : format(ts, 'dd/MM HH:mm', { locale: ptBR })

  const typeIcon = {
    audio: <Mic className="w-3 h-3" />,
    image: <Image className="w-3 h-3" />,
    document: <FileText className="w-3 h-3" />,
  }[message.message_type] ?? null

  return (
    <div className={`flex mb-2 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 ${
          isOutbound
            ? 'bg-[#2D4A3E] rounded-tr-sm'
            : 'bg-[#1A1A2E] rounded-tl-sm'
        }`}
      >
        {!isOutbound && message.sender_name && (
          <p className="text-xs font-semibold text-orange-400 mb-1">
            {message.sender_name}
          </p>
        )}

        {message.message_type === 'audio' ? (
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <div>
              {message.transcript ? (
                <p className="text-sm text-gray-200">{message.transcript}</p>
              ) : (
                <p className="text-sm text-gray-500 italic">Transcrevendo...</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-200 whitespace-pre-wrap">
            {message.content}
          </p>
        )}

        <div className="flex items-center gap-1 mt-1 justify-end">
          {typeIcon && (
            <span className="text-gray-500">{typeIcon}</span>
          )}
          <span className="text-[10px] text-gray-500">{timeStr}</span>
          {isOutbound && <Check className="w-3 h-3 text-green-400" />}
        </div>
      </div>
    </div>
  )
}
