import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CADENCE_TEMPLATES: Record<number, Record<string, string>> = {
  1: {
    cmo: `Olá, {contact_name}. Tudo bem? Sou o Renan, da Pipa Driven. Trabalho implementando IA e estruturando a infraestrutura de GTM para incorporadoras. Vi seu trabalho na {company_name} há {time_at_company} e tomei a liberdade de rodar um lead oculto no {empreendimento}. O retorno levou {response_time}. Basicamente, boa parte do seu orçamento de mídia está 'morrendo' antes da primeira interação. Estou tentando contato com o responsável comercial também. Faz sentido falarmos 5 min sobre como estancar esse desperdício?`,
    dir_comercial: `Olá, {contact_name}. Sou o Renan, da Pipa Driven. Trabalho implementando IA e estruturando a operação comercial de incorporadoras de alto padrão. Vi que você está à frente da {company_name} e rodei um lead oculto hoje. O resultado: {response_time} para o primeiro contato. Cada hora de atraso é uma comissão que seu time deixa na mesa. Podemos falar 5 min sobre como automatizar essa rampa de conversão?`,
    socio: `Olá, {contact_name}. Sou o Renan, da Pipa Driven. Trabalho implementando IA e estruturando o GTM de incorporadoras de alto padrão. Tenho tentado contato com o time de Mkt/Vendas sobre um diagnóstico de lead oculto que rodei na {company_name}. O tempo de resposta: {response_time}. Em operações do seu porte, esse 'gap' costuma custar milhões em VGV não realizado por ano. Podemos alinhar uma breve conversa?`,
  },
  3: {
    cmo: `{contact_name}, como prometido, gravei um vídeo de 60s mostrando exatamente onde o lead 'esfriou' no teste que fiz. Não é crítica ao time, mas uma prova de que falta infraestrutura para eles converterem o que você gera. Consegue ver o vídeo e me dizer se estancar esse 'buraco negro' é prioridade este mês? {loom_url}`,
    dir_comercial: `{contact_name}, gravei um diagnóstico em vídeo mostrando o comportamento do time de vocês no lead teste. São apenas 60 segundos — mas o que aparece é o principal gargalo de conversão da operação. Vale 1 minuto do seu tempo? {loom_url}`,
    socio: `{contact_name}, fiz um estudo rápido sobre o impacto financeiro do gap de resposta que identificamos na {company_name}. Os números são relevantes para o VGV em aberto. Valeria uma conversa de 10 min com o time comercial e de marketing juntos? {loom_url}`,
  },
  5: {
    socio: `Olá, {contact_name}. Como Sócio, imagino que a previsibilidade do VGV seja sua maior preocupação. A Pipa Driven garante que nenhum lead gerado seja desperdiçado por falta de processo. Conseguimos 10 min ainda essa semana?`,
    cmo: `{contact_name}, vi que o time está focado na operação. Enquanto isso, cada lead não respondido em menos de 5 minutos reduz a taxa de conversão em até 80%. Tenho um diagnóstico personalizado para a {company_name}. Vale uma call rápida?`,
    dir_comercial: `{contact_name}, tenho tentado contato pois o diagnóstico que fiz revelou algo importante sobre o funil de vocês. Não quero ser invasivo, mas o custo de não agir aqui é real. Posso mostrar em 10 min como resolver. Quando teria um horário?`,
  },
  12: {
    cmo: `{contact_name}, um dos nossos clientes de médio-alto padrão recuperou R$ 2,4 milhões em VGV em apenas 4 meses após estruturarmos essa mesma camada de inteligência que estou te propondo. Não quero te vender um software, quero implementar essa infraestrutura na {company_name}. Qual o melhor horário para uma call de 10 min?`,
    dir_comercial: `{contact_name}, implementamos o mesmo sistema em outra incorporadora aqui da região e o Lead Response Time caiu de 4h para menos de 2 minutos. O resultado: 34% mais reuniões agendadas no primeiro mês. Vale uma conversa rápida sobre como replicar isso em vocês?`,
    socio: `{contact_name}, sei que sua prioridade é a velocidade de escoamento do VGV. A nossa solução resolve exatamente isso: do lead à visita em menos de 5 minutos, com rastreabilidade total. Posso mostrar em 10 min. Quando teria disponibilidade?`,
  },
  15: {
    socio: `{contact_name}, vi que o time de Mkt/Vendas está focado na operação. Como Sócio, imagino que a previsibilidade do VGV seja sua maior preocupação. A Pipa Driven garante que nenhum lead gerado seja desperdiçado por falta de processo. Conseguimos 10 min na próxima semana?`,
    cmo: `{contact_name}, última tentativa antes de encerrar meu contato. Tenho um business case específico para a {company_name} que mostra o ROI esperado nos primeiros 90 dias. Vale 15 minutos do seu tempo?`,
    dir_comercial: `{contact_name}, quero ser direto: o diagnóstico que fiz da operação de vocês mostra um vazamento de VGV significativo. Posso apresentar a solução em 10 minutos. Se não for o momento, tudo bem — mas gostaria de pelo menos mostrar os números antes de encerrar.`,
  },
  21: {
    cmo: `{contact_name}, entendo que o timing talvez não seja o ideal agora. Vou encerrar meus contatos por aqui para não ser invasivo. Deixo o diagnóstico que fiz à sua disposição. Se em algum momento o custo do VGV parado pesar mais que a inércia, meu contato continua o mesmo. Sucesso na {company_name}!`,
    dir_comercial: `{contact_name}, encerrando minha cadência de contatos por aqui. O diagnóstico que fiz fica disponível se precisar. Caso a prioridade mude, estarei aqui. Muito sucesso!`,
    socio: `{contact_name}, encerro aqui minha tentativa de contato. O estudo de impacto que fiz para a {company_name} fica à disposição. Se em algum momento quiser conversar sobre como recuperar VGV parado com IA, é só me acionar. Sucesso!`,
  },
};

function getTemplate(day: number, persona: string): string {
  // Encontrar o dia mais próximo disponível
  const availableDays = Object.keys(CADENCE_TEMPLATES).map(Number).sort((a, b) => a - b);
  const targetDay = availableDays.reduce((prev, curr) =>
    Math.abs(curr - day) < Math.abs(prev - day) ? curr : prev
  );
  return CADENCE_TEMPLATES[targetDay]?.[persona] ||
    CADENCE_TEMPLATES[targetDay]?.["cmo"] || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const {
      company_id,
      persona_type,
      cadence_day,
      contact_name,
      phase0_result,
      loom_url,
    } = await req.json();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Buscar dados da empresa
    const { data: company } = await supabase
      .from("companies")
      .select("name, city, segment")
      .eq("id", company_id)
      .single();

    if (!company) throw new Error("Empresa não encontrada");

    // Pegar template base
    const baseTemplate = getTemplate(cadence_day, persona_type);

    // Substituir placeholders básicos
    const message = baseTemplate
      .replace(/{company_name}/g, company.name)
      .replace(/{contact_name}/g, contact_name || "")
      .replace(/{loom_url}/g, loom_url || "[link do vídeo]")
      .replace(/{empreendimento}/g, "[empreendimento]")
      .replace(/{time_at_company}/g, "[X anos]")
      .replace(/{response_time}/g,
        phase0_result?.first_response_minutes
          ? `${phase0_result.first_response_minutes} minutos`
          : "[X horas]"
      );

    // Se não tem API key da Anthropic, retorna template direto
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ message, source: "template" }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Personalizar com Claude
    const prompt = `Você é um assistente de vendas da Pipa Driven — SaaS de inteligência comercial para incorporadoras imobiliárias.

Personalize esta mensagem de prospecção para enviar via ${persona_type === "send_linkedin" ? "LinkedIn" : "WhatsApp"}:

MENSAGEM BASE:
${message}

CONTEXTO DA EMPRESA:
- Nome: ${company.name}
- Cidade: ${company.city || "não informada"}
- Segmento: ${company.segment || "Incorporadora"}
- Dia da cadência: ${cadence_day}/21
- Persona: ${persona_type}
${phase0_result ? `- Resultado do lead oculto: respondeu em ${phase0_result.first_response_minutes}min, ${phase0_result.followup_count} follow-ups em ${phase0_result.followup_days} dias` : ""}

REGRAS:
- Máximo 3 parágrafos curtos
- Tom consultivo, não de vendedor
- Português brasileiro natural
- Personalize com detalhes da empresa se possível
- Mantenha a estrutura e argumentos da mensagem base
- Retorne APENAS a mensagem final, sem explicações`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "anthropic-version": "2023-06-01",
        "x-api-key": ANTHROPIC_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const result = await response.json();
    const generatedMessage = result.content?.[0]?.text || message;

    return new Response(JSON.stringify({ message: generatedMessage, source: "claude" }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
