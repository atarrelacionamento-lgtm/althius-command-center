import { format, isToday, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Mic, Image as ImageIcon, FileText, Video, Check } from 'lucide-react'
import { MarkdownText } from './MarkdownText'
import type { WhatsAppMessage } from '@/types/whatsapp'

const TYPE_ICONS: Record<string, JSX.Element | null> = {
  audio:    <Mic       className="w-3 h-3" />,
  image:    <ImageIcon className="w-3 h-3" />,
  document: <FileText  className="w-3 h-3" />,
  video:    <Video     className="w-3 h-3" />,
  text:     null, system: null, sticker: null,
}

function fmtTime(iso: string | null): string {
  if (!iso) return ''
  try {
    const d = parseISO(iso)
    return isToday(d) ? format(d, 'HH:mm') : format(d, 'dd/MM HH:mm', { locale: ptBR })
  } catch { return '' }
}

export function MessageBubble({ msg }: { msg: WhatsAppMessage }) {
  const isOut = msg.direction === 'out'

  if (msg.type === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span
          className="text-xs italic px-3 py-1 rounded-full"
          style={{ color: '#606060', background: '#141414', border: '1px solid #242424' }}
        >
          <MarkdownText md={msg.content_md} />
        </span>
      </div>
    )
  }

  return (
    <div className={`flex mb-1.5 ${isOut ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 ${isOut ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
        style={{
          background: isOut ? '#1A3329' : '#141428',
          border: `1px solid ${isOut ? '#2D4A3E' : '#1E1E3A'}`,
        }}
      >
        {!isOut && msg.author && (
          <p className="text-xs font-semibold mb-1" style={{ color: '#F97316' }}>
            {msg.author}
          </p>
        )}

        <div
          className="text-sm whitespace-pre-wrap break-words"
          style={{ color: '#EBEBEB', lineHeight: 1.5 }}
        >
          <MarkdownText md={msg.content_md} />
        </div>

        <div className="flex items-center gap-1 mt-1 justify-end">
          {TYPE_ICONS[msg.type] && (
            <span style={{ color: '#606060' }}>{TYPE_ICONS[msg.type]}</span>
          )}
          <span className="text-[10px]" style={{ color: '#606060' }}>
            {fmtTime(msg.timestamp_wa)}
          </span>
          {isOut && <Check className="w-3 h-3" style={{ color: '#22C55E' }} />}
        </div>
      </div>
    </div>
  )
}
