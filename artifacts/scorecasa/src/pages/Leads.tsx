import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetLeads,
  useCreateLead,
  useDeleteLead,
  useGetBrokers,
  getGetLeadsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Trash2, ChevronRight, Filter, Users, CheckCircle2, TrendingUp, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: "Pendente",     color: "#92400E", bg: "#FEF3C7" },
  analyzing:   { label: "Em Análise",  color: "#1E40AF", bg: "#DBEAFE" },
  approved:    { label: "Aprovado",    color: "#065F46", bg: "#D1FAE5" },
  rejected:    { label: "Reprovado",   color: "#991B1B", bg: "#FEE2E2" },
  in_progress: { label: "Em Andamento",color: "#7C3AED", bg: "#EDE9FE" },
};

// ─── Masking helpers ────────────────────────────────────────────────────────

function maskCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function maskBRL(v: string): string {
  const digits = v.replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseBRL(v: string): number {
  return parseFloat(v.replace(/\D/g, "")) / 100 || 0;
}

function formatCPF(cpf: string) {
  const d = cpf.replace(/\D/g, "");
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "#374151", bg: "#F3F4F6" };
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ color: cfg.color, background: cfg.bg }}>
      {cfg.label}
    </span>
  );
}

function ScoreBar({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">{label}</span>
        <span className="font-bold" style={{ color }}>{value}/{max}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── Lead creation form with masked inputs ───────────────────────────────────

type LeadCreated = {
  id: number;
  name: string;
  approvalChance: number;
  scoreCaixa: number;
  scoreMCMV: number;
  aiRecommendation?: string | null;
};

interface CreateLeadFormProps {
  brokers: Array<{ id: number; name: string }>;
  onCreated: (lead: LeadCreated) => void;
  onCancel: () => void;
}

function CreateLeadForm({ brokers, onCreated, onCancel }: CreateLeadFormProps) {
  const createLead = useCreateLead();
  const { toast } = useToast();

  const [fields, setFields] = useState({
    name: "", cpf: "", email: "", phone: "",
    income: "", propertyValue: "", brokerId: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (key === "cpf") val = maskCPF(val);
    else if (key === "phone") val = maskPhone(val);
    else if (key === "income" || key === "propertyValue") val = maskBRL(val);
    setFields((f) => ({ ...f, [key]: val }));
    setErrors((err) => ({ ...err, [key]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (fields.name.trim().length < 3) e.name = "Nome obrigatório (mín. 3 caracteres)";
    if (fields.cpf.replace(/\D/g, "").length !== 11) e.cpf = "CPF inválido";
    if (!fields.email.includes("@")) e.email = "Email inválido";
    if (fields.phone.replace(/\D/g, "").length < 10) e.phone = "Telefone inválido";
    if (parseBRL(fields.income) < 1000) e.income = "Renda mínima R$ 1.000";
    if (parseBRL(fields.propertyValue) < 50000) e.propertyValue = "Valor mínimo R$ 50.000";
    return e;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    createLead.mutate(
      {
        data: {
          name: fields.name.trim(),
          cpf: fields.cpf.replace(/\D/g, ""),
          email: fields.email.trim().toLowerCase(),
          phone: fields.phone.replace(/\D/g, ""),
          income: parseBRL(fields.income),
          propertyValue: parseBRL(fields.propertyValue),
          brokerId: fields.brokerId ? Number(fields.brokerId) : null,
        },
      },
      {
        onSuccess: (lead) => onCreated(lead as LeadCreated),
        onError: () => toast({ title: "Erro ao criar lead", description: "Tente novamente." }),
      }
    );
  };

  const Field = ({
    label, id, value, onChange, placeholder, error, type = "text",
  }: {
    label: string; id: string; value: string; onChange: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string; error?: string; type?: string;
  }) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        data-testid={`input-lead-${id}`}
        className={`w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors ${
          error ? "border-red-400 bg-red-50" : "border-gray-200 bg-white focus:border-[#0D1B8C] focus:ring-1 focus:ring-[#0D1B8C]/20"
        }`}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Nome completo" id="name" value={fields.name} onChange={set("name")} placeholder="João da Silva" error={errors.name} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="CPF" id="cpf" value={fields.cpf} onChange={set("cpf")} placeholder="000.000.000-00" error={errors.cpf} />
        <Field label="Telefone" id="phone" value={fields.phone} onChange={set("phone")} placeholder="(11) 99999-9999" error={errors.phone} />
      </div>

      <Field label="Email" id="email" value={fields.email} onChange={set("email")} placeholder="cliente@email.com" type="email" error={errors.email} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Renda mensal" id="income" value={fields.income} onChange={set("income")} placeholder="R$ 0,00" error={errors.income} />
        <Field label="Valor do imóvel" id="property-value" value={fields.propertyValue} onChange={set("propertyValue")} placeholder="R$ 0,00" error={errors.propertyValue} />
      </div>

      {/* Comprometimento preview */}
      {parseBRL(fields.income) > 0 && parseBRL(fields.propertyValue) > 0 && (() => {
        const comprometimento = Math.round((parseBRL(fields.propertyValue) / (parseBRL(fields.income) * 12)) * 100);
        const ok = comprometimento <= 100;
        return (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${ok ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
            <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
            Comprometimento de renda: <strong>{comprometimento}% da renda anual</strong>
            {!ok && " — acima do limite Caixa (4,5×)"}
          </div>
        );
      })()}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Corretor (opcional)</label>
        <select
          value={fields.brokerId}
          onChange={(e) => setFields((f) => ({ ...f, brokerId: e.target.value }))}
          data-testid="select-lead-broker"
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:border-[#0D1B8C] focus:ring-1 focus:ring-[#0D1B8C]/20 text-gray-700"
        >
          <option value="">Sem corretor</option>
          {brokers.map((b) => (
            <option key={b.id} value={String(b.id)}>{b.name}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={createLead.isPending}
          data-testid="button-save-lead"
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-60"
          style={{ background: "#0D1B8C" }}
        >
          {createLead.isPending ? "Calculando score..." : "Cadastrar Lead"}
        </button>
      </div>
    </form>
  );
}

// ─── Score result panel shown after successful creation ──────────────────────

function ScoreResult({ lead, onViewLead, onNewLead }: {
  lead: LeadCreated;
  onViewLead: () => void;
  onNewLead: () => void;
}) {
  const chanceColor = lead.approvalChance >= 70 ? "#10A65A" : lead.approvalChance >= 50 ? "#f59e0b" : "#ef4444";
  const caixaColor  = lead.scoreCaixa  >= 700 ? "#10A65A" : lead.scoreCaixa  >= 500 ? "#f59e0b" : "#ef4444";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: "#D1FAE5" }}>
        <CheckCircle2 className="w-6 h-6 flex-shrink-0" style={{ color: "#065F46" }} />
        <div>
          <p className="font-semibold text-sm" style={{ color: "#065F46" }}>Lead cadastrado com sucesso!</p>
          <p className="text-xs mt-0.5" style={{ color: "#065F46" }}>{lead.name} · Score calculado automaticamente</p>
        </div>
      </div>

      {/* Score bars */}
      <div className="space-y-3">
        <ScoreBar
          value={lead.approvalChance} max={100}
          label="Chance de Aprovação (IA)"
          color={chanceColor}
        />
        <ScoreBar value={lead.scoreCaixa} max={1000} label="Score Caixa" color={caixaColor} />
        <ScoreBar value={lead.scoreMCMV} max={1000} label="Score MCMV" color="#0D1B8C" />
      </div>

      {/* AI recommendation */}
      {lead.aiRecommendation && (
        <div className="p-3 rounded-xl text-xs text-gray-700 leading-relaxed border" style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}>
          <span className="font-semibold" style={{ color: "#0D1B8C" }}>Recomendação da IA: </span>
          {lead.aiRecommendation}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onNewLead}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Novo lead
        </button>
        <button
          onClick={onViewLead}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
          style={{ background: "#0D1B8C" }}
          data-testid="button-view-created-lead"
        >
          Ver detalhes
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export function Leads() {
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage]               = useState(1);
  const [createOpen, setCreateOpen]   = useState(false);
  const [createdLead, setCreatedLead] = useState<LeadCreated | null>(null);
  const [, setLocation]               = useLocation();
  const queryClient                   = useQueryClient();
  const { toast }                     = useToast();

  const { data, isLoading } = useGetLeads(
    { search: search || undefined, status: statusFilter as any || undefined, page, limit: 15 },
    { query: { queryKey: getGetLeadsQueryKey({ search: search || undefined, status: statusFilter as any || undefined, page, limit: 15 }) } }
  );

  const { data: brokers } = useGetBrokers({});
  const deleteLead = useDeleteLead();

  const handleCreated = (lead: LeadCreated) => {
    queryClient.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
    setCreatedLead(lead);
  };

  const handleClose = () => {
    setCreateOpen(false);
    setCreatedLead(null);
  };

  const handleViewLead = () => {
    if (!createdLead) return;
    handleClose();
    setLocation(`/leads/${createdLead.id}`);
  };

  const handleNewLead = () => {
    setCreatedLead(null);
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Excluir o lead "${name}"?`)) return;
    deleteLead.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
        toast({ title: "Lead excluído" });
      },
    });
  };

  const totalPages = data ? Math.ceil(data.total / 15) : 1;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} clientes cadastrados</p>
        </div>

        <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setCreatedLead(null); }}>
          <DialogTrigger asChild>
            <Button className="text-white gap-2" style={{ background: "#0D1B8C" }} data-testid="button-add-lead">
              <Plus className="w-4 h-4" />
              Novo Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {createdLead ? "Score calculado" : "Cadastrar Novo Lead"}
              </DialogTitle>
            </DialogHeader>

            {createdLead ? (
              <ScoreResult lead={createdLead} onViewLead={handleViewLead} onNewLead={handleNewLead} />
            ) : (
              <CreateLeadForm
                brokers={brokers ?? []}
                onCreated={handleCreated}
                onCancel={handleClose}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF ou email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
            data-testid="input-search-leads"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-44" data-testid="select-status-filter">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-card-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Renda</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Imóvel</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Chance</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Score Caixa</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                      <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                      <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-12" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                      <td className="px-4 py-3" />
                    </tr>
                  ))
                : (data?.data ?? []).map((lead) => (
                    <tr key={lead.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`row-lead-${lead.id}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{lead.name}</div>
                        <div className="text-xs text-muted-foreground">{formatCPF(lead.cpf)}</div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{formatBRL(lead.income)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{formatBRL(lead.propertyValue)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${lead.approvalChance}%`,
                                background: lead.approvalChance >= 70 ? "#10A65A" : lead.approvalChance >= 40 ? "#F59E0B" : "#EF4444",
                              }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-foreground">{lead.approvalChance}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="font-mono text-sm font-semibold text-foreground">{lead.scoreCaixa}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/leads/${lead.id}`}>
                            <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" data-testid={`button-view-lead-${lead.id}`}>
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </Link>
                          <button
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-500"
                            onClick={() => handleDelete(lead.id, lead.name)}
                            data-testid={`button-delete-lead-${lead.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {!isLoading && (data?.data?.length ?? 0) === 0 && (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <div className="text-sm font-medium text-foreground">Nenhum lead encontrado</div>
            <div className="text-xs text-muted-foreground mt-1">Ajuste os filtros ou cadastre um novo lead</div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Página {page} de {totalPages} — {data?.total} resultados
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Anterior</Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Próximo</Button>
          </div>
        </div>
      )}
    </div>
  );
}
