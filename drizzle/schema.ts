import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "user"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  fullName: varchar("fullName", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  funnel: mysqlEnum("funnel", ["CURSOS", "CLÍNICA"]).notNull().default("CURSOS"),
  funnelStage: varchar("funnelStage", { length: 80 }).notNull().default("Novo contato"),
  tags: text("tags"),
  lastMessageAt: timestamp("lastMessageAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  category: mysqlEnum("category", [
    "CURSO",
    "CLÍNICA ADMINISTRATIVA",
    "CLÍNICA CLÍNICA",
    "FINANCEIRO",
    "RISCO",
  ]).notNull().default("CURSO"),
  status: mysqlEnum("status", ["ATIVA", "HANDOFF"]).notNull().default("ATIVA"),
  handoffReason: text("handoffReason"),
  autoReplyBlocked: boolean("autoReplyBlocked").notNull().default(false),
  firstMessageSent: boolean("firstMessageSent").notNull().default(false),
  lastActivityAt: timestamp("lastActivityAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  direction: mysqlEnum("direction", ["ENTRADA", "SAÍDA"]).notNull(),
  senderType: mysqlEnum("senderType", ["CONTATO", "ASSISTENTE", "EQUIPE"]).notNull(),
  content: text("content").notNull(),
  isAutomated: boolean("isAutomated").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const knowledgeArticles = mysqlTable("knowledgeArticles", {
  id: int("id").autoincrement().primaryKey(),
  scope: mysqlEnum("scope", ["CURSOS", "CLÍNICA", "GERAL"]).notNull().default("GERAL"),
  title: varchar("title", { length: 180 }).notNull(),
  content: text("content").notNull(),
  sourceLabel: varchar("sourceLabel", { length: 180 }).notNull().default("Base aprovada pela equipe"),
  version: int("version").notNull().default(1),
  isApproved: boolean("isApproved").notNull().default(true),
  updatedBy: varchar("updatedBy", { length: 160 }).notNull().default("Equipe IGM"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const followUpTasks = mysqlTable("followUpTasks", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").references(() => conversations.id, { onDelete: "set null" }),
  title: varchar("title", { length: 220 }).notNull(),
  status: mysqlEnum("status", ["PENDENTE", "EM ANDAMENTO", "CONCLUÍDA"]).notNull().default("PENDENTE"),
  owner: varchar("owner", { length: 160 }).notNull().default("Equipe IGM"),
  dueAt: timestamp("dueAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  messageId: int("messageId").references(() => messages.id, { onDelete: "set null" }),
  classification: mysqlEnum("classification", [
    "CURSO",
    "CLÍNICA ADMINISTRATIVA",
    "CLÍNICA CLÍNICA",
    "FINANCEIRO",
    "RISCO",
  ]).notNull(),
  action: mysqlEnum("action", ["RESPOSTA", "HANDOFF", "BLOQUEIO"]).notNull(),
  ruleTriggered: varchar("ruleTriggered", { length: 220 }).notNull(),
  knowledgeOrigin: varchar("knowledgeOrigin", { length: 220 }),
  knowledgeVersion: int("knowledgeVersion"),
  responseExcerpt: text("responseExcerpt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type KnowledgeArticle = typeof knowledgeArticles.$inferSelect;
export type FollowUpTask = typeof followUpTasks.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
