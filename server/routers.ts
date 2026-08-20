import { z } from "zod";
import { CATEGORY_VALUES } from "./assistant";
import * as db from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const funnelSchema = z.enum(["CURSOS", "CLÍNICA"]);
const taskStatusSchema = z.enum(["PENDENTE", "EM ANDAMENTO", "CONCLUÍDA"]);
const knowledgeScopeSchema = z.enum(["CURSOS", "CLÍNICA", "GERAL"]);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  crm: router({
    dashboard: protectedProcedure.query(() => db.getDashboardData()),
    conversationList: protectedProcedure.query(() => db.listCrmConversations()),
    conversationDetail: protectedProcedure
      .input(z.object({ conversationId: z.number().int().positive() }))
      .query(({ input }) => db.getConversationDetail(input.conversationId)),
    createConversation: protectedProcedure
      .input(z.object({
        fullName: z.string().min(2).max(160),
        phone: z.string().min(6).max(32),
        funnel: funnelSchema,
        funnelStage: z.string().max(80).optional(),
      }))
      .mutation(({ input }) => db.createCrmConversation(input)),
    simulateIncoming: protectedProcedure
      .input(z.object({ conversationId: z.number().int().positive(), content: z.string().min(1).max(4000) }))
      .mutation(({ input }) => db.processSimulatorMessage(input)),
    knowledgeList: protectedProcedure.query(() => db.listKnowledgeArticles()),
    saveKnowledge: protectedProcedure
      .input(z.object({
        id: z.number().int().positive().optional(),
        scope: knowledgeScopeSchema,
        title: z.string().min(3).max(180),
        content: z.string().min(10).max(12000),
        sourceLabel: z.string().min(3).max(180),
        isApproved: z.boolean(),
        updatedBy: z.string().min(2).max(160),
      }))
      .mutation(({ input }) => db.saveKnowledgeArticle(input)),
    taskList: protectedProcedure.query(() => db.listFollowUpTasks()),
    updateTask: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), status: taskStatusSchema, owner: z.string().min(2).max(160).optional() }))
      .mutation(({ input }) => db.updateFollowUpTask(input)),
    categories: protectedProcedure.query(() => CATEGORY_VALUES),
  }),
});

export type AppRouter = typeof appRouter;
