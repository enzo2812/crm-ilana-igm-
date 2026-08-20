import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  FileText,
  Inbox,
  ListTodo,
  LockKeyhole,
  MessageCircleMore,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

const CATEGORY_STYLES: Record<string, string> = {
  CURSO: "bg-[#e6eef8] text-[#31577d] border-[#cfdced]",
  "CLÍNICA ADMINISTRATIVA": "bg-[#e6f3ee] text-[#2d6b56] border-[#cde8dd]",
  "CLÍNICA CLÍNICA": "bg-[#f7eadf] text-[#96553d] border-[#efd5c2]",
  FINANCEIRO: "bg-[#f4edf9] text-[#795393] border-[#e4d5ef]",
  RISCO: "bg-[#fae5e4] text-[#a23b36] border-[#f0c6c3]",
};

type Section = "overview" | "conversations" | "simulator" | "knowledge" | "tasks" | "audit";

const sectionInfo: Record<Section, { eyebrow: string; title: string; description: string }> = {
  overview: {
    eyebrow: "Central de atendimento",
    title: "Uma conversa segura, em cada etapa.",
    description: "Acompanhe cursos e clínica com contexto, regras de proteção e uma trilha clara de decisão.",
  },
  conversations: {
    eyebrow: "CRM de conversas",
    title: "Contexto antes de responder.",
    description: "Cada contato permanece ligado ao funil, às tarefas, ao histórico e ao estado de handoff.",
  },
  simulator: {
    eyebrow: "Ambiente de validação",
    title: "Teste o atendimento antes de conectar o número.",
    description: "Envie mensagens simuladas e veja a classificação, a apresentação inicial e o bloqueio de segurança em ação.",
  },
  knowledge: {
    eyebrow: "Conteúdo aprovado",
    title: "A fonte de cada resposta importa.",
    description: "Edite informações de cursos e clínica diretamente no painel. Somente artigos aprovados podem orientar a assistente.",
  },
  tasks: {
    eyebrow: "Ritmo da equipe",
    title: "Nenhum follow-up fica sem responsável.",
    description: "Acompanhe transferências, retornos e pendências com status claro e visibilidade para a equipe.",
  },
  audit: {
    eyebrow: "Rastreabilidade",
    title: "Auditoria de cada ação da IA.",
    description: "Revise a classificação, a regra acionada e a versão do conteúdo usada em cada resposta gerada.",
  },
};

function categoryBadge(category: string) {
  return (
    <span className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.08em] ${CATEGORY_STYLES[category] ?? "bg-muted text-muted-foreground"}`}>
      {category}
    </span>
  );
}

function formatDate(value?: Date | string | null) {
  if (!value) return "Sem prazo";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function getSection(path: string): Section {
  if (path.startsWith("/conversas")) return "conversations";
  if (path.startsWith("/simulador")) return "simulator";
  if (path.startsWith("/conhecimento")) return "knowledge";
  if (path.startsWith("/tarefas")) return "tasks";
  if (path.startsWith("/auditoria")) return "audit";
  return "overview";
}

export default function Home() {
  const [location, setLocation] = useLocation();
  const section = getSection(location);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [incomingMessage, setIncomingMessage] = useState("");
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [newConversation, setNewConversation] = useState({ fullName: "", phone: "", funnel: "CURSOS" as "CURSOS" | "CLÍNICA" });
  const [articleDraft, setArticleDraft] = useState({
    id: undefined as number | undefined,
    scope: "CURSOS" as "CURSOS" | "CLÍNICA" | "GERAL",
    title: "",
    content: "",
    sourceLabel: "Base aprovada pela equipe",
    isApproved: true,
    updatedBy: "Equipe IGM",
  });

  const utils = trpc.useUtils();
  const dashboardQuery = trpc.crm.dashboard.useQuery();
  const taskQuery = trpc.crm.taskList.useQuery();
  const knowledgeQuery = trpc.crm.knowledgeList.useQuery();
  const selectedConversationQuery = trpc.crm.conversationDetail.useQuery(
    { conversationId: selectedConversationId ?? 0 },
    { enabled: selectedConversationId !== null },
  );

  const refreshWorkspace = async () => {
    await Promise.all([
      utils.crm.dashboard.invalidate(),
      utils.crm.conversationList.invalidate(),
      utils.crm.taskList.invalidate(),
      utils.crm.knowledgeList.invalidate(),
      selectedConversationId ? utils.crm.conversationDetail.invalidate({ conversationId: selectedConversationId }) : Promise.resolve(),
    ]);
  };

  const createConversation = trpc.crm.createConversation.useMutation({
    onSuccess: async detail => {
      if (detail) setSelectedConversationId(detail.id);
      setNewConversationOpen(false);
      setNewConversation({ fullName: "", phone: "", funnel: "CURSOS" });
      await refreshWorkspace();
      toast.success("Conversa criada no CRM.");
    },
    onError: error => toast.error(error.message),
  });

  const simulateIncoming = trpc.crm.simulateIncoming.useMutation({
    onSuccess: async result => {
      setIncomingMessage("");
      await refreshWorkspace();
      if (result.handoff) {
        toast.warning("Handoff acionado. A resposta automática foi bloqueada.");
      } else {
        toast.success(`Classificação: ${result.category}`);
      }
    },
    onError: error => toast.error(error.message),
  });

  const saveKnowledge = trpc.crm.saveKnowledge.useMutation({
    onSuccess: async () => {
      setArticleDraft({ id: undefined, scope: "CURSOS", title: "", content: "", sourceLabel: "Base aprovada pela equipe", isApproved: true, updatedBy: "Equipe IGM" });
      await refreshWorkspace();
      toast.success("Artigo salvo e versionado.");
    },
    onError: error => toast.error(error.message),
  });

  const updateTask = trpc.crm.updateTask.useMutation({
    onSuccess: async () => {
      await refreshWorkspace();
      toast.success("Tarefa atualizada.");
    },
    onError: error => toast.error(error.message),
  });

  const conversations = dashboardQuery.data?.conversations ?? [];
  const selectedConversation = selectedConversationQuery.data;
  const metrics = dashboardQuery.data?.metrics;

  useEffect(() => {
    if (!selectedConversationId && conversations[0]) setSelectedConversationId(conversations[0].id);
  }, [conversations, selectedConversationId]);

  const selectedArticle = useMemo(
    () => knowledgeQuery.data?.find(article => article.id === articleDraft.id),
    [knowledgeQuery.data, articleDraft.id],
  );

  useEffect(() => {
    if (selectedArticle && selectedArticle.id === articleDraft.id) {
      setArticleDraft({
        id: selectedArticle.id,
        scope: selectedArticle.scope,
        title: selectedArticle.title,
        content: selectedArticle.content,
        sourceLabel: selectedArticle.sourceLabel,
        isApproved: selectedArticle.isApproved,
        updatedBy: selectedArticle.updatedBy,
      });
    }
  }, [selectedArticle, articleDraft.id]);

  if (dashboardQuery.isLoading) {
    return <div className="grid min-h-[70vh] place-items-center"><div className="flex items-center gap-3 text-sm text-muted-foreground"><Sparkles className="size-4 animate-pulse text-primary" /> Preparando a central IGM…</div></div>;
  }

  if (dashboardQuery.error) {
    return (
      <div className="mx-auto grid min-h-[70vh] max-w-xl place-items-center text-center">
        <div className="rounded-[2rem] border border-border bg-card p-10 shadow-[0_24px_80px_-42px_rgba(17,37,65,0.42)]">
          <ShieldCheck className="mx-auto mb-5 size-10 text-primary" />
          <h1 className="font-serif text-3xl text-foreground">Acesso protegido</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Entre pelo painel para abrir as conversas, a base de conhecimento e os registros de auditoria da clínica.</p>
        </div>
      </div>
    );
  }

  const handleCreateConversation = () => {
    if (!newConversation.fullName.trim() || !newConversation.phone.trim()) {
      toast.error("Informe nome e telefone para iniciar a conversa.");
      return;
    }
    createConversation.mutate(newConversation);
  };

  const handleSimulate = () => {
    if (!selectedConversationId || !incomingMessage.trim()) return;
    if (selectedConversation?.autoReplyBlocked) {
      toast.warning("Esta conversa está em handoff. Nenhuma resposta automática pode ser enviada.");
      return;
    }
    simulateIncoming.mutate({ conversationId: selectedConversationId, content: incomingMessage.trim() });
  };

  return (
    <div className="mx-auto max-w-[1580px] space-y-7 pb-8">
      <header className="flex flex-col gap-5 rounded-[2rem] border border-white/70 bg-card/80 px-6 py-7 shadow-[0_18px_65px_-38px_rgba(24,44,67,0.35)] backdrop-blur-sm md:flex-row md:items-end md:justify-between md:px-8">
        <div className="max-w-2xl">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#638272]"><span className="size-2 rounded-full bg-[#6daa91]" />{sectionInfo[section].eyebrow}</div>
          <h1 className="font-serif text-3xl leading-tight tracking-[-0.03em] text-foreground md:text-4xl">{sectionInfo[section].title}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{sectionInfo[section].description}</p>
        </div>
        <Dialog open={newConversationOpen} onOpenChange={setNewConversationOpen}>
          <DialogTrigger asChild><Button className="h-11 rounded-xl px-5 shadow-lg shadow-primary/15"><Plus className="mr-2 size-4" />Nova conversa</Button></DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="font-serif text-2xl">Iniciar conversa de teste</DialogTitle><DialogDescription>Este contato é criado apenas no CRM do piloto. Nenhuma mensagem é enviada ao WhatsApp real.</DialogDescription></DialogHeader>
            <div className="space-y-4 py-2">
              <Input placeholder="Nome do contato" value={newConversation.fullName} onChange={event => setNewConversation(current => ({ ...current, fullName: event.target.value }))} />
              <Input placeholder="Telefone" value={newConversation.phone} onChange={event => setNewConversation(current => ({ ...current, phone: event.target.value }))} />
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={newConversation.funnel} onChange={event => setNewConversation(current => ({ ...current, funnel: event.target.value as "CURSOS" | "CLÍNICA" }))}>
                <option value="CURSOS">Funil de cursos</option>
                <option value="CLÍNICA">Funil da clínica</option>
              </select>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setNewConversationOpen(false)}>Cancelar</Button><Button onClick={handleCreateConversation} disabled={createConversation.isPending}>{createConversation.isPending ? "Criando…" : "Criar conversa"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {section === "overview" && (
        <div className="space-y-7">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Conversas ativas" value={metrics?.totalConversations ?? 0} icon={<MessageCircleMore className="size-5" />} tone="blue" detail="Cursos e clínica" />
            <MetricCard label="Handoffs protegidos" value={metrics?.handoffs ?? 0} icon={<LockKeyhole className="size-5" />} tone="rose" detail="Sem resposta automática" />
            <MetricCard label="Leads de curso" value={metrics?.courseLeads ?? 0} icon={<Sparkles className="size-5" />} tone="amber" detail="Classificação CURSO" />
            <MetricCard label="Follow-ups pendentes" value={metrics?.pendingTasks ?? 0} icon={<ListTodo className="size-5" />} tone="green" detail="Com responsável definido" />
          </section>
          <section className="grid gap-5 xl:grid-cols-[1.45fr_0.8fr]">
            <div className="rounded-[1.65rem] border bg-card p-6 shadow-[0_18px_45px_-38px_rgba(24,44,67,0.28)]">
              <div className="mb-5 flex items-center justify-between"><div><p className="text-sm font-bold text-foreground">Conversas recentes</p><p className="mt-1 text-xs text-muted-foreground">Priorize contexto, etapa e proteção.</p></div><Button variant="ghost" className="text-primary" onClick={() => setLocation("/conversas")}>Ver CRM <ArrowUpRight className="ml-1 size-4" /></Button></div>
              <ConversationList conversations={conversations.slice(0, 5)} selectedId={selectedConversationId} onSelect={id => { setSelectedConversationId(id); setLocation("/conversas"); }} />
            </div>
            <div className="rounded-[1.65rem] border border-[#cae2d5] bg-[#edf7f1] p-6">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-white text-[#3d785e] shadow-sm"><ShieldCheck className="size-5" /></div>
              <h2 className="mt-5 font-serif text-2xl tracking-[-0.02em] text-[#274f40]">A segurança vem antes da resposta.</h2>
              <p className="mt-3 text-sm leading-6 text-[#517567]">Pedido pela doutora, dado de menor, decisão clínica ou urgência levam a conversa imediatamente para handoff. A automação é bloqueada por completo.</p>
              <div className="mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#47745f]"><CheckCircle2 className="size-4" /> Regra ativa no simulador</div>
            </div>
          </section>
        </div>
      )}

      {(section === "conversations" || section === "simulator") && (
        <section className="grid min-h-[620px] gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-[1.65rem] border bg-card shadow-[0_18px_45px_-38px_rgba(24,44,67,0.28)]">
            <div className="border-b px-5 py-5"><div className="flex items-center justify-between"><p className="text-sm font-bold">Caixa de entrada</p><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">{conversations.length}</span></div><p className="mt-1 text-xs text-muted-foreground">Selecionar uma conversa atualiza o contexto.</p></div>
            <div className="max-h-[550px] overflow-auto p-2"><ConversationList conversations={conversations} selectedId={selectedConversationId} onSelect={setSelectedConversationId} /></div>
          </aside>
          <div className="overflow-hidden rounded-[1.65rem] border bg-card shadow-[0_18px_45px_-38px_rgba(24,44,67,0.28)]">
            {!selectedConversation ? <EmptyConversation onCreate={() => setNewConversationOpen(true)} /> : section === "simulator" ? <SimulatorPanel detail={selectedConversation} incomingMessage={incomingMessage} setIncomingMessage={setIncomingMessage} onSimulate={handleSimulate} isPending={simulateIncoming.isPending} /> : <ConversationPanel detail={selectedConversation} />}
          </div>
        </section>
      )}

      {section === "knowledge" && (
        <section className="grid gap-5 xl:grid-cols-[0.85fr_1.25fr]">
          <aside className="rounded-[1.65rem] border bg-card p-4 shadow-[0_18px_45px_-38px_rgba(24,44,67,0.28)]">
            <div className="mb-4 flex items-center justify-between px-2"><div><p className="text-sm font-bold">Artigos versionados</p><p className="mt-1 text-xs text-muted-foreground">Somente conteúdo aprovado alimenta a IA.</p></div><Button size="sm" variant="outline" onClick={() => setArticleDraft({ id: undefined, scope: "CURSOS", title: "", content: "", sourceLabel: "Base aprovada pela equipe", isApproved: true, updatedBy: "Equipe IGM" })}><Plus className="mr-1 size-3.5" />Novo</Button></div>
            <div className="space-y-2"><KnowledgeList articles={knowledgeQuery.data ?? []} selectedId={articleDraft.id} onSelect={id => setArticleDraft(current => ({ ...current, id }))} /></div>
          </aside>
          <div className="rounded-[1.65rem] border bg-card p-6 shadow-[0_18px_45px_-38px_rgba(24,44,67,0.28)]">
            <div className="mb-6 flex items-start justify-between gap-4"><div><p className="text-sm font-bold">Editor de conteúdo</p><p className="mt-1 text-xs text-muted-foreground">Ao salvar uma edição, a versão do artigo é incrementada para auditoria.</p></div><span className={`rounded-full border px-3 py-1 text-[10px] font-bold tracking-[0.11em] ${articleDraft.isApproved ? "border-[#cce6d8] bg-[#edf8f2] text-[#377057]" : "border-[#efd2c1] bg-[#fcf2ea] text-[#a25e3d]"}`}>{articleDraft.isApproved ? "APROVADO" : "RASCUNHO"}</span></div>
            <div className="grid gap-4 md:grid-cols-2"><Field label="Escopo"><select className="field-input" value={articleDraft.scope} onChange={event => setArticleDraft(current => ({ ...current, scope: event.target.value as "CURSOS" | "CLÍNICA" | "GERAL" }))}><option value="CURSOS">CURSOS</option><option value="CLÍNICA">CLÍNICA</option><option value="GERAL">GERAL</option></select></Field><Field label="Fonte exibida no log"><Input value={articleDraft.sourceLabel} onChange={event => setArticleDraft(current => ({ ...current, sourceLabel: event.target.value }))} /></Field></div>
            <div className="mt-4"><Field label="Título"><Input placeholder="Ex.: Informações sobre mentoria em laser" value={articleDraft.title} onChange={event => setArticleDraft(current => ({ ...current, title: event.target.value }))} /></Field></div>
            <div className="mt-4"><Field label="Conteúdo aprovado"><Textarea className="min-h-64 resize-y leading-6" placeholder="Inclua somente informações revisadas pela equipe: público, preço, horários, localização, materiais e condições aprovadas." value={articleDraft.content} onChange={event => setArticleDraft(current => ({ ...current, content: event.target.value }))} /></Field></div>
            <div className="mt-5 flex flex-col justify-between gap-4 border-t pt-5 sm:flex-row sm:items-center"><label className="flex cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={articleDraft.isApproved} onChange={event => setArticleDraft(current => ({ ...current, isApproved: event.target.checked }))} className="size-4 accent-[#35665b]" />Disponibilizar para a assistente</label><Button onClick={() => saveKnowledge.mutate(articleDraft)} disabled={saveKnowledge.isPending || articleDraft.title.trim().length < 3 || articleDraft.content.trim().length < 10}>{saveKnowledge.isPending ? "Salvando…" : "Salvar conteúdo"}</Button></div>
          </div>
        </section>
      )}

      {section === "tasks" && <TasksPanel tasks={taskQuery.data ?? []} onStatusChange={(id, status) => updateTask.mutate({ id, status })} updating={updateTask.isPending} />}
      {section === "audit" && <AuditPanel detail={selectedConversation} conversations={conversations} onSelect={setSelectedConversationId} />}
    </div>
  );
}

function MetricCard({ label, value, icon, tone, detail }: { label: string; value: number; icon: React.ReactNode; tone: "blue" | "rose" | "amber" | "green"; detail: string }) {
  const tones = { blue: "bg-[#edf3fa] text-[#416b92]", rose: "bg-[#faedec] text-[#a55d56]", amber: "bg-[#fbf2e8] text-[#a57543]", green: "bg-[#eaf5ef] text-[#4b8068]" };
  return <div className="rounded-[1.45rem] border border-white/80 bg-card p-5 shadow-[0_15px_35px_-31px_rgba(24,44,67,0.35)]"><div className={`flex size-10 items-center justify-center rounded-2xl ${tones[tone]}`}>{icon}</div><p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-1 font-serif text-3xl tracking-[-0.03em] text-foreground">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>;
}

function ConversationList({ conversations, selectedId, onSelect }: { conversations: Array<any>; selectedId: number | null; onSelect: (id: number) => void }) {
  if (!conversations.length) return <div className="p-7 text-center text-sm text-muted-foreground">Nenhuma conversa no piloto. Crie uma nova para testar os fluxos.</div>;
  return <div className="space-y-1.5">{conversations.map(item => <button key={item.id} onClick={() => onSelect(item.id)} className={`w-full rounded-2xl border p-3 text-left transition-all ${selectedId === item.id ? "border-[#c8ddea] bg-[#eff5fa] shadow-sm" : "border-transparent hover:border-border hover:bg-muted/60"}`}><div className="flex items-start justify-between gap-2"><p className="truncate text-sm font-bold text-foreground">{item.contact.fullName}</p><span className={`mt-1 size-2 shrink-0 rounded-full ${item.status === "HANDOFF" ? "bg-[#be5a50]" : "bg-[#68a184]"}`} /></div><p className="mt-1 truncate text-xs text-muted-foreground">{item.contact.funnelStage}</p><div className="mt-2.5 flex items-center justify-between gap-2">{categoryBadge(item.category)}<span className="text-[10px] text-muted-foreground">{formatDate(item.lastActivityAt)}</span></div></button>)}</div>;
}

function EmptyConversation({ onCreate }: { onCreate: () => void }) {
  return <div className="grid min-h-[600px] place-items-center p-10 text-center"><div className="max-w-md"><div className="mx-auto grid size-16 place-items-center rounded-[1.5rem] bg-[#eef5f2] text-[#54806d]"><Inbox className="size-7" /></div><h2 className="mt-6 font-serif text-3xl tracking-[-0.03em]">Comece por uma conversa.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">O simulador nasce sem dados de pacientes. Crie um contato de teste para experimentar a classificação e as regras de proteção.</p><div className="mt-6 grid grid-cols-3 gap-2 text-left"><FlowStep index="01" label="Classifica" /><FlowStep index="02" label="Protege" /><FlowStep index="03" label="Registra" /></div><Button className="mt-6" onClick={onCreate}><Plus className="mr-2 size-4" />Criar conversa de teste</Button></div></div>;
}

function FlowStep({ index, label }: { index: string; label: string }) { return <div className="rounded-xl border bg-[#fcfbf9] p-3"><p className="text-[9px] font-bold tracking-[0.13em] text-[#6a8c7c]">{index}</p><p className="mt-1 text-xs font-bold text-foreground">{label}</p></div>; }

function ConversationPanel({ detail }: { detail: any }) { return <div className="flex min-h-[620px] flex-col"><ConversationHeader detail={detail} /><div className="flex-1 space-y-5 overflow-auto bg-[#fbfaf7] p-6"><SafetyBanner detail={detail} />{detail.messages.map((message: any) => <MessageBubble key={message.id} message={message} />)}</div><div className="border-t bg-card px-6 py-4 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Visão do CRM.</span> Para enviar mensagens reais, a integração oficial com WhatsApp Business deve ser configurada em etapa posterior.</div></div>; }

function SimulatorPanel({ detail, incomingMessage, setIncomingMessage, onSimulate, isPending }: { detail: any; incomingMessage: string; setIncomingMessage: (value: string) => void; onSimulate: () => void; isPending: boolean }) {
  const blocked = detail.autoReplyBlocked || detail.status === "HANDOFF";
  return <div className="flex min-h-[620px] flex-col"><ConversationHeader detail={detail} /><div className="flex-1 space-y-5 overflow-auto bg-[#f4f1ea] p-6"><div className="rounded-2xl border border-[#d8e7de] bg-[#f2faf5] p-4 text-sm leading-6 text-[#386553]"><div className="mb-1 flex items-center gap-2 font-bold"><Bot className="size-4" />Simulador seguro</div>Envie uma mensagem como se fosse o contato. Na primeira interação, a assistente se identifica exatamente como <strong>“Assistente Virtual da IGM”</strong>. Handoff bloqueia qualquer envio automático futuro.</div><SafetyBanner detail={detail} />{detail.messages.map((message: any) => <MessageBubble key={message.id} message={message} />)}</div><div className="border-t bg-card p-5"><div className="flex items-end gap-3"><Textarea value={incomingMessage} onChange={event => setIncomingMessage(event.target.value)} disabled={blocked || isPending} placeholder={blocked ? "Resposta automática bloqueada após handoff." : "Digite uma mensagem para testar o fluxo…"} className="min-h-12 max-h-32 resize-none" onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSimulate(); } }} /><Button className="h-11 shrink-0 rounded-xl" disabled={blocked || !incomingMessage.trim() || isPending} onClick={onSimulate}>{isPending ? <Sparkles className="size-4 animate-pulse" /> : <Send className="size-4" />}</Button></div>{blocked ? <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#a54e47]"><LockKeyhole className="size-3.5" />Bloqueio total ativo: somente uma pessoa da equipe pode assumir o atendimento.</p> : <p className="mt-3 text-xs text-muted-foreground">Enter envia no simulador. Shift + Enter cria nova linha.</p>}</div></div>; }

function ConversationHeader({ detail }: { detail: any }) { return <div className="flex items-start justify-between gap-4 border-b px-6 py-5"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-[#e8f0f8] text-[#466f92]"><UserRound className="size-5" /></div><div><h2 className="font-serif text-xl tracking-[-0.02em] text-foreground">{detail.contact.fullName}</h2><p className="mt-0.5 text-xs text-muted-foreground">{detail.contact.phone} · {detail.contact.funnel}</p></div></div><div className="flex flex-col items-end gap-2">{categoryBadge(detail.category)}<span className={`text-[10px] font-bold uppercase tracking-[0.1em] ${detail.status === "HANDOFF" ? "text-[#ae554d]" : "text-[#5b846e]"}`}>{detail.status === "HANDOFF" ? "Em handoff" : "Automação permitida"}</span></div></div>; }

function SafetyBanner({ detail }: { detail: any }) { if (detail.status !== "HANDOFF") return null; return <div className="rounded-2xl border border-[#efc5c1] bg-[#fff0ef] p-4 text-sm text-[#994943]"><div className="flex items-center gap-2 font-bold"><AlertTriangle className="size-4" />Handoff ativo — resposta automática bloqueada</div><p className="mt-1 leading-6">Motivo registrado: {detail.handoffReason}. A conversa exige atendimento humano da doutora ou equipe.</p></div>; }

function MessageBubble({ message }: { message: any }) { const outgoing = message.direction === "SAÍDA"; return <div className={`flex ${outgoing ? "justify-end" : "justify-start"}`}><div className={`max-w-[83%] rounded-[1.3rem] px-4 py-3 text-sm leading-6 shadow-sm ${outgoing ? "rounded-br-md bg-[#335b79] text-white" : "rounded-bl-md border bg-white text-foreground"}`}><div className={`mb-1 text-[10px] font-bold uppercase tracking-[0.12em] ${outgoing ? "text-white/70" : "text-muted-foreground"}`}>{message.senderType === "ASSISTENTE" ? "Assistente Virtual da IGM" : message.senderType === "EQUIPE" ? "Equipe IGM" : "Contato"}</div><p className="whitespace-pre-wrap">{message.content}</p><div className={`mt-2 text-[10px] ${outgoing ? "text-white/60" : "text-muted-foreground"}`}>{formatDate(message.createdAt)} {message.isAutomated ? "· Automática" : ""}</div></div></div>; }

function KnowledgeList({ articles, selectedId, onSelect }: { articles: Array<any>; selectedId?: number; onSelect: (id: number) => void }) { if (!articles.length) return <div className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">Nenhum artigo criado. Comece pela informação mais recorrente do atendimento.</div>; return <>{articles.map(article => <button key={article.id} onClick={() => onSelect(article.id)} className={`w-full rounded-2xl border p-4 text-left transition-colors ${selectedId === article.id ? "border-[#c8ddea] bg-[#eff5fa]" : "border-transparent hover:border-border hover:bg-muted/70"}`}><div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-sm font-bold leading-5">{article.title}</p><span className={`mt-0.5 size-2 rounded-full ${article.isApproved ? "bg-[#62a082]" : "bg-[#d49b59]"}`} /></div><p className="mt-2 text-[10px] font-bold tracking-[0.1em] text-muted-foreground">{article.scope} · V{article.version}</p><p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{article.content}</p></button>)}</>; }

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</span>{children}</label>; }

function TasksPanel({ tasks, onStatusChange, updating }: { tasks: Array<any>; onStatusChange: (id: number, status: "PENDENTE" | "EM ANDAMENTO" | "CONCLUÍDA") => void; updating: boolean }) { return <section className="overflow-hidden rounded-[1.65rem] border bg-card shadow-[0_18px_45px_-38px_rgba(24,44,67,0.28)]"><div className="flex flex-col gap-2 border-b px-6 py-5 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-bold">Fila de follow-ups</p><p className="mt-1 text-xs text-muted-foreground">Tarefas criadas por handoff ou organização da equipe.</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">{tasks.filter(task => task.status !== "CONCLUÍDA").length} pendentes</span></div>{tasks.length ? <div className="overflow-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-[#fbfaf7] text-[10px] font-bold uppercase tracking-[0.11em] text-muted-foreground"><tr><th className="px-6 py-4">Tarefa</th><th className="px-4 py-4">Responsável</th><th className="px-4 py-4">Prazo</th><th className="px-6 py-4 text-right">Status</th></tr></thead><tbody>{tasks.map(task => <tr key={task.id} className="border-t"><td className="px-6 py-4 text-sm font-semibold text-foreground">{task.title}</td><td className="px-4 py-4 text-sm text-muted-foreground">{task.owner}</td><td className="px-4 py-4 text-sm text-muted-foreground">{formatDate(task.dueAt)}</td><td className="px-6 py-4 text-right"><select disabled={updating} value={task.status} onChange={event => onStatusChange(task.id, event.target.value as "PENDENTE" | "EM ANDAMENTO" | "CONCLUÍDA")} className="rounded-lg border bg-background px-2.5 py-2 text-xs font-semibold"><option>PENDENTE</option><option>EM ANDAMENTO</option><option>CONCLUÍDA</option></select></td></tr>)}</tbody></table></div> : <div className="grid min-h-64 place-items-center p-8 text-center"><div><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#edf5f0] text-[#57806d]"><Check className="size-5" /></div><p className="mt-4 text-sm font-bold">A fila está organizada.</p><p className="mt-1 text-sm text-muted-foreground">Os handoffs criados no simulador aparecerão aqui com responsável e status.</p></div></div>}</section>; }

function AuditPanel({ detail, conversations, onSelect }: { detail: any; conversations: Array<any>; onSelect: (id: number) => void }) { return <section className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]"><aside className="rounded-[1.65rem] border bg-card p-4 shadow-[0_18px_45px_-38px_rgba(24,44,67,0.28)]"><div className="px-2 pb-4"><p className="text-sm font-bold">Escolha uma conversa</p><p className="mt-1 text-xs text-muted-foreground">Cada resposta e regra fica registrada por conversa.</p></div><ConversationList conversations={conversations} selectedId={detail?.id ?? null} onSelect={onSelect} /></aside><div className="rounded-[1.65rem] border bg-card p-6 shadow-[0_18px_45px_-38px_rgba(24,44,67,0.28)]">{!detail ? <div className="grid min-h-72 place-items-center text-center text-sm text-muted-foreground">Selecione uma conversa para abrir o histórico de auditoria.</div> : <><div className="mb-6 flex items-start justify-between gap-4"><div><p className="text-sm font-bold">Registro de auditoria</p><p className="mt-1 text-xs text-muted-foreground">{detail.contact.fullName} · {detail.audits.length} evento(s) registrados</p></div><ShieldCheck className="size-5 text-[#5d8b75]" /></div><div className="space-y-3">{detail.audits.length ? detail.audits.map((audit: any) => <div key={audit.id} className="rounded-2xl border bg-[#fcfbf9] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2">{categoryBadge(audit.classification)}<span className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.1em] ${audit.action === "HANDOFF" || audit.action === "BLOQUEIO" ? "bg-[#fae7e5] text-[#a24a43]" : "bg-[#e9f4ee] text-[#43785f]"}`}>{audit.action}</span></div><span className="text-[11px] text-muted-foreground">{formatDate(audit.createdAt)}</span></div><p className="mt-3 text-sm font-semibold text-foreground">{audit.ruleTriggered}</p>{audit.knowledgeOrigin && <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><BookOpen className="size-3.5" />{audit.knowledgeOrigin}{audit.knowledgeVersion ? ` · versão ${audit.knowledgeVersion}` : ""}</p>}{audit.responseExcerpt && <p className="mt-3 border-l-2 border-[#cfe0ed] pl-3 text-sm leading-6 text-muted-foreground">{audit.responseExcerpt}</p>}</div>) : <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Envie uma mensagem pelo simulador para criar os primeiros registros.</div>}</div></>}</div></section>; }
