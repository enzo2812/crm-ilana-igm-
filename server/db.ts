import { asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  auditLogs,
  contacts,
  conversations,
  followUpTasks,
  InsertUser,
  knowledgeArticles,
  messages,
  users,
} from "../drizzle/schema";
import {
  canAutomateResponse,
  classifyMessage,
  detectHandoffReason,
  generateSafeReply,
  INITIAL_GREETING,
  type ConversationCategory,
} from "./assistant";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });

  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.role = values.role;
  updateSet.lastSignedIn = values.lastSignedIn;

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listCrmConversations() {
  const db = await requireDb();
  const rows = await db
    .select({ conversation: conversations, contact: contacts })
    .from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .orderBy(desc(conversations.lastActivityAt));

  return rows.map(row => ({ ...row.conversation, contact: row.contact }));
}

export async function getConversationDetail(conversationId: number) {
  const db = await requireDb();
  const rows = await db
    .select({ conversation: conversations, contact: contacts })
    .from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .where(eq(conversations.id, conversationId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const [conversationMessages, conversationAudits, conversationTasks] = await Promise.all([
    db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(asc(messages.createdAt)),
    db.select().from(auditLogs).where(eq(auditLogs.conversationId, conversationId)).orderBy(desc(auditLogs.createdAt)),
    db.select().from(followUpTasks).where(eq(followUpTasks.conversationId, conversationId)).orderBy(desc(followUpTasks.createdAt)),
  ]);

  return {
    ...row.conversation,
    contact: row.contact,
    messages: conversationMessages,
    audits: conversationAudits,
    tasks: conversationTasks,
  };
}

export async function getDashboardData() {
  const db = await requireDb();
  const [conversationRows, taskRows, knowledgeRows] = await Promise.all([
    listCrmConversations(),
    db.select().from(followUpTasks).orderBy(asc(followUpTasks.dueAt), desc(followUpTasks.createdAt)),
    db.select().from(knowledgeArticles).orderBy(desc(knowledgeArticles.updatedAt)),
  ]);

  return {
    conversations: conversationRows,
    tasks: taskRows,
    knowledge: knowledgeRows,
    metrics: {
      totalConversations: conversationRows.length,
      handoffs: conversationRows.filter(item => item.status === "HANDOFF").length,
      courseLeads: conversationRows.filter(item => item.category === "CURSO").length,
      pendingTasks: taskRows.filter(item => item.status !== "CONCLUÍDA").length,
    },
  };
}

export async function createCrmConversation(input: {
  fullName: string;
  phone: string;
  funnel: "CURSOS" | "CLÍNICA";
  funnelStage?: string;
}) {
  const db = await requireDb();
  const now = new Date();
  const [contactResult] = await db.insert(contacts).values({
    fullName: input.fullName,
    phone: input.phone,
    funnel: input.funnel,
    funnelStage: input.funnelStage ?? "Novo contato",
    lastMessageAt: now,
  });
  const [conversationResult] = await db.insert(conversations).values({
    contactId: Number(contactResult.insertId),
    category: input.funnel === "CURSOS" ? "CURSO" : "CLÍNICA ADMINISTRATIVA",
    lastActivityAt: now,
  });
  return getConversationDetail(Number(conversationResult.insertId));
}

export async function listKnowledgeArticles() {
  const db = await requireDb();
  return db.select().from(knowledgeArticles).orderBy(desc(knowledgeArticles.updatedAt));
}

export async function saveKnowledgeArticle(input: {
  id?: number;
  scope: "CURSOS" | "CLÍNICA" | "GERAL";
  title: string;
  content: string;
  sourceLabel: string;
  isApproved: boolean;
  updatedBy: string;
}) {
  const db = await requireDb();
  if (input.id) {
    const current = await db.select().from(knowledgeArticles).where(eq(knowledgeArticles.id, input.id)).limit(1);
    const version = (current[0]?.version ?? 0) + 1;
    await db
      .update(knowledgeArticles)
      .set({ ...input, version })
      .where(eq(knowledgeArticles.id, input.id));
    return input.id;
  }

  const [result] = await db.insert(knowledgeArticles).values({ ...input, version: 1 });
  return Number(result.insertId);
}

export async function listFollowUpTasks() {
  const db = await requireDb();
  return db.select().from(followUpTasks).orderBy(asc(followUpTasks.dueAt), desc(followUpTasks.createdAt));
}

export async function updateFollowUpTask(input: {
  id: number;
  status: "PENDENTE" | "EM ANDAMENTO" | "CONCLUÍDA";
  owner?: string;
}) {
  const db = await requireDb();
  await db
    .update(followUpTasks)
    .set({ status: input.status, ...(input.owner ? { owner: input.owner } : {}) })
    .where(eq(followUpTasks.id, input.id));
}

async function writeAudit(input: {
  conversationId: number;
  messageId?: number;
  classification: ConversationCategory;
  action: "RESPOSTA" | "HANDOFF" | "BLOQUEIO";
  ruleTriggered: string;
  knowledgeOrigin?: string;
  knowledgeVersion?: number;
  responseExcerpt?: string;
}) {
  const db = await requireDb();
  await db.insert(auditLogs).values(input);
}

export async function processSimulatorMessage(input: { conversationId: number; content: string }) {
  const db = await requireDb();
  const detail = await getConversationDetail(input.conversationId);
  if (!detail) throw new Error("Conversa não encontrada");

  const category = classifyMessage(input.content);
  const now = new Date();
  const [incomingResult] = await db.insert(messages).values({
    conversationId: input.conversationId,
    direction: "ENTRADA",
    senderType: "CONTATO",
    content: input.content,
    isAutomated: false,
  });

  await db
    .update(conversations)
    .set({ category, lastActivityAt: now })
    .where(eq(conversations.id, input.conversationId));

  const handoffReason = detectHandoffReason(input.content);
  if (!canAutomateResponse({ autoReplyBlocked: detail.autoReplyBlocked, message: input.content })) {
    const alreadyBlocked = detail.autoReplyBlocked || detail.status === "HANDOFF";
    if (alreadyBlocked) {
      await writeAudit({
        conversationId: input.conversationId,
        messageId: Number(incomingResult.insertId),
        classification: category,
        action: "BLOQUEIO",
        ruleTriggered: "Conversa já está em handoff; resposta automática bloqueada",
      });
      return { category, handoff: true, blocked: true, firstGreeting: null, reply: null };
    }

    const reason = handoffReason ?? "Regra de proteção acionada";
    await db
      .update(conversations)
      .set({
        category,
        status: "HANDOFF",
        handoffReason: reason,
        autoReplyBlocked: true,
        lastActivityAt: now,
      })
      .where(eq(conversations.id, input.conversationId));
    await db.insert(followUpTasks).values({
      conversationId: input.conversationId,
      title: `Assumir atendimento: ${reason}`,
      status: "PENDENTE",
      owner: "Dra. Ilana / Equipe clínica",
    });
    await writeAudit({
      conversationId: input.conversationId,
      messageId: Number(incomingResult.insertId),
      classification: category,
      action: "HANDOFF",
      ruleTriggered: reason,
    });
    return { category, handoff: true, blocked: true, firstGreeting: null, reply: null };
  }

  let firstGreeting: string | null = null;
  if (!detail.firstMessageSent) {
    firstGreeting = INITIAL_GREETING;
    await db.insert(messages).values({
      conversationId: input.conversationId,
      direction: "SAÍDA",
      senderType: "ASSISTENTE",
      content: firstGreeting,
      isAutomated: true,
    });
  }

  const allKnowledge = await listKnowledgeArticles();
  const relevantKnowledge = allKnowledge
    .filter(article => article.isApproved)
    .filter(article => article.scope === "GERAL" || (category === "CURSO" ? article.scope === "CURSOS" : article.scope === "CLÍNICA"))
    .slice(0, 5);
  const reply = await generateSafeReply({ content: input.content, category, knowledge: relevantKnowledge });
  const [replyResult] = await db.insert(messages).values({
    conversationId: input.conversationId,
    direction: "SAÍDA",
    senderType: "ASSISTENTE",
    content: reply,
    isAutomated: true,
  });

  await db
    .update(conversations)
    .set({ firstMessageSent: true, lastActivityAt: new Date() })
    .where(eq(conversations.id, input.conversationId));
  await writeAudit({
    conversationId: input.conversationId,
    messageId: Number(replyResult.insertId),
    classification: category,
    action: "RESPOSTA",
    ruleTriggered: "Resposta permitida pelas regras do simulador",
    knowledgeOrigin: relevantKnowledge.map(article => article.title).join(" · ") || "Resposta segura do sistema",
    knowledgeVersion: relevantKnowledge[0]?.version,
    responseExcerpt: reply.slice(0, 500),
  });

  return { category, handoff: false, blocked: false, firstGreeting, reply };
}
