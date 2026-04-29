import { useEffect, useState } from 'react'
import { MessageCircle, Search } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { listChats } from '@/services/whatsappSync'
import { WhatsAppConversation } from '@/components/whatsapp/WhatsAppConversation'
import type { ChatRow } from '@/types/whatsapp'

export default function WhatsAppInbox() {
  const [chats, setChats]       = useState<ChatRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery]       = useState('')

  useEffect(() => {
    let mounted = true
    const load = () => listChats()
      .then((rows) => {
        if (!mounted) return
        setChats(rows)
        setSelected((prev) => prev ?? rows[0]?.chat_id ?? null)
      })
      .catch(() => { /* noop */ })
      .finally(() => mounted && setLoading(false))

    load()
    const id = setInterval(load, 5000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  const filtered = query
    ? chats.filter((c) => c.chat_name.toLowerCase().includes(query.toLowerCase()))
    : chats

  const activeChat = chats.find((c) => c.chat_id === selected)

  return (
    <div className="flex h-[calc(100vh-64px)]" style={{ background: '#0A0A0A' }}>
      <aside className="w-80 border-r flex flex-col" style={{ borderColor: '#242424' }}>
        <div className="p-3 border-b" style={{ borderColor: '#242424' }}>
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: '#141414', border: '1px solid #2E2E2E' }}
          >
            <Search className="w-4 h-4" style={{ color: '#606060' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar chat…"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: '#EBEBEB' }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-sm" style={{ color: '#606060' }}>Carregando chats…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center" style={{ color: '#606060' }}>
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum chat monitorado</p>
              <p className="text-xs mt-2">
                Abra um chat no WhatsApp Web com a extensão ativa
              </p>
            </div>
          ) : (
            filtered.map((c) => (
              <ChatListItem
                key={c.id}
                chat={c}
                active={c.chat_id === selected}
                onSelect={() => setSelected(c.chat_id)}
              />
            ))
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        {activeChat ? (
          <>
            <header
              className="px-4 py-3 border-b flex items-center justify-between"
              style={{ borderColor: '#242424', background: '#141414' }}
            >
              <div>
                <div className="font-semibold" style={{ color: '#EBEBEB' }}>
                  {activeChat.chat_name}
                </div>
                <div className="text-xs" style={{ color: '#606060' }}>
                  {activeChat.is_group ? 'Grupo' : activeChat.phone ?? 'WhatsApp'}
                </div>
              </div>
            </header>
            <div className="flex-1 min-h-0">
              <WhatsAppConversation chatId={activeChat.chat_id} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center" style={{ color: '#606060' }}>
            <MessageCircle className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Selecione um chat à esquerda</p>
          </div>
        )}
      </main>
    </div>
  )
}

function ChatListItem({
  chat, active, onSelect,
}: { chat: ChatRow; active: boolean; onSelect: () => void }) {
  let relative = ''
  try {
    relative = formatDistanceToNow(parseISO(chat.last_seen_at), { locale: ptBR, addSuffix: false })
  } catch { /* noop */ }

  return (
    <button
      onClick={onSelect}
      className="w-full text-left px-4 py-3 border-b transition-colors"
      style={{
        borderColor: '#1A1A1A',
        background: active ? '#141414' : 'transparent',
        borderLeft: active ? '2px solid #F97316' : '2px solid transparent',
      }}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className="font-medium text-sm truncate" style={{ color: '#EBEBEB' }}>
          {chat.chat_name}
        </span>
        <span className="text-[10px] flex-shrink-0 ml-2" style={{ color: '#606060' }}>
          {relative}
        </span>
      </div>
      <div className="text-xs truncate" style={{ color: '#606060' }}>
        {chat.is_group ? '👥 Grupo' : chat.phone ?? 'Chat privado'}
      </div>
    </button>
  )
}
