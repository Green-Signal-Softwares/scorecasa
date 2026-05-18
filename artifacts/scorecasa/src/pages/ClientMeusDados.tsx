import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey, useGetClientProfile, getGetClientProfileQueryKey, ApiError } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { ClientDocumentosTab } from "@/components/ClientDocumentosTab";
import { FormField } from "@/components/FormField";
import { SessionExpiredBanner } from "@/components/SessionExpiredBanner";
import { useToast } from "@/hooks/use-toast";
import { useSessionGuard } from "@/hooks/use-session-guard";

// ── Helpers ──────────────────────────────────────────────────────────────────

function maskCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function maskBRL(v: string) {
  const d = v.replace(/\D/g, "");
  if (!d) return "";
  return (parseInt(d, 10) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseBRL(v: string) {
  return parseFloat(v.replace(/\D/g, "")) / 100 || 0;
}

function brlFromNumber(n: number | null | undefined) {
  if (!n) return "";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const MARITAL_OPTIONS = [
  { value: "solteiro",      label: "Solteiro(a)" },
  { value: "casado",        label: "Casado(a)" },
  { value: "uniao_estavel", label: "União Estável" },
  { value: "divorciado",    label: "Divorciado(a)" },
  { value: "viuvo",         label: "Viúvo(a)" },
];

const BR_STATES = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA",
  "PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

// ── Components ────────────────────────────────────────────────────────────────

const Field = FormField;

function SelectField({
  label, value, onChange, options, placeholder, invalid,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string; invalid?: boolean;
}) {
  const labelCls = invalid ? "text-red-600" : "text-gray-700";
  const selectCls = invalid
    ? "w-full px-3 py-2.5 rounded-lg border border-red-500 bg-red-50 text-sm text-red-700 outline-none focus:ring-2 focus:ring-red-300 focus:border-red-500"
    : "w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:border-[#0D1B8C] focus:ring-1 focus:ring-[#0D1B8C]/20 text-gray-700";
  return (
    <div>
      <label className={`block text-sm font-medium mb-1 ${labelCls}`}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        className={selectCls}
      >
        <option value="">{placeholder ?? "Selecione..."}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function RadioGroup({
  label, value, onChange, options, invalid,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; invalid?: boolean;
}) {
  const labelCls = invalid ? "text-red-600" : "text-gray-700";
  const wrapperCls = invalid
    ? "flex gap-4 rounded-lg border border-red-500 bg-red-50 px-3 py-2"
    : "flex gap-4";
  return (
    <div>
      <label className={`block text-sm font-medium mb-2 ${labelCls}`}>{label}</label>
      <div className={wrapperCls} role="radiogroup" aria-invalid={invalid || undefined}>
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="w-4 h-4 accent-[#0D1B8C]"
            />
            <span className={`text-sm ${invalid ? "text-red-700" : "text-gray-700"}`}>{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ClientMeusDados() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: me, isLoading: loadingMe, error: meError } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 60_000 },
  });

  const { data: profile, isLoading, error: profileError } = useGetClientProfile({
    query: { queryKey: getGetClientProfileQueryKey(), staleTime: 30_000, retry: false },
  });

  // ── Form state ─────────────────────────────────────────────────────────────

  // Aceita ?tab=documentos vindo do balão do portal.
  const initialTab =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "documentos"
      ? "documentos"
      : "dados";
  const [tab, setTab] = useState<"dados" | "documentos" | "conta">(initialTab as any);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errFields, setErrFields] = useState<Set<string>>(new Set());

  // Mapeia campos do payload do backend para nomes de inputs do form local.
  const FIELD_TO_FORM: Record<string, keyof typeof form> = {
    name: "name",
    birthDate: "birthDate",
    profession: "profissao",
    employmentType: "carteiraAssinada",
    income: "income",
    informalIncome: "informalIncome",
    maritalStatus: "maritalStatus",
    propertyValue: "propertyValue",
    propertyCity: "cidadeImovel",
    propertyState: "propertyState",
    spouseName: "spouseName",
    spouseCpf: "spouseCpf",
    spouseBirthDate: "spouseBirthDate",
    spouseProfession: "spouseProfissao",
    spouseIncome: "spouseIncome",
  };

  function isInvalid(formKey: keyof typeof form): boolean {
    for (const [api, local] of Object.entries(FIELD_TO_FORM)) {
      if (local === formKey && errFields.has(api)) return true;
    }
    return false;
  }

  function clearFieldError(formKey: keyof typeof form) {
    setErrFields((prev) => {
      let next: Set<string> | null = null;
      for (const [api, local] of Object.entries(FIELD_TO_FORM)) {
        if (local === formKey && prev.has(api)) {
          if (!next) next = new Set(prev);
          next.delete(api);
        }
      }
      return next ?? prev;
    });
  }

  const [form, setForm] = useState({
    name: "", cpf: "",
    birthDate: "", cidade: "", cidadeImovel: "", profissao: "",
    carteiraAssinada: "", income: "", informalIncome: "", maritalStatus: "",
    propertyValue: "", propertyState: "",
    spouseCpf: "", spouseName: "", spouseBirthDate: "", spouseCidade: "",
    spouseProfissao: "", spouseIncome: "", spouseInformalIncome: "",
  });

  const guard = useSessionGuard<typeof form>({
    draftKey: "scorecasa:meusdados:draft",
    getForm: () => form,
  });

  const meUnauthorized = meError instanceof ApiError && meError.status === 401;
  const profileUnauthorized = profileError instanceof ApiError && profileError.status === 401;

  useEffect(() => {
    if (loadingMe) return;
    if (meUnauthorized || profileUnauthorized) {
      guard.handleAuthFailure(form);
      return;
    }
    if (me && me.role !== "client") setLocation("/dashboard");
    if (!me && !meError) setLocation("/login");
  }, [loadingMe, me, meError, meUnauthorized, profileUnauthorized, setLocation, guard, form]);

  useEffect(() => {
    if (!profile) return;
    const l = profile.lead as any;
    const fromProfile = {
      name: profile.user.name ?? "",
      cpf: l.cpf ? maskCPF(l.cpf) : "",
      birthDate: l.birthDate ?? "",
      cidade: l.propertyCity ?? "",
      cidadeImovel: l.propertyCity ?? "",
      profissao: l.profession ?? "",
      carteiraAssinada: l.employmentType === "clt" || l.employmentType === "servidor_publico" ? "sim" : l.employmentType ? "nao" : "",
      income: brlFromNumber(l.income),
      informalIncome: brlFromNumber(l.informalIncome),
      maritalStatus: l.maritalStatus ?? "",
      propertyValue: brlFromNumber(l.propertyValue),
      propertyState: l.propertyState ?? "",
      spouseCpf: l.spouseCpf ? maskCPF(l.spouseCpf) : "",
      spouseName: l.spouseName ?? "",
      spouseBirthDate: l.spouseBirthDate ?? "",
      spouseCidade: "",
      spouseProfissao: l.spouseProfession ?? "",
      spouseIncome: brlFromNumber(l.spouseIncome),
      spouseInformalIncome: "",
    };
    const draft = guard.restoreDraft();
    if (draft) {
      setForm({ ...fromProfile, ...draft });
    } else {
      setForm(fromProfile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const setField = (key: keyof typeof form) => (val: string) => {
    setForm((f) => ({ ...f, [key]: val }));
    clearFieldError(key);
  };

  const setBRL = (key: keyof typeof form) => (raw: string) => {
    setForm((f) => ({ ...f, [key]: maskBRL(raw) }));
    clearFieldError(key);
  };

  const needsSpouse = form.maritalStatus === "casado" || form.maritalStatus === "uniao_estavel";

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = "Nome obrigatório";
    return e;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setErrFields(new Set());

    setSaving(true);
    try {
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
      const body: Record<string, any> = {
        name: form.name.trim(),
        birthDate: form.birthDate || null,
        profession: form.profissao.trim() || null,
        employmentType: form.carteiraAssinada === "sim" ? "clt" : form.carteiraAssinada === "nao" ? "autonomo" : null,
        income: parseBRL(form.income) || undefined,
        informalIncome: parseBRL(form.informalIncome) || null,
        maritalStatus: form.maritalStatus || null,
        propertyValue: parseBRL(form.propertyValue) || undefined,
        propertyCity: form.cidadeImovel.trim() || null,
        propertyState: form.propertyState || null,
      };

      if (needsSpouse) {
        body.spouseName = form.spouseName.trim() || null;
        body.spouseCpf = form.spouseCpf.replace(/\D/g, "") || null;
        body.spouseBirthDate = form.spouseBirthDate || null;
        body.spouseProfession = form.spouseProfissao.trim() || null;
        body.spouseIncome = parseBRL(form.spouseIncome) || null;
      } else {
        body.spouseName = null;
        body.spouseCpf = null;
        body.spouseBirthDate = null;
        body.spouseProfession = null;
        body.spouseIncome = null;
      }

      const resp = await fetch(`${BASE}/api/client/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (resp.status === 401) {
        guard.handleAuthFailure(form);
        return;
      }

      if (!resp.ok) {
        const j: { error?: unknown; fields?: unknown } = await resp
          .json()
          .catch(() => ({}));
        if (Array.isArray(j.fields)) {
          setErrFields(
            new Set(j.fields.filter((f): f is string => typeof f === "string")),
          );
        }
        toast({
          title: "Verifique os campos destacados",
          description:
            typeof j.error === "string" && j.error
              ? j.error
              : "Alguns dados não passaram na validação.",
        });
        return;
      }

      await queryClient.invalidateQueries({ queryKey: getGetClientProfileQueryKey() });
      toast({ title: "Dados salvos com sucesso!" });
    } catch {
      toast({ title: "Erro ao salvar", description: "Tente novamente." });
    } finally {
      setSaving(false);
    }
  };

  if (guard.sessionExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#07113A" }}>
        <div className="max-w-md w-full">
          <SessionExpiredBanner
            expired
            description="Sua sessão expirou. Faça login novamente — guardamos os dados que você estava preenchendo e retornamos eles para você."
            loginLabel="Fazer login para continuar"
            onLogin={() => guard.goToLogin(form)}
          />
        </div>
      </div>
    );
  }

  if (loadingMe || isLoading || !me || me.role !== "client") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07113A" }}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ClientLayout userName={me.name} activePage="meus-dados">
      {/* Tabs */}
      <div className="flex gap-0 mb-6 border-b border-gray-200">
        {[
          { key: "dados" as const, label: "Meus dados" },
          { key: "documentos" as const, label: "Meus documentos" },
          { key: "conta" as const, label: "Conta e segurança" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-[#0D1B8C] text-[#0D1B8C]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "documentos" && profile?.lead && (
        <ClientDocumentosTab lead={profile.lead} />
      )}

      {tab === "conta" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-500">Gerenciamento de senha em breve.</p>
        </div>
      )}

      {(guard.sessionExpired || guard.draftRestored) && (
        <div className="mb-4">
          <SessionExpiredBanner
            expired={guard.sessionExpired}
            draftRestored={guard.draftRestored}
            draftRestoredMessage="Recuperamos os valores que você tinha digitado antes da sessão expirar. Confira e clique em Salvar alterações."
            onLogin={() => guard.goToLogin(form)}
          />
        </div>
      )}

      {tab === "dados" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          {/* Row 1: CPF + Nome Receita Federal */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field
              label="CPF / CNPJ"
              value={form.cpf}
              readOnly
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome (Receita Federal)</label>
              <input
                type="text"
                readOnly
                placeholder="Preenchido automaticamente após consulta à base da Receita Federal"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-400 outline-none cursor-default"
              />
              <p className="text-xs text-gray-400 mt-1">Este campo será preenchido quando a integração com a Receita Federal estiver disponível.</p>
            </div>
          </div>

          {/* Row 2: Nome completo + Data de nascimento */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field
              label="Nome completo *"
              value={form.name}
              onChange={setField("name")}
              placeholder="Seu nome completo"
              error={errors.name}
              invalid={isInvalid("name")}
            />
            <Field
              label="Data de nascimento"
              value={form.birthDate}
              onChange={setField("birthDate")}
              type="date"
              hint="Opcional. Mínimo 18 anos se informada."
              invalid={isInvalid("birthDate")}
            />
          </div>

          {/* Row 3: Cidade de moradia + Cidade do imóvel */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field
              label="Cidade de moradia"
              value={form.cidade}
              onChange={setField("cidade")}
              placeholder="Selecione..."
            />
            <Field
              label="Cidade do imóvel"
              value={form.cidadeImovel}
              onChange={setField("cidadeImovel")}
              placeholder="Selecione..."
              invalid={isInvalid("cidadeImovel")}
            />
          </div>

          {/* Row 4: Profissão + Carteira assinada */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field
              label="Profissão"
              value={form.profissao}
              onChange={setField("profissao")}
              placeholder="Sua profissão"
              invalid={isInvalid("profissao")}
            />
            <RadioGroup
              label="Tem ou já teve mais de 3 anos de carteira assinada?"
              value={form.carteiraAssinada}
              onChange={setField("carteiraAssinada")}
              options={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }]}
              invalid={isInvalid("carteiraAssinada")}
            />
          </div>

          {/* Row 5: Renda formal + Renda informal */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field
              label="Renda formal (R$)"
              value={form.income}
              onChange={setBRL("income")}
              placeholder="0,00"
              invalid={isInvalid("income")}
            />
            <Field
              label="Renda informal (R$)"
              value={form.informalIncome}
              onChange={setBRL("informalIncome")}
              placeholder="0,00"
              invalid={isInvalid("informalIncome")}
            />
          </div>

          {/* Row 6: Estado civil */}
          <div className="grid sm:grid-cols-2 gap-4">
            <SelectField
              label="Estado civil"
              value={form.maritalStatus}
              onChange={setField("maritalStatus")}
              options={MARITAL_OPTIONS}
              invalid={isInvalid("maritalStatus")}
            />
            <SelectField
              label="UF do imóvel"
              value={form.propertyState}
              onChange={setField("propertyState")}
              options={BR_STATES.map((s) => ({ value: s, label: s }))}
              placeholder="UF"
              invalid={isInvalid("propertyState")}
            />
          </div>

          {/* ── Dados do cônjuge ─────────────────────────────────────── */}
          {needsSpouse && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-4">
              <p className="text-sm font-semibold text-gray-700">Dados do cônjuge</p>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field
                  label="CPF do cônjuge *"
                  value={form.spouseCpf}
                  onChange={(v) => {
                    setForm((f) => ({ ...f, spouseCpf: maskCPF(v) }));
                    clearFieldError("spouseCpf");
                  }}
                  placeholder="000.000.000-00"
                  invalid={isInvalid("spouseCpf")}
                />
                <Field
                  label="Nome do cônjuge *"
                  value={form.spouseName}
                  onChange={setField("spouseName")}
                  placeholder="Nome completo"
                  invalid={isInvalid("spouseName")}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field
                  label="Data de nascimento *"
                  value={form.spouseBirthDate}
                  onChange={setField("spouseBirthDate")}
                  type="date"
                  invalid={isInvalid("spouseBirthDate")}
                />
                <Field
                  label="Cidade de moradia *"
                  value={form.spouseCidade}
                  onChange={setField("spouseCidade")}
                  placeholder="Selecione..."
                />
              </div>

              <Field
                label="Profissão *"
                value={form.spouseProfissao}
                onChange={setField("spouseProfissao")}
                placeholder="Profissão do cônjuge"
                invalid={isInvalid("spouseProfissao")}
              />

              <div className="grid sm:grid-cols-2 gap-4">
                <Field
                  label="Renda formal (R$)"
                  value={form.spouseIncome}
                  onChange={setBRL("spouseIncome")}
                  placeholder="0,00"
                  invalid={isInvalid("spouseIncome")}
                />
                <Field
                  label="Renda informal (R$)"
                  value={form.spouseInformalIncome}
                  onChange={setBRL("spouseInformalIncome")}
                  placeholder="0,00"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setLocation("/portal")}
              className="px-5 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={guard.sessionExpired ? () => guard.goToLogin(form) : handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-60"
              style={{ background: "#0D1B8C" }}
            >
              {guard.sessionExpired
                ? "Fazer login para salvar"
                : saving
                ? "Salvando..."
                : "Salvar alterações"}
            </button>
          </div>
        </div>
      )}
    </ClientLayout>
  );
}
