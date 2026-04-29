import type { PersonaType, TaskType } from "@/services/abmService";

export const PIPA_GTM_CONTEXT = {
  mission:
    "Estruturar o GTM de incorporadoras com IA, WhatsApp, dados e execucao para eliminar o buraco negro entre lead, atendimento, corretor e venda.",
  enemy:
    "Terceirizacao cega da operacao comercial: a incorporadora investe em midia, mas perde visibilidade de resposta, follow-up, visita, proposta e venda.",
  commercialGoal: {
    monthlyNewContracts: 4,
    targetMrr: 30000,
    averageTicket: 7500,
    monthlyAccountsInPhase0: 200,
    weeklyAccountsInPhase0: 50,
  },
  hiddenLeadBenchmark: {
    fastResponseMinutes: 15,
    slowResponseMinutes: 60,
    observationDays: 7,
    highConversionFollowups: 6,
  },
};

export const ICP_RULES = {
  idealEmployees: "30-80 funcionarios",
  acceptableEmployees: "20-200 funcionarios",
  idealVgv: "R$ 80M - R$ 500M",
  acceptableVgv: "R$ 50M - R$ 800M",
  monthlyMediaSpend: "R$ 20k - R$ 100k",
  annualLaunches: "2-4 empreendimentos",
  projectUnits: "20-150 unidades",
  salesCycle: "12-36 meses",
  primaryRegions: [
    "Sao Paulo",
    "Campinas",
    "Ribeirao Preto",
    "Florianopolis",
    "Balneario Camboriu",
    "Joinville",
    "Curitiba",
    "Londrina",
    "Maringa",
    "Belo Horizonte",
    "Uberlandia",
    "Juiz de Fora",
  ],
};

export const PERSONA_PLAYBOOK: Record<
  PersonaType,
  {
    label: string;
    pain: string;
    successMetric: string;
    valueMessage: string;
  }
> = {
  cmo: {
    label: "CMO / Marketing",
    pain: "Nao consegue provar ROI das campanhas nem fechar atribuicao ponta a ponta.",
    successMetric: "CPL, CAC, atribuicao de receita e taxa de qualificacao.",
    valueMessage:
      "A Pipa conecta midia, atendimento e venda para transformar marketing em narrativa de receita.",
  },
  dir_comercial: {
    label: "Diretor Comercial",
    pain: "Opera como bombeiro sem visibilidade de resposta, follow-up, visita e perda real.",
    successMetric: "Conversao por etapa, velocidade de vendas, VGV realizado e lead response time.",
    valueMessage:
      "A Pipa da controle operacional do clique ate a escritura e reduz desperdicio no funil.",
  },
  socio: {
    label: "Socio / Fundador",
    pain: "Sente o custo financeiro do VGV parado e a falta de alavanca sobre execucao terceirizada.",
    successMetric: "VGV realizado, margem, previsibilidade de receita e custo de inercia.",
    valueMessage:
      "A Pipa transforma o funil em infraestrutura controlavel para acelerar VGV e proteger margem.",
  },
  ceo: {
    label: "CEO",
    pain: "Precisa escalar receita com previsibilidade, sem depender de prioridades externas.",
    successMetric: "MRR, contratos, ciclo de vendas, previsibilidade e expansao por portifolio.",
    valueMessage:
      "A Pipa cria uma camada de inteligencia proprietaria para governar crescimento comercial.",
  },
  other: {
    label: "Pessoa-chave",
    pain: "Pode influenciar a decisao, mas precisa de contexto simples e prova operacional.",
    successMetric: "Engajamento, resposta e indicacao para decisores.",
    valueMessage:
      "A Pipa organiza o processo para que a conta pare de perder lead quente por falta de metodo.",
  },
};

export interface CadenceTemplate {
  day: number;
  block: 1 | 2 | 3;
  label: string;
  taskType: TaskType;
  personas: PersonaType[];
  channel: "whatsapp" | "linkedin" | "phone" | "email";
  message: string;
}

export const PIPA_21_DAY_CADENCE: CadenceTemplate[] = [
  {
    day: 1,
    block: 1,
    label: "Impacto real do lead oculto",
    taskType: "send_whatsapp",
    personas: ["cmo", "dir_comercial"],
    channel: "whatsapp",
    message:
      "Olá, {{nome}}. Sou o Renan, da Pipa Driven. Rodei um lead oculto no {{empresa}} e encontrei um gap no atendimento. O ponto nao e criticar o time, e mostrar onde o dinheiro da midia esfria antes de virar visita. Faz sentido falarmos 5 min sobre como estancar esse desperdicio?",
  },
  {
    day: 1,
    block: 1,
    label: "Conexao no LinkedIn",
    taskType: "send_linkedin",
    personas: ["cmo", "dir_comercial"],
    channel: "linkedin",
    message:
      "Olá, {{nome}}. Acompanho o trabalho da {{empresa}} e gostaria de me conectar.",
  },
  {
    day: 3,
    block: 1,
    label: "Prova visual do diagnostico",
    taskType: "send_whatsapp",
    personas: ["cmo", "dir_comercial"],
    channel: "whatsapp",
    message:
      "{{nome}}, gravei um video curto mostrando onde o lead esfriou no teste. Nao e sobre vender mais um CRM, e sobre dar infraestrutura para o time converter o que a midia ja gera. Esse buraco negro e prioridade este mes?",
  },
  {
    day: 4,
    block: 1,
    label: "Confirmar recebimento",
    taskType: "make_call",
    personas: ["cmo", "dir_comercial"],
    channel: "phone",
    message:
      "Confirmar se {{nome}} viu o diagnostico em video e medir temperatura da dor. Objetivo: conversa curta, nao pitch completo.",
  },
  {
    day: 5,
    block: 2,
    label: "Escalada para socio",
    taskType: "send_whatsapp",
    personas: ["socio", "ceo"],
    channel: "whatsapp",
    message:
      "Olá, {{nome}}. Sou o Renan, da Pipa Driven. Rodei um diagnostico de lead oculto na {{empresa}} e encontrei um gap que normalmente vira VGV nao realizado. Fiz um estudo rapido de impacto. Podemos alinhar uma conversa breve?",
  },
  {
    day: 8,
    block: 2,
    label: "Diagnostico interativo",
    taskType: "send_whatsapp",
    personas: ["cmo", "dir_comercial", "socio", "ceo"],
    channel: "whatsapp",
    message:
      "{{nome}}, montei um diagnostico para a {{empresa}} simular o desperdicio mensal de midia e VGV. A ideia e dar visibilidade total do funil para marketing, vendas e diretoria olharem o mesmo numero.",
  },
  {
    day: 12,
    block: 3,
    label: "Prova de autoridade",
    taskType: "send_whatsapp",
    personas: ["cmo", "dir_comercial", "socio", "ceo"],
    channel: "whatsapp",
    message:
      "{{nome}}, a tese aqui nao e software pelo software. E infraestrutura comercial para recuperar VGV que ja esta sendo comprado via midia. Qual melhor horario para uma call de 10 min?",
  },
  {
    day: 15,
    block: 3,
    label: "Persistencia C-Level",
    taskType: "make_call",
    personas: ["socio", "ceo"],
    channel: "phone",
    message:
      "Ligar para {{nome}} com foco em previsibilidade de VGV, custo de inercia e risco de deixar lead quente sem processo.",
  },
  {
    day: 21,
    block: 3,
    label: "Break-up de integridade",
    taskType: "send_whatsapp",
    personas: ["cmo", "dir_comercial", "socio", "ceo"],
    channel: "whatsapp",
    message:
      "{{nome}}, entendo que talvez o timing nao seja ideal agora. Vou encerrar meus contatos para nao ser invasivo. Deixo o diagnostico da {{empresa}} a disposicao; quando o custo do VGV parado pesar mais que a inercia, meu contato continua o mesmo.",
  },
];

export function inferPersonaFromRole(role?: string | null): PersonaType {
  const normalized = (role ?? "").toLowerCase();
  if (normalized.includes("cmo") || normalized.includes("marketing")) return "cmo";
  if (
    normalized.includes("comercial") ||
    normalized.includes("vendas") ||
    normalized.includes("sales")
  ) {
    return "dir_comercial";
  }
  if (
    normalized.includes("socio") ||
    normalized.includes("sócio") ||
    normalized.includes("founder") ||
    normalized.includes("fundador")
  ) {
    return "socio";
  }
  if (normalized.includes("ceo") || normalized.includes("presidente")) return "ceo";
  return "other";
}

export function personalizeTemplate(template: string, params: { name: string; company: string }) {
  return template
    .replaceAll("{{nome}}", params.name)
    .replaceAll("{{empresa}}", params.company);
}
