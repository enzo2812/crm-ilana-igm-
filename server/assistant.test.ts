import { describe, expect, it } from "vitest";
import {
  canAutomateResponse,
  classifyMessage,
  detectHandoffReason,
  INITIAL_GREETING,
} from "./assistant";

describe("motor seguro da Assistente Virtual da IGM", () => {
  it("usa exatamente as cinco categorias solicitadas", () => {
    expect(classifyMessage("Quero saber sobre a próxima turma de laser")).toBe("CURSO");
    expect(classifyMessage("Qual é o horário disponível para agendar?")).toBe("CLÍNICA ADMINISTRATIVA");
    expect(classifyMessage("Meu filho precisa de sedação?")).toBe("CLÍNICA CLÍNICA");
    expect(classifyMessage("Quais são as opções de pagamento?")).toBe("FINANCEIRO");
    expect(classifyMessage("Meu filho está com sangramento e febre")).toBe("RISCO");
  });

  it("identifica a assistente na primeira mensagem", () => {
    expect(INITIAL_GREETING).toContain("Assistente Virtual da IGM");
  });

  it("aciona handoff e bloqueia totalmente a resposta automática", () => {
    expect(detectHandoffReason("Quero falar com a doutora agora")).toBe("Pedido explícito para falar com a doutora");
    expect(canAutomateResponse({ autoReplyBlocked: false, message: "Quero falar com a doutora agora" })).toBe(false);
    expect(canAutomateResponse({ autoReplyBlocked: true, message: "Pode me ajudar com cursos?" })).toBe(false);
  });
});
