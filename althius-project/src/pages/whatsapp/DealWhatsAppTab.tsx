import { WhatsAppConversation } from '@/components/whatsapp/WhatsAppConversation'

interface Props {
  dealId: string
  chatId?: string | null
}

export function DealWhatsAppTab({ dealId, chatId }: Props) {
  if (!chatId) {
    return (
      <div
        className="flex flex-col items-center justify-center h-96 rounded-lg"
        style={{ background: '#0A0A0A', border: '1px solid #242424', color: '#606060' }}
      >
        <p className="text-sm mb-2">Este negócio ainda não tem um chat WhatsApp vinculado</p>
        <p className="text-xs">Vincule um chat monitorado na extensão Pipa.</p>
      </div>
    )
  }

  return (
    <div
      className="h-[calc(100vh-280px)] rounded-lg overflow-hidden"
      style={{ border: '1px solid #242424' }}
    >
      <WhatsAppConversation chatId={chatId} dealId={dealId} />
    </div>
  )
}
