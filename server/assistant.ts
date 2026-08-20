import { invokeLLM } from "./_core/llm";

export const CATEGORY_VALUES = [
  "CURSO",
  "CLÍNICA ADMINISTRATIVA",
  "CLÍNICA CLÍNICA",
  "FINANCEIRO",
  "RISCO",
] as const;

export type ConversationCategory = (typeof CATEGORY_VALUES)[number];

export type KnowledgeExcerpt = {
  title: string;
  content: string;
  sourceLabel: string;
  version: number;
};

export const INITIAL_GREETING =
  "Olá! Eu sou a Assistente Virtual da IGM. Posso ajudar com informações sobre cursos, agenda e atendimento da clínica.";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

const includesAny = (text: string, expressions: string[]) =>
  expressions.some(expression => text.includes(expression));

const riskExpressions = [
  "urgente",
  "urgencia",
  "emergencia",
  "sangramento",
  "hemorragia",
  "febre",
  "inchaco",
  "falta de ar",
  "dificuldade para respirar",
  "reacao aler",
  "desmaio",
];

const humanRequestExpressions = [
  "falar com a doutora",
  "falar com doutora",
  "falar com a dra",
  "falar com dra",
  "falar com a ilana",
  "falar com ilana",
  "quero a doutora",
  "quero falar com ela",
  "me passa a doutora",
  "me passe a doutora",
];

const minorExpressions = [
  "meu filho",
  "minha filha",
  "meu bebe",
  "minha bebe",
  "crianca",
  "menor de idade",
  "anos de idade",
  "meses de idade",
];

const clinicalExpressions = [
  "cirurgia",
  "frenectomia",
  "sedacao",
  "anestesia",
  "anestesista",
  "medicacao",
  "remedio",
  "pos operatorio",
  "pos-operat",
  "procedimento",
  "diagnostico",
  "avaliacao clinica",
  "dor de dente",
  "dor forte",
  "labioplastia",
  "freio lingual",
];

const financialExpressions = [
  "preco",
  "valor",
  "orcamento",
  "pagamento",
  "parcel",
  "desconto",
  "pix",
  "boleto",
  "nota fiscal",
  "recibo",
];

const clinicAdministrativeExpressions = [
  "agendar",
  "agenda",
  "horario",
  "endereco",
  "localizacao",
  "estacionamento",
  "consulta",
  "confirmar",
  "remarcar",
  "cancelar",
  "documento",
  "clinica",
];

export function classifyMessage(content: string): ConversationCategory {
  const text = normalize(content);

  if (includesAny(text, riskExpressions)) return "RISCO";
  if (includesAny(text, minorExpressions) || includesAny(text, clinicalExpressions)) {
    return "CLÍNICA CLÍNICA";
  }
  if (includesAny(text, financialExpressions)) return "FINANCEIRO";
  if (includesAny(text, clinicAdministrativeExpressions)) {
    return "CLÍNICA ADMINISTRATIVA";
  }
  return "CURSO";
}

export function detectHandoffReason(content: string): string | null {
  const text = normalize(content);

  if (includesAny(text, humanRequestExpressions)) {
    return "Pedido explícito para falar com a doutora";
  }
  if (includesAny(text, riskExpressions)) {
    return "Sinal de risco ou urgência";
  }
  if (includesAny(text, minorExpressions)) {
    return "Presença de dado relacionado a menor";
  }
  if (includesAny(text, clinicalExpressions)) {
    return "Decisão ou orientação clínica";
  }
  return null;
}

export function canAutomateResponse(input: {
  autoReplyBlocked: boolean;
  message: string;
}) {
  return !input.autoReplyBlocked && !detectHandoffReason(input.message);
}

function fallbackReply(category: ConversationCategory) {
  if (category === "FINANCEIRO") {
    return "Posso registrar sua dúvida financeira. A equipe confirmará as condições aprovadas para o seu caso.";
  }

  if (category === "CLÍNICA ADMINISTRATIVA") {
    return "Posso ajudar com informações administrativas da clínica, como agendamento, horários e localização. O que você precisa organizar?";
  }

  return "Posso ajudar com informações gerais sobre cursos e mentorias da IGM. Qual tema ou formato você deseja conhecer?";
}

export async function generateSafeReply(input: {
  content: string;
  category: ConversationCategory;
  knowledge: KnowledgeExcerpt[];
}) {
  const knowledgeContext = input.knowledge.length
    ? input.knowledge
        .map(article => `Título: ${article.title}\nVersão: ${article.version}\nConteúdo aprovado: ${article.content}`)
        .join("\n\n---\n\n")
    : "Não há artigo aprovado aplicável. Não invente informações.";

  try {
    const response = await invokeLLM({
      model: "gpt-5-mini",
      maxTokens: 240,
      messages: [
        {
          role: "system",
          content: [
            "Você redige mensagens curtas em português brasileiro para a Assistente Virtual da IGM.",
            "Use somente o conteúdo aprovado fornecido. Nunca invente preços, datas, horários, localização, procedimentos ou promessas.",
            "Nunca se apresente como dentista e nunca diga que a mensagem foi escrita pela doutora.",
            "Não ofereça diagnóstico, orientação clínica, indicação de cirurgia/sedação, orientação medicamentosa ou avaliação de urgência.",
            "Se a informação não estiver na base, faça uma pergunta simples ou diga que a equipe confirmará a informação.",
            "Responda em no máximo duas frases, sem Markdown e sem emojis.",
            `Categoria da conversa: ${input.category}.`,
            `Conteúdo aprovado:\n${knowledgeContext}`,
          ].join("\n"),
        },
        { role: "user", content: input.content },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (typeof content === "string" && content.trim().length > 0) {
      return content.trim().slice(0, 700);
    }
  } catch (error) {
    console.error("[Assistant] Safe reply fallback:", error);
  }

  return fallbackReply(input.category);
}
