import { useNavigate } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { WhatsAppTimeline } from "@/components/crm/WhatsAppTimeline";

export default function MensagensPage() {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-green-600" />
          <h1 className="text-2xl font-bold">WhatsApp</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Consulta operacional das conversas capturadas no CRM.
        </p>
      </div>

      <WhatsAppTimeline
        storageKey="whatsapp-all-conversations"
        title="Conversas capturadas"
        description="Veja chat_key, mensagens individuais, audio, transcript e falhas sem depender da IA."
        onOpenCompany={(companyId) => navigate(`/crm/empresas/${companyId}`)}
      />
    </DashboardLayout>
  );
}
