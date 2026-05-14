import { useState } from "react";
import {
  useGetMe,
  useGetMySalesHistory,
  useCreateSale,
  useUpdateSale,
  useGetAllSalesHistory,
} from "@workspace/api-client-react";
import {
  getGetMySalesHistoryQueryKey,
  getGetAllSalesHistoryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2, Clock, Home, Key, FileText,
  HardHat, ShieldCheck, Plus, X, ChevronRight,
  TrendingUp, DollarSign, Award,
} from "lucide-react";

const STAGES = [
  { id: "approved",        label: "Aprovação",   icon: CheckCircle2, color: "#10A65A", dateField: "approvedAt" },
  { id: "engineering",     label: "Engenharia",  icon: HardHat,      color: "#0D1B8C", dateField: "engineeringAt" },
  { id: "compliance",      label: "Conformidade",icon: ShieldCheck,  color: "#7C3AED", dateField: "complianceAt" },
  { id: "contract_signed", label: "Contrato",    icon: FileText,     color: "#D97706", dateField: "contractSignedAt" },
  { id: "keys_delivered",  label: "Chaves",      icon: Key,          color: "#10A65A", dateField: "keysDeliveredAt" },
] as const;

type StageId = typeof STAGES[number]["id"];

const STAGE_ORDER: Record<StageId, number> = {
  approved: 0, engineering: 1, compliance: 2, contract_signed: 3, keys_delivered: 4,
};

function formatBRL(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function formatDate(d?: string | null) { if (!d) return null; return new Date(d).toLocaleDateString("pt-BR"); }

// ── Barra de progresso de etapas ───────────────────────────────────────────────
function StagePipeline({ sale }: { sale: any }) {
  const currentIdx = STAGE_ORDER[sale.stage as StageId] ?? 0;
  return (
    <div className="flex items-center gap-1 mt-3">
      {STAGES.map((s, i) => {
        const done = i <= currentIdx;
        const Icon = s.icon;
        return (
          <div key={s.id} className="flex items-center">
            <div
              className="flex flex-col items-center gap-1"
              title={`${s.label}${formatDate(sale[s.dateField]) ? ` — ${formatDate(sale[s.dateField])}` : ""}`}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all"
                style={{
                  background: done ? s.color : "white",
                  borderColor: done ? s.color : "#E5E7EB",
                }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: done ? "white" : "#D1D5DB" }} />
              </div>
              <span className="text-[9px] font-medium" style={{ color: done ? s.color : "#9CA3AF" }}>
                {s.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className="h-0.5 w-5 mx-0.5 mb-4 rounded-full"
                style={{ background: i < currentIdx ? STAGES[i].color : "#E5E7EB" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Card de venda ──────────────────────────────────────────────────────────────
function SaleCard({ sale, canAdvance, onAdvance }: { sale: any; canAdvance: boolean; onAdvance: (id: number, stage: StageId) => void }) {
  const currentIdx = STAGE_ORDER[sale.stage as StageId] ?? 0;
  const nextStage = STAGES[currentIdx + 1];
  const isComplete = sale.stage === "keys_delivered";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] flex items-center justify-center flex-shrink-0">
            <Home className="w-4 h-4 text-[#0D1B8C]" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-[#07113A] text-sm truncate">{sale.propertyTitle}</div>
            <div className="text-xs text-gray-400">{sale.clientName} · {sale.propertyCity ?? ""}</div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-bold text-[#07113A] text-sm">{formatBRL(sale.propertyValue)}</div>
          {sale.bankName && <div className="text-xs text-gray-400">{sale.bankName}</div>}
        </div>
      </div>

      {sale.financedValue && (
        <div className="text-xs text-gray-500 mb-1">
          Financiado: <span className="font-semibold">{formatBRL(sale.financedValue)}</span>
        </div>
      )}

      <StagePipeline sale={sale} />

      {canAdvance && !isComplete && nextStage && (
        <button
          onClick={() => onAdvance(sale.id, nextStage.id)}
          className="mt-3 flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:opacity-80"
          style={{ borderColor: nextStage.color, color: nextStage.color }}
        >
          <ChevronRight className="w-3.5 h-3.5" />
          Avançar para {nextStage.label}
        </button>
      )}

      {isComplete && (
        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#10A65A]">
          <Key className="w-3.5 h-3.5" />
          Chaves entregues em {formatDate(sale.keysDeliveredAt)}
        </div>
      )}
    </div>
  );
}

// ── Modal de nova venda ────────────────────────────────────────────────────────
function NewSaleModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (data: any) => void }) {
  const [form, setForm] = useState({
    clientName: "", propertyTitle: "", propertyValue: "",
    propertyCity: "", bankName: "", financedValue: "", notes: "",
  });

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientName || !form.propertyTitle || !form.propertyValue) return;
    onSave({
      clientName: form.clientName,
      propertyTitle: form.propertyTitle,
      propertyValue: Number(form.propertyValue),
      propertyCity: form.propertyCity || undefined,
      bankName: form.bankName || undefined,
      financedValue: form.financedValue ? Number(form.financedValue) : undefined,
      notes: form.notes || undefined,
      stage: "approved",
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="font-bold text-lg text-[#07113A]">Registrar venda efetiva</div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Nome do cliente *</label>
            <Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} placeholder="Ex.: João Silva" required />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Imóvel *</label>
            <Input value={form.propertyTitle} onChange={(e) => setForm({ ...form, propertyTitle: e.target.value })} placeholder="Ex.: Apt 3q Jardins" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Valor do imóvel (R$) *</label>
              <Input type="number" value={form.propertyValue} onChange={(e) => setForm({ ...form, propertyValue: e.target.value })} placeholder="850000" required />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Valor financiado (R$)</label>
              <Input type="number" value={form.financedValue} onChange={(e) => setForm({ ...form, financedValue: e.target.value })} placeholder="680000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Cidade</label>
              <Input value={form.propertyCity} onChange={(e) => setForm({ ...form, propertyCity: e.target.value })} placeholder="São Paulo" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Banco</label>
              <Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="Caixa, Itaú..." />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Observações</label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Opcional" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1 text-white" style={{ background: "#10A65A" }}>Registrar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── View usuário (corretor / correspondente) ───────────────────────────────────
function MyHistoryView({ role }: { role: string }) {
  const { data: sales = [], isLoading } = useGetMySalesHistory({});
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createSale = useCreateSale();
  const updateSale = useUpdateSale();
  const [modalOpen, setModalOpen] = useState(false);

  const list = sales as any[];
  const totalValue = list.reduce((acc, s) => acc + s.propertyValue, 0);
  const completed = list.filter((s) => s.stage === "keys_delivered").length;

  function handleCreate(data: any) {
    createSale.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMySalesHistoryQueryKey() });
        toast({ title: "Venda registrada com sucesso!" });
        setModalOpen(false);
      },
    });
  }

  function handleAdvance(id: number, stage: StageId) {
    updateSale.mutate({ id, data: { stage } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMySalesHistoryQueryKey() });
        toast({ title: `Avançado para: ${STAGES.find((s) => s.id === stage)?.label}` });
      },
    });
  }

  const entityLabel = role === "correspondent" ? "Contratos" : "Vendas";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>
            Histórico de {entityLabel}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {role === "correspondent"
              ? "Operações de financiamento habitacional — da aprovação à entrega das chaves"
              : "Vendas efetivas concluídas e em andamento"}
          </p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className="text-white flex items-center gap-2"
          style={{ background: "#10A65A" }}
        >
          <Plus className="w-4 h-4" /> Registrar {role === "correspondent" ? "contrato" : "venda"}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: `Total de ${entityLabel.toLowerCase()}`, value: String(list.length), icon: TrendingUp, color: "#0D1B8C", bg: "#EEF2FF" },
          { label: "Concluídas (chaves entregues)", value: String(completed), icon: Key, color: "#10A65A", bg: "#F0FDF4" },
          { label: "Volume total (R$)", value: formatBRL(totalValue), icon: DollarSign, color: "#7C3AED", bg: "#F5F3FF" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">{kpi.label}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: kpi.bg }}>
                  <Icon className="w-4 h-4" style={{ color: kpi.color }} />
                </div>
              </div>
              <div className="text-xl font-bold" style={{ color: "#07113A" }}>{kpi.value}</div>
            </div>
          );
        })}
      </div>

      {/* Lista de vendas */}
      {isLoading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#0D1B8C] border-t-transparent rounded-full animate-spin" /></div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Award className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <div className="font-semibold text-gray-400">Nenhuma {role === "correspondent" ? "operação" : "venda"} registrada ainda</div>
          <div className="text-xs text-gray-300 mt-1">Clique em "Registrar" para adicionar sua primeira {role === "correspondent" ? "operação" : "venda"}</div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((sale: any) => (
            <SaleCard key={sale.id} sale={sale} canAdvance={true} onAdvance={handleAdvance} />
          ))}
        </div>
      )}

      <NewSaleModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleCreate} />
    </div>
  );
}

// ── View admin ─────────────────────────────────────────────────────────────────
function AdminHistoryView() {
  const { data: sales = [], isLoading } = useGetAllSalesHistory({});
  const [search, setSearch] = useState("");

  const list = (sales as any[]).filter((s) =>
    !search || s.clientName.toLowerCase().includes(search.toLowerCase()) ||
    s.userName.toLowerCase().includes(search.toLowerCase()) ||
    s.propertyTitle.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = (sales as any[]).reduce((acc, s) => acc + s.propertyValue, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>Histórico de Vendas & Contratos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Todas as operações registradas na plataforma</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total de operações", value: String((sales as any[]).length), icon: TrendingUp, color: "#0D1B8C", bg: "#EEF2FF" },
          { label: "Chaves entregues",   value: String((sales as any[]).filter((s) => s.stage === "keys_delivered").length), icon: Key, color: "#10A65A", bg: "#F0FDF4" },
          { label: "Volume total",       value: formatBRL(totalValue), icon: DollarSign, color: "#7C3AED", bg: "#F5F3FF" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">{kpi.label}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: kpi.bg }}>
                  <Icon className="w-4 h-4" style={{ color: kpi.color }} />
                </div>
              </div>
              <div className="text-xl font-bold" style={{ color: "#07113A" }}>{kpi.value}</div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <input
          placeholder="Buscar por cliente, corretor ou imóvel..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-4 pr-4 h-10 rounded-lg border border-input text-sm"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#0D1B8C] border-t-transparent rounded-full animate-spin" /></div>
      ) : list.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Nenhuma operação encontrada</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((sale: any) => (
            <SaleCard key={sale.id} sale={sale} canAdvance={false} onAdvance={() => {}} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export function Historico() {
  const { data: me } = useGetMe({});
  const role = (me as any)?.role ?? "broker";
  if (role === "admin") return <AdminHistoryView />;
  if (role === "broker" || role === "correspondent") return <MyHistoryView role={role} />;
  return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
      <Clock className="w-10 h-10 mb-2 text-gray-200" />
      <div>Histórico disponível apenas para corretores e correspondentes.</div>
    </div>
  );
}
