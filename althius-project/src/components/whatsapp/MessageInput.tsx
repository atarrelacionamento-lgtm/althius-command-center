import { useState, KeyboardEvent } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { sendMessage } from '@/services/whatsappSync'

interface Props {
  chatId: string
  disabled?: boolean
}

export function MessageInput({ chatId, disabled }: Props) {
  const [text, setText]     = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function send() {
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    setError(null)
    try {
      await sendMessage(chatId, content)
      setText('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="border-t p-3" style={{ borderColor: '#242424', background: '#0A0A0A' }}>
      {error && (
        <div className="text-xs mb-2" style={{ color: '#EF4444' }}>{error}</div>
      )}
      <div className="flex gap-2 items-end">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="Digite uma mensagem…"
          rows={1}
          disabled={disabled || sending}
          className="flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none"
          style={{
            background: '#141414',
            border: '1px solid #2E2E2E',
            color: '#EBEBEB',
            minHeight: 38,
            maxHeight: 120,
          }}
        />
        <button
          onClick={send}
          disabled={disabled || sending || !text.trim()}
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-opacity"
          style={{
            background: '#F97316',
            color: '#0A0A0A',
            opacity: disabled || sending || !text.trim() ? 0.4 : 1,
          }}
          title="Enviar (Enter)"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      <p className="text-[10px] mt-2" style={{ color: '#606060' }}>
        **negrito**, *itálico*, ~~riscado~~, `código`
      </p>
    </div>
  )
}
