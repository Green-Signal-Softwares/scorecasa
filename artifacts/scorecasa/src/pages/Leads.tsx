import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  useGetLeads,
  useCreateLead,
  useDeleteLead,
  useGetBrokers,
  useGetProperty,
  getGetLeadsQueryKey,
  getGetPropertyQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Trash2, ChevronRight, Filter, Users, CheckCircle2, TrendingUp, ArrowRight, RotateCcw, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useRequireBrokerAuth } from "@/hooks/use-auth";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending: { label: "Pendente", color: "#92400E", bg: "#FEF3C7", border: "#F59E0B" },
  analyzing: { label: "Em Análise", color: "#1E40AF", bg: "#DBEAFE", border: "#3B82F6" },
  approved: { label: "Aprovado", color: "#065F46", bg: "#D1FAE5", border: "#10B981" },
  rejected: { label: "Reprovado", color: "#991B1B", bg: "#FEE2E2", border: "#EF4444" },
  in_progress: { label: "Em Andamento", color: "#7C3AED", bg: "#EDE9FE", border: "#8B5CF6" },
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
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "#374151", bg: "#F3F4F6", border: "#E5E7EB" };
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border" style={{ color: cfg.color, background: cfg.bg, borderColor: `${cfg.border}25` }}>
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

// ─── Lead creation form — multi-step wizard ──────────────────────────────────

type LeadCreated = {
  id: number;
  name: string;
  approvalChance: number;
  scoreCaixa: number;
  scoreMCMV: number;
  aiRecommendation?: string | null;
};

interface PrefilledProperty {
  id: number;
  title: string;
  price: number;
  city?: string | null;
  state?: string | null;
}

interface CreateLeadFormProps {
  brokers: Array<{ id: number; name: string }>;
  onCreated: (lead: LeadCreated) => void;
  onCancel: () => void;
  prefilledProperty?: PrefilledProperty | null;
}

const MARITAL_OPTIONS = [
  { value: "solteiro", label: "Solteiro(a)" },
  { value: "casado", label: "Casado(a)" },
  { value: "uniao_estavel", label: "União Estável" },
  { value: "divorciado", label: "Divorciado(a)" },
  { value: "viuvo", label: "Viúvo(a)" },
];

const EMPLOYMENT_OPTIONS = [
  { value: "clt", label: "CLT / Empregado" },
  { value: "servidor_publico", label: "Servidor Público" },
  { value: "autonomo", label: "Autônomo" },
  { value: "liberal", label: "Profissional Liberal" },
  { value: "empresario", label: "Empresário / MEI" },
  { value: "aposentado", label: "Aposentado / Pensionista" },
  { value: "desempregado", label: "Desempregado" },
];

const PROPERTY_TYPE_OPTIONS = [
  { value: "novo", label: "Imóvel Novo" },
  { value: "usado", label: "Imóvel Usado" },
  { value: "construcao", label: "Construção / Planta" },
  { value: "terreno", label: "Terreno" },
];

const BR_STATES = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
  "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

type FieldKey =
  | "name" | "cpf" | "email" | "phone" | "birthDate" | "maritalStatus"
  | "profession" | "employmentType" | "employmentMonths"
  | "income" | "informalIncome" | "hasFgts" | "fgtsBalance"
  | "propertyValue" | "propertyType" | "propertyCity" | "propertyState" | "brokerId"
  | "spouseName" | "spouseCpf" | "spouseBirthDate" | "spouseProfession" | "spouseIncome";

const STEPS = ["Identificação", "Profissão & Renda", "Imóvel", "Cônjuge"];

function CreateLeadForm({ brokers, onCreated, onCancel, prefilledProperty }: CreateLeadFormProps) {
  const createLead = useCreateLead();
  const { toast } = useToast();
  const { user } = useRequireBrokerAuth();

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [fields, setFields] = useState<Record<FieldKey, string>>(() => {
    const priceCents = prefilledProperty
      ? String(Math.round(Number(prefilledProperty.price) || 0) * 100)
      : "";
    return {
      name: "", cpf: "", email: "", phone: "", birthDate: "", maritalStatus: "",
      profession: "", employmentType: "", employmentMonths: "",
      income: "", informalIncome: "", hasFgts: "", fgtsBalance: "",
      propertyValue: priceCents ? maskBRL(priceCents) : "",
      propertyType: "",
      propertyCity: prefilledProperty?.city ?? "",
      propertyState: prefilledProperty?.state ?? "",
      brokerId: "",
      spouseName: "", spouseCpf: "", spouseBirthDate: "", spouseProfession: "", spouseIncome: "",
    };
  });

  useEffect(() => {
    if (user?.role === "broker" && brokers.length > 0 && !fields.brokerId) {
      const matched = brokers.find((b: any) => b.email?.toLowerCase() === user?.email?.toLowerCase());
      if (matched) {
        setFields((f) => ({ ...f, brokerId: String(matched.id) }));
      }
    }
  }, [user, brokers, fields.brokerId]);

  const needsSpouse = fields.maritalStatus === "casado" || fields.maritalStatus === "uniao_estavel";
  const totalSteps = needsSpouse ? 4 : 3;

  const setField = (key: FieldKey, val: string) => {
    setFields((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const handleTextChange = (key: FieldKey, transform?: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setField(key, transform ? transform(e.target.value) : e.target.value);

  const validateStep = (s: number): Partial<Record<FieldKey, string>> => {
    const e: Partial<Record<FieldKey, string>> = {};
    if (s === 0) {
      if (fields.name.trim().length < 3) e.name = "Nome obrigatório (mín. 3 caracteres)";
      if (fields.cpf.replace(/\D/g, "").length !== 11) e.cpf = "CPF inválido";
      if (!fields.email.includes("@")) e.email = "Email inválido";
      if (fields.phone.replace(/\D/g, "").length < 10) e.phone = "Telefone inválido";
      if (!fields.birthDate) e.birthDate = "Data de nascimento obrigatória";
      if (!fields.maritalStatus) e.maritalStatus = "Estado civil obrigatório";
    }
    if (s === 1) {
      if (!fields.profession.trim()) e.profession = "Profissão obrigatória";
      if (!fields.employmentType) e.employmentType = "Vínculo empregatício obrigatório";
      if (parseBRL(fields.income) < 1000) e.income = "Renda mínima R$ 1.000";
    }
    if (s === 2) {
      if (parseBRL(fields.propertyValue) < 50000) e.propertyValue = "Valor mínimo R$ 50.000";
      if (!fields.propertyType) e.propertyType = "Tipo do imóvel obrigatório";
      if (!fields.propertyCity.trim()) e.propertyCity = "Cidade obrigatória";
      if (!fields.propertyState) e.propertyState = "UF obrigatória";
    }
    if (s === 3 && needsSpouse) {
      if (!fields.spouseName.trim()) e.spouseName = "Nome do cônjuge obrigatório";
      if (fields.spouseCpf && fields.spouseCpf.replace(/\D/g, "").length !== 11) e.spouseCpf = "CPF inválido";
    }
    return e;
  };

  const next = () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setStep((s) => s + 1);
  };

  const prev = () => setStep((s) => Math.max(0, s - 1));

  const handleSubmit = () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const data: Parameters<typeof createLead.mutate>[0]["data"] = {
      name: fields.name.trim(),
      cpf: fields.cpf.replace(/\D/g, ""),
      email: fields.email.trim().toLowerCase(),
      phone: fields.phone.replace(/\D/g, ""),
      birthDate: fields.birthDate || null,
      maritalStatus: (fields.maritalStatus as any) || null,
      profession: fields.profession.trim() || null,
      employmentType: (fields.employmentType as any) || null,
      employmentMonths: fields.employmentMonths ? Number(fields.employmentMonths) : null,
      income: parseBRL(fields.income),
      informalIncome: fields.informalIncome ? parseBRL(fields.informalIncome) : null,
      hasFgts: fields.hasFgts === "true" ? true : fields.hasFgts === "false" ? false : null,
      fgtsBalance: fields.fgtsBalance ? parseBRL(fields.fgtsBalance) : null,
      propertyValue: parseBRL(fields.propertyValue),
      propertyType: (fields.propertyType as any) || null,
      propertyCity: fields.propertyCity.trim() || null,
      propertyState: fields.propertyState || null,
      brokerId: fields.brokerId ? Number(fields.brokerId) : null,
      linkedPropertyId: prefilledProperty?.id ?? null,
      spouseName: needsSpouse ? (fields.spouseName.trim() || null) : null,
      spouseCpf: needsSpouse && fields.spouseCpf ? fields.spouseCpf.replace(/\D/g, "") : null,
      spouseBirthDate: needsSpouse ? (fields.spouseBirthDate || null) : null,
      spouseProfession: needsSpouse ? (fields.spouseProfession.trim() || null) : null,
      spouseIncome: needsSpouse && fields.spouseIncome ? parseBRL(fields.spouseIncome) : null,
    };

    createLead.mutate(
      { data },
      {
        onSuccess: (lead) => onCreated(lead as LeadCreated),
        onError: () => toast({ title: "Erro ao criar lead", description: "Tente novamente." }),
      }
    );
  };

  // ── Reusable field components ─────────────────────────────────────────────

  const TextField = ({
    label, fkey, placeholder, type = "text", hint,
  }: { label: string; fkey: FieldKey; placeholder?: string; type?: string; hint?: string }) => (
    <div className="space-y-1.5 text-left">
      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={fields[fkey]}
        onChange={handleTextChange(fkey,
          fkey === "cpf" ? maskCPF :
            fkey === "phone" || fkey === "spouseCpf" ? (fkey === "spouseCpf" ? maskCPF : maskPhone) :
              fkey === "income" || fkey === "informalIncome" || fkey === "fgtsBalance" || fkey === "propertyValue" || fkey === "spouseIncome" ? maskBRL :
                undefined
        )}
        placeholder={placeholder}
        data-testid={`input-lead-${fkey}`}
        className={`w-full px-4 py-3 rounded-2xl border text-sm outline-none transition-all font-medium ${
          errors[fkey]
            ? "border-red-400 bg-red-50/50 text-red-900 focus:ring-4 focus:ring-red-500/10"
            : "border-gray-200 bg-gray-50/50 text-gray-800 focus:border-[#0D1B8C] focus:bg-white focus:ring-4 focus:ring-[#0D1B8C]/10"
        }`}
      />
      {hint && !errors[fkey] && <p className="text-gray-400 text-[10px] font-semibold mt-1 pl-1">{hint}</p>}
      {errors[fkey] && <p className="text-red-500 text-[10px] font-semibold mt-1 pl-1">{errors[fkey]}</p>}
    </div>
  );

  const SelectField = ({
    label, fkey, options, placeholder,
  }: { label: string; fkey: FieldKey; options: { value: string; label: string }[]; placeholder?: string }) => (
    <div className="space-y-1.5 text-left">
      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">{label}</label>
      <select
        value={fields[fkey]}
        onChange={(e) => setField(fkey, e.target.value)}
        data-testid={`select-lead-${fkey}`}
        className={`w-full px-4 py-3 rounded-2xl border text-sm outline-none transition-all font-medium bg-gray-50/50 ${
          errors[fkey]
            ? "border-red-400 bg-red-50/50 text-red-950 focus:ring-4 focus:ring-red-500/10"
            : "border-gray-200 text-gray-800 focus:border-[#0D1B8C] focus:bg-white focus:ring-4 focus:ring-[#0D1B8C]/10"
        }`}
      >
        <option value="">{placeholder ?? "Selecione..."}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {errors[fkey] && <p className="text-red-500 text-[10px] font-semibold mt-1 pl-1">{errors[fkey]}</p>}
    </div>
  );

  // ── Steps content ─────────────────────────────────────────────────────────
  // NOTE: TextField/SelectField are called as plain functions (not <Component/>)
  // to avoid React unmounting/remounting inputs on every keystroke (focus loss bug).

  const renderStep = () => {
    if (step === 0) return (
      <div className="space-y-3">
        {TextField({ label: "Nome completo *", fkey: "name", placeholder: "João da Silva" })}
        <div className="grid grid-cols-2 gap-3">
          {TextField({ label: "CPF *", fkey: "cpf", placeholder: "000.000.000-00" })}
          {TextField({ label: "Telefone *", fkey: "phone", placeholder: "(11) 99999-9999" })}
        </div>
        {TextField({ label: "Email *", fkey: "email", placeholder: "cliente@email.com", type: "email" })}
        <div className="grid grid-cols-2 gap-3">
          {TextField({ label: "Data de nascimento *", fkey: "birthDate", type: "date" })}
          {SelectField({ label: "Estado civil *", fkey: "maritalStatus", options: MARITAL_OPTIONS })}
        </div>
      </div>
    );

    if (step === 1) return (
      <div className="space-y-3">
        {TextField({ label: "Profissão *", fkey: "profession", placeholder: "Ex: Engenheiro, Médico, Comerciante..." })}
        <div className="grid grid-cols-2 gap-3">
          {SelectField({ label: "Vínculo empregatício *", fkey: "employmentType", options: EMPLOYMENT_OPTIONS })}
          {TextField({ label: "Tempo no emprego atual", fkey: "employmentMonths", placeholder: "Ex: 24", type: "number", hint: "Em meses" })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {TextField({ label: "Renda mensal formal *", fkey: "income", placeholder: "R$ 0,00" })}
          {TextField({ label: "Renda informal / extra", fkey: "informalIncome", placeholder: "R$ 0,00", hint: "70% considerado pela Caixa" })}
        </div>

        {/* FGTS */}
        <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50 space-y-3 text-left">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Possui saldo FGTS?</p>
          <div className="flex gap-3">
            {[{ v: "true", l: "Sim, possuo FGTS" }, { v: "false", l: "Não possuo" }].map(({ v, l }) => (
              <button
                key={v}
                type="button"
                onClick={() => setField("hasFgts", v)}
                className={`flex-1 py-3 rounded-2xl text-xs font-bold border transition-all ${
                  fields.hasFgts === v
                    ? "border-[#0D1B8C] bg-[#0D1B8C] text-white shadow-md shadow-blue-900/10 scale-[1.02]"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          {fields.hasFgts === "true" && TextField({ label: "Saldo estimado FGTS", fkey: "fgtsBalance", placeholder: "R$ 0,00" })}
        </div>

        {/* Comprometimento de renda preview */}
        {parseBRL(fields.income) > 0 && parseBRL(fields.propertyValue) > 0 && (() => {
          const totalRenda = parseBRL(fields.income) + parseBRL(fields.informalIncome) * 0.7;
          const comprometimento = Math.round((parseBRL(fields.propertyValue) / (totalRenda * 12)) * 100);
          const ok = comprometimento <= 100;
          return (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${ok ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
              <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
              Comprometimento de renda: <strong>{comprometimento}% da renda anual</strong>
              {!ok && " — acima do limite Caixa (4,5×)"}
            </div>
          );
        })()}
      </div>
    );

    if (step === 2) return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {TextField({ label: "Valor do imóvel *", fkey: "propertyValue", placeholder: "R$ 0,00" })}
          {SelectField({ label: "Tipo do imóvel *", fkey: "propertyType", options: PROPERTY_TYPE_OPTIONS })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {TextField({ label: "Cidade do imóvel *", fkey: "propertyCity", placeholder: "São Paulo" })}
          {SelectField({ label: "UF *", fkey: "propertyState", options: BR_STATES.map((s) => ({ value: s, label: s })), placeholder: "UF" })}
        </div>
        {user?.role !== "broker" && (
          <div className="space-y-1.5 text-left">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Corretor responsável</label>
            <select
              value={fields.brokerId}
              onChange={(e) => setField("brokerId", e.target.value)}
              data-testid="select-lead-broker"
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50/50 text-sm outline-none transition-all font-medium text-gray-800 focus:border-[#0D1B8C] focus:bg-white focus:ring-4 focus:ring-[#0D1B8C]/10"
            >
              <option value="">Sem corretor</option>
              {brokers.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
            </select>
          </div>
        )}
      </div>
    );

    if (step === 3 && needsSpouse) return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-blue-50/50 border border-blue-100 text-left">
          <span className="text-[11px] font-semibold text-blue-700">A Caixa exige dados do cônjuge para composição de renda no financiamento.</span>
        </div>
        {TextField({ label: "Nome completo do cônjuge *", fkey: "spouseName", placeholder: "Maria da Silva" })}
        <div className="grid grid-cols-2 gap-3">
          {TextField({ label: "CPF do cônjuge", fkey: "spouseCpf", placeholder: "000.000.000-00" })}
          {TextField({ label: "Data de nascimento", fkey: "spouseBirthDate", type: "date" })}
        </div>
        {TextField({ label: "Profissão do cônjuge", fkey: "spouseProfession", placeholder: "Ex: Professora, Enfermeira..." })}
        {TextField({ label: "Renda mensal do cônjuge", fkey: "spouseIncome", placeholder: "R$ 0,00" })}
      </div>
    );

    return null;
  };

  const isLastStep = step === totalSteps - 1;

  return (
    <div className="space-y-6">
      {prefilledProperty && (
        <div
          className="flex items-start gap-2.5 p-3.5 rounded-2xl border text-left"
          style={{ background: "#EEF2FF", borderColor: "#C7D2FE" }}
          data-testid="banner-prefill-property"
        >
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#0D1B8C" }} />
          <div className="text-xs font-semibold" style={{ color: "#0D1B8C" }}>
            Simulando para o imóvel <strong>{prefilledProperty.title}</strong>
            {prefilledProperty.city ? ` em ${prefilledProperty.city}/${prefilledProperty.state ?? ""}` : ""}
            . Valor, cidade e UF foram pré-preenchidos.
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#0D1B8C]">
            Etapa {step + 1} de {totalSteps}
          </span>
          <span className="text-xs font-bold text-gray-800">
            {STEPS[step]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                i === step
                  ? "bg-[#0D1B8C] shadow-sm shadow-blue-900/20 w-3/5"
                  : i < step
                  ? "bg-[#0D1B8C]/60"
                  : "bg-gray-200/80"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      {renderStep()}

      {/* Navigation */}
      <div className="flex gap-3 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={step === 0 ? onCancel : prev}
          className="flex-1 py-3 rounded-2xl text-xs font-bold border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          {step === 0 ? "Cancelar" : "← Voltar"}
        </button>
        <button
          type="button"
          onClick={isLastStep ? handleSubmit : next}
          disabled={createLead.isPending}
          data-testid={isLastStep ? "button-save-lead" : `button-step-${step}-next`}
          className="flex-1 py-3 rounded-2xl text-xs font-bold text-white transition-all disabled:opacity-60 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-98"
          style={{ background: "linear-gradient(135deg, #0D1B8C 0%, #08126B 100%)" }}
        >
          {createLead.isPending ? "Calculando score..." : isLastStep ? "Calcular Score →" : "Próximo →"}
        </button>
      </div>
    </div>
  );
}

// ─── Score result panel shown after successful creation ──────────────────────

function ScoreResult({ lead, onViewLead, onNewLead }: {
  lead: LeadCreated;
  onViewLead: () => void;
  onNewLead: () => void;
}) {
  const chanceColor = lead.approvalChance >= 70 ? "#10B981" : lead.approvalChance >= 50 ? "#F59E0B" : "#EF4444";
  const caixaColor = lead.scoreCaixa >= 700 ? "#10B981" : lead.scoreCaixa >= 500 ? "#F59E0B" : "#EF4444";

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex items-center gap-3.5 p-4.5 rounded-2xl border border-emerald-100" style={{ background: "#ECFDF5" }}>
        <CheckCircle2 className="w-6 h-6 flex-shrink-0" style={{ color: "#059669" }} />
        <div>
          <p className="font-bold text-sm text-[#065F46]">Lead cadastrado com sucesso!</p>
          <p className="text-[11px] text-[#047857] font-semibold mt-0.5">{lead.name} · Score calculado automaticamente</p>
        </div>
      </div>

      {/* Score bars */}
      <div className="space-y-4">
        <ScoreBar
          value={lead.approvalChance} max={100}
          label="Chance de Aprovação (IA)"
          color={chanceColor}
        />
        <ScoreBar value={lead.scoreCaixa} max={1000} label="Score Caixa" color={caixaColor} />
        <ScoreBar value={lead.scoreMCMV} max={1000} label="Score Minha Casa Minha Vida" color="#0D1B8C" />
      </div>

      {/* AI recommendation */}
      {lead.aiRecommendation && (
        <div className="p-4 rounded-2xl text-xs text-gray-700 leading-relaxed border border-blue-100" style={{ background: "#F0F4FF" }}>
          <span className="font-extrabold text-[#0D1B8C]">Recomendação de Crédito: </span>
          <span className="font-medium text-gray-600">{lead.aiRecommendation}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onNewLead}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Novo lead
        </button>
        <button
          onClick={onViewLead}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold text-white transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-98"
          style={{ background: "linear-gradient(135deg, #0D1B8C 0%, #08126B 100%)" }}
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [createdLead, setCreatedLead] = useState<LeadCreated | null>(null);
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { user } = useRequireBrokerAuth();
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkCpf, setLinkCpf] = useState("");
  const [linking, setLinking] = useState(false);

  const BASE = useMemo(() => import.meta.env.BASE_URL.replace(/\/$/, ""), []);

  const handleLinkClient = async () => {
    if (!linkCpf) {
      toast({ title: "Erro", description: "CPF é obrigatório.", variant: "destructive" });
      return;
    }
    const cleanCpf = linkCpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      toast({ title: "Erro", description: "CPF inválido.", variant: "destructive" });
      return;
    }

    setLinking(true);
    try {
      const res = await fetch(`${BASE}/api/leads/link-client`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: cleanCpf }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao vincular cliente.");
      }

      toast({ title: "Sucesso", description: "Cliente vinculado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
      setLinkOpen(false);
      setLinkCpf("");
    } catch (err: any) {
      toast({
        title: "Erro ao vincular",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLinking(false);
    }
  };

  // Detect ?prefillProperty=<id> to open the create dialog pre-filled with the property.
  const prefillPropertyId = useMemo(() => {
    const params = new URLSearchParams(searchString);
    const raw = params.get("prefillProperty");
    const id = raw ? Number(raw) : NaN;
    return Number.isInteger(id) && id > 0 ? id : null;
  }, [searchString]);

  const { data: prefilledPropertyData } = useGetProperty(prefillPropertyId ?? 0, {
    query: {
      enabled: !!prefillPropertyId,
      retry: false,
      queryKey: getGetPropertyQueryKey(prefillPropertyId ?? 0),
    },
  });
  const prefilledProperty = prefilledPropertyData
    ? {
      id: (prefilledPropertyData as any).id,
      title: (prefilledPropertyData as any).title,
      price: Number((prefilledPropertyData as any).price) || 0,
      city: (prefilledPropertyData as any).city,
      state: (prefilledPropertyData as any).state,
    }
    : null;

  useEffect(() => {
    if (prefillPropertyId) setCreateOpen(true);
  }, [prefillPropertyId]);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">Leads</h1>
          <p className="text-xs font-semibold text-gray-400 mt-1">{data?.total ?? 0} clientes cadastrados na plataforma</p>
        </div>

        <div className="flex items-center gap-2">
          {user?.role === "broker" && (
            <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
              <DialogTrigger asChild>
                <Button
                  className="text-white gap-2 h-10 px-4 rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg shadow-emerald-900/10 hover:-translate-y-0.5 active:translate-y-0"
                  style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}
                  data-testid="button-link-client-modal"
                >
                  <Link2 className="w-4 h-4" />
                  Vincular Cliente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md rounded-3xl bg-white shadow-2xl border border-gray-100 p-0 overflow-hidden">
                {/* Header Banner */}
                <div className="relative p-6 text-white text-left" style={{ background: "linear-gradient(135deg, #0D1B8C 0%, #08126B 100%)" }}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-8 -mt-8" />
                  <div className="relative z-10 flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20">
                      <Link2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-extrabold tracking-tight">
                        Vincular Cliente
                      </DialogTitle>
                      <p className="text-[11px] text-blue-200 font-semibold mt-0.5">
                        Associe um cliente cadastrado ao seu perfil
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-5 text-left">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Insira o CPF do cliente registrado na plataforma para estabelecer a vinculação e carregar os dados de score.
                  </p>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">CPF do Cliente</label>
                    <input
                      type="text"
                      value={linkCpf}
                      onChange={(e) => setLinkCpf(maskCPF(e.target.value))}
                      placeholder="000.000.000-00"
                      data-testid="input-link-cpf"
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50/50 text-sm outline-none transition-all focus:border-[#0D1B8C] focus:bg-white focus:ring-4 focus:ring-[#0D1B8C]/10 font-medium text-gray-800"
                    />
                  </div>
                  <div className="flex gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => { setLinkOpen(false); setLinkCpf(""); }}
                      className="flex-1 py-3 rounded-2xl text-xs font-bold border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleLinkClient}
                      disabled={linking}
                      data-testid="button-confirm-link-client"
                      className="flex-1 py-3 rounded-2xl text-xs font-bold text-white transition-all disabled:opacity-60 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-98"
                      style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}
                    >
                      {linking ? "Vinculando..." : "Vincular Cliente →"}
                    </button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setCreatedLead(null); }}>
            <DialogTrigger asChild>
              <Button
                className="text-white gap-2 h-10 px-4 rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg shadow-blue-900/10 hover:-translate-y-0.5 active:translate-y-0"
                style={{ background: "linear-gradient(135deg, #0D1B8C 0%, #08126B 100%)" }}
                data-testid="button-add-lead"
              >
                <Plus className="w-4 h-4" />
                Novo Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-gray-100 p-0 overflow-hidden">
              <div className="relative p-6 text-white text-left animate-in fade-in slide-in-from-top-4 duration-300" style={{ background: "linear-gradient(135deg, #0D1B8C 0%, #08126B 100%)" }}>
                <div className="absolute top-0 right-0 w-36 h-36 bg-white/5 rounded-full blur-2xl -mr-6 -mt-6" />
                <div className="relative z-10 flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20">
                    <Plus className="w-5 h-5 text-blue-300" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-extrabold tracking-tight">
                      {createdLead ? "Resultado da Simulação" : "Cadastrar Novo Lead"}
                    </DialogTitle>
                    <p className="text-[11px] text-blue-200 font-semibold mt-0.5">
                      {createdLead ? "Análise concluída com sucesso" : "Preencha a ficha do cliente para calcular o score Caixa"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {createdLead ? (
                  <ScoreResult lead={createdLead} onViewLead={handleViewLead} onNewLead={handleNewLead} />
                ) : (
                  <CreateLeadForm
                    key={prefilledProperty?.id ?? "blank"}
                    brokers={brokers ?? []}
                    onCreated={handleCreated}
                    onCancel={handleClose}
                    prefilledProperty={prefilledProperty}
                  />
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col md:flex-row items-center gap-4">
        <div className="flex items-center gap-2 text-[#07113A] font-bold text-sm w-full md:w-auto flex-shrink-0">
          <Filter className="w-4 h-4 text-[#0D1B8C]" />
          <span>Filtros:</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full flex-1">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por nome, CPF ou email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10 h-10 rounded-xl border-gray-200/80 focus:border-[#0D1B8C] focus:ring-2 focus:ring-[#0D1B8C]/10 text-xs font-semibold text-gray-700 bg-white"
              data-testid="input-search-leads"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-44 h-10 rounded-xl border-gray-200/80 text-xs font-semibold text-gray-700 bg-white" data-testid="select-status-filter">
              <SelectValue placeholder="Filtrar por Status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="text-xs font-semibold">Todos os status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs font-semibold">{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell">Renda</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Imóvel</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Chance</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell">Score Caixa</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4.5"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-6 py-4.5 hidden md:table-cell"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-6 py-4.5 hidden lg:table-cell"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-6 py-4.5"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-6 py-4.5 hidden md:table-cell"><Skeleton className="h-4 w-12" /></td>
                    <td className="px-6 py-4.5"><Skeleton className="h-5 w-20 rounded-full" /></td>
                    <td className="px-6 py-4.5" />
                  </tr>
                ))
                : (data?.data ?? []).map((lead) => (
                  <tr key={lead.id} className="hover:bg-blue-50/10 transition-colors" data-testid={`row-lead-${lead.id}`}>
                    <td className="px-6 py-4.5">
                      <div className="font-bold text-gray-700">{lead.name}</div>
                      <div className="text-[10px] text-gray-400 font-semibold mt-0.5">{formatCPF(lead.cpf)}</div>
                    </td>
                    <td className="px-6 py-4.5 hidden md:table-cell font-semibold text-gray-500">{formatBRL(lead.income)}</td>
                    <td className="px-6 py-4.5 hidden lg:table-cell font-semibold text-gray-500">{formatBRL(lead.propertyValue)}</td>
                    <td className="px-6 py-4.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${lead.approvalChance}%`,
                              background: lead.approvalChance >= 70 ? "linear-gradient(90deg, #10B981 0%, #059669 100%)" : lead.approvalChance >= 40 ? "linear-gradient(90deg, #F59E0B 0%, #D97706 100%)" : "linear-gradient(90deg, #EF4444 0%, #DC2626 100%)",
                            }}
                          />
                        </div>
                        <span className="text-xs font-extrabold text-gray-700">{lead.approvalChance}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4.5 hidden md:table-cell">
                      <span className="font-sans text-xs font-extrabold text-gray-700 bg-gray-50 border border-gray-200/60 px-2 py-0.5 rounded-md">{lead.scoreCaixa}</span>
                    </td>
                    <td className="px-6 py-4.5">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="px-6 py-4.5">
                      <div className="flex items-center gap-1.5 justify-end">
                        <Link href={`/leads/${lead.id}`}>
                          <button
                            className="p-1.5 rounded-lg bg-gray-50 hover:bg-blue-50 text-gray-400 hover:text-[#0D1B8C] border border-gray-100 hover:border-blue-100 transition-colors"
                            data-testid={`button-view-lead-${lead.id}`}
                            title="Ver detalhes"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </Link>
                        <button
                          className="p-1.5 rounded-lg bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 border border-gray-100 hover:border-red-100 transition-colors"
                          onClick={() => handleDelete(lead.id, lead.name)}
                          data-testid={`button-delete-lead-${lead.id}`}
                          title="Excluir"
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
          <div className="py-16 text-center bg-white">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <div className="text-sm font-bold text-gray-700">Nenhum lead encontrado</div>
            <div className="text-xs text-gray-400 mt-1">Ajuste os filtros ou cadastre um novo lead</div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs font-semibold text-gray-400">
            Página {page} de {totalPages} — {data?.total} resultados
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-9 px-3 rounded-xl border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-55"
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-9 px-3 rounded-xl border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-55"
            >
              Próximo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
