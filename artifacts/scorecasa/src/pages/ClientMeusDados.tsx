import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import {
  useGetMe, getGetMeQueryKey,
  useGetClientProfile, getGetClientProfileQueryKey,
  useGetProperties,
  ApiError,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  UFS,
  UF_NAMES,
  citiesOf,
  cityTier,
  normalizeCity,
  MCMV_2026_BY_TIER,
  type MCMVTier,
  type UF,
} from "@workspace/cities-br";
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

const UF_OPTIONS = UFS.map((s) => ({ value: s, label: `${s} — ${UF_NAMES[s]}` }));

// Sentinel: cidade fora do dataset embarcado (cai em tier E no MCMV).
const OUTRA_CIDADE = "__outra__";

const TIER_LABEL: Record<MCMVTier, string> = {
  A: "Grande metrópole / RM SP-RJ / DF",
  B: "Metrópole / RM acima de 1 milhão",
  C: "Capital regional ou cidade de 250 mil a 1 milhão",
  D: "Cidade média (100 mil a 250 mil)",
  E: "Cidade pequena ou município sem cadastro",
};

const TIER_CHIP_STYLE: Record<MCMVTier, string> = {
  A: "bg-emerald-50 border-emerald-200 text-emerald-800",
  B: "bg-emerald-50 border-emerald-200 text-emerald-800",
  C: "bg-sky-50 border-sky-200 text-sky-800",
  D: "bg-amber-50 border-amber-200 text-amber-800",
  E: "bg-amber-50 border-amber-200 text-amber-800",
};

function formatBRLShort(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

/** Chip que mostra o tier MCMV e os tetos vigentes para o município escolhido,
 *  com tooltip explicando como o teto é calculado. */
function CityTierChip({ uf, city }: { uf: string; city: string }) {
  const tier = cityTier(uf, city);
  const limits = MCMV_2026_BY_TIER[tier];
  const tooltip =
    "O teto MCMV depende do porte do município: capitais e regiões " +
    "metropolitanas (A/B) têm o maior teto; capitais regionais e cidades " +
    "entre 250 mil e 1 milhão (C) vêm em seguida; cidades médias (D) e " +
    "pequenas ou sem cadastro (E) têm o teto mais restrito.";
  return (
    <div
      className={`mt-2 rounded-lg border px-3 py-2 text-xs ${TIER_CHIP_STYLE[tier]}`}
      data-testid="city-tier-chip"
    >
      <div className="flex items-start gap-2">
        <span className="font-semibold whitespace-nowrap">
          MCMV Tier {tier}
        </span>
        <span className="opacity-70">·</span>
        <span className="flex-1">
          <span className="font-medium">{TIER_LABEL[tier]}</span>
          <span className="block mt-0.5 opacity-90">
            Teto Faixas 1 e 2: <strong>{formatBRLShort(limits.capFaixa12)}</strong>
            {" · "}
            Faixa 3: <strong>{formatBRLShort(limits.capFaixa3)}</strong>
          </span>
        </span>
        <span
          className="cursor-help opacity-70 hover:opacity-100"
          title={tooltip}
          aria-label="Como esse teto é calculado?"
        >
          ⓘ
        </span>
      </div>
    </div>
  );
}

// ── Components ────────────────────────────────────────────────────────────────

const Field = FormField;

function SelectField({
  label, value, onChange, options, placeholder, invalid, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
  invalid?: boolean; disabled?: boolean;
}) {
  const labelCls = invalid ? "text-red-600" : "text-gray-700";
  const baseCls = "w-full px-3 py-2.5 rounded-lg border text-sm outline-none";
  const selectCls = invalid
    ? `${baseCls} border-red-500 bg-red-50 text-red-700 focus:ring-2 focus:ring-red-300 focus:border-red-500`
    : disabled
    ? `${baseCls} border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed`
    : `${baseCls} border-gray-200 bg-white focus:border-[#0D1B8C] focus:ring-1 focus:ring-[#0D1B8C]/20 text-gray-700`;
  return (
    <div>
      <label className={`block text-sm font-medium mb-1 ${labelCls}`}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        className={selectCls}
      >
        <option value="">{placeholder ?? "Selecione..."}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function RadioGroup({
  label, value, onChange, options, invalid, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; invalid?: boolean; hint?: string;
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
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

/** Combobox UF + Cidade lado a lado, com lista filtrada por UF do dataset
 *  `@workspace/cities-br`. Quando o cliente escolhe "Outro município" mostramos
 *  input livre — a cidade ainda é salva, mas cai automaticamente na
 *  classificação D do MCMV (teto mais restrito). */
function CityStateRow({
  cityLabel, uf, city, freeCity, onUf, onCity, onFreeCity, ufInvalid, cityInvalid,
}: {
  cityLabel: string;
  uf: string;
  city: string;
  /** Texto livre quando city === OUTRA_CIDADE. */
  freeCity: string;
  onUf: (v: string) => void;
  onCity: (v: string) => void;
  onFreeCity: (v: string) => void;
  ufInvalid?: boolean;
  cityInvalid?: boolean;
}) {
  const cityList = useMemo(
    () => (uf ? citiesOf(uf as UF).map((c) => ({ value: c.name, label: c.name })) : []),
    [uf],
  );
  const options = [...cityList, { value: OUTRA_CIDADE, label: "Outro município..." }];
  const showFree = city === OUTRA_CIDADE;
  return (
    <div className="grid sm:grid-cols-3 gap-4">
      <div className="sm:col-span-1">
        <SelectField
          label="Estado"
          value={uf}
          onChange={onUf}
          options={UF_OPTIONS}
          placeholder="UF"
          invalid={ufInvalid}
        />
      </div>
      <div className="sm:col-span-2">
        <SelectField
          label={cityLabel}
          value={city}
          onChange={onCity}
          options={options}
          placeholder={uf ? "Selecione a cidade..." : "Escolha primeiro a UF"}
          invalid={cityInvalid}
          disabled={!uf}
        />
        {showFree && (
          <input
            type="text"
            value={freeCity}
            onChange={(e) => onFreeCity(e.target.value)}
            placeholder="Digite o nome do município"
            className="mt-2 w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:border-[#0D1B8C] focus:ring-1 focus:ring-[#0D1B8C]/20 text-gray-700"
          />
        )}
        {showFree && (
          <p className="text-xs text-amber-600 mt-1">
            Município fora da nossa base curada — o MCMV usará o teto mais
            restrito (R$ 230.000 nas faixas 1 e 2).
          </p>
        )}
        {uf && city && (city !== OUTRA_CIDADE || freeCity.trim()) && (
          <CityTierChip
            uf={uf}
            city={city === OUTRA_CIDADE ? freeCity.trim() : city}
          />
        )}
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

  const initialTab =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "documentos"
      ? "documentos"
      : "dados";
  const [tab, setTab] = useState<"dados" | "documentos" | "conta">(initialTab as any);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errFields, setErrFields] = useState<Set<string>>(new Set());

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
    propertyState: "ufImovel",
    residentCity: "cidadeMoradia",
    residentState: "ufMoradia",
    alreadyOwnsPropertyInPropertyCity: "alreadyOwnsProperty",
    linkedPropertyId: "linkedPropertyId",
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
    birthDate: "", profissao: "",
    // moradia
    ufMoradia: "", cidadeMoradia: "", cidadeMoradiaFree: "",
    // imóvel pretendido
    ufImovel: "", cidadeImovel: "", cidadeImovelFree: "",
    carteiraAssinada: "", income: "", informalIncome: "", maritalStatus: "",
    propertyValue: "",
    // perguntas novas
    alreadyOwnsProperty: "" as "" | "sim" | "nao",
    propertyInScorecasa: "" as "" | "sim" | "nao",
    linkedPropertyId: "" as "" | string,
    // cônjuge
    spouseCpf: "", spouseName: "", spouseBirthDate: "",
    spouseUfMoradia: "", spouseCidadeMoradia: "", spouseCidadeMoradiaFree: "",
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

  // Reconcilia cidade salva vs dataset: se a cidade existir no dataset, é
  // selecionada como opção da lista; senão vira "Outro município..." com
  // texto livre preenchido.
  function resolveCity(uf: string | null | undefined, city: string | null | undefined) {
    if (!uf || !city) return { dropdown: "", free: "" };
    const list = citiesOf(uf as UF);
    const match = list.find((c) => normalizeCity(c.name) === normalizeCity(city));
    if (match) return { dropdown: match.name, free: "" };
    return { dropdown: OUTRA_CIDADE, free: city };
  }

  useEffect(() => {
    if (!profile) return;
    const l = profile.lead as any;
    const moradia = resolveCity(l.residentState, l.residentCity);
    const imovel = resolveCity(l.propertyState, l.propertyCity);
    const fromProfile = {
      name: profile.user.name ?? "",
      cpf: l.cpf ? maskCPF(l.cpf) : "",
      birthDate: l.birthDate ?? "",
      profissao: l.profession ?? "",
      ufMoradia: l.residentState ?? "",
      cidadeMoradia: moradia.dropdown,
      cidadeMoradiaFree: moradia.free,
      ufImovel: l.propertyState ?? "",
      cidadeImovel: imovel.dropdown,
      cidadeImovelFree: imovel.free,
      carteiraAssinada:
        l.employmentType === "clt" || l.employmentType === "servidor_publico"
          ? "sim"
          : l.employmentType
          ? "nao"
          : "",
      income: brlFromNumber(l.income),
      informalIncome: brlFromNumber(l.informalIncome),
      maritalStatus: l.maritalStatus ?? "",
      propertyValue: brlFromNumber(l.propertyValue),
      alreadyOwnsProperty: (l.alreadyOwnsPropertyInPropertyCity === true
        ? "sim"
        : l.alreadyOwnsPropertyInPropertyCity === false
        ? "nao"
        : "") as "" | "sim" | "nao",
      propertyInScorecasa: (l.linkedPropertyId != null ? "sim" : "") as "" | "sim" | "nao",
      linkedPropertyId: l.linkedPropertyId != null ? String(l.linkedPropertyId) : "",
      spouseCpf: l.spouseCpf ? maskCPF(l.spouseCpf) : "",
      spouseName: l.spouseName ?? "",
      spouseBirthDate: l.spouseBirthDate ?? "",
      spouseUfMoradia: "",
      spouseCidadeMoradia: "",
      spouseCidadeMoradiaFree: "",
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

  // Resolve cidade efetiva (dropdown | livre) para o cônjuge/moradia/imóvel.
  function effectiveCity(dropdown: string, free: string): string {
    if (dropdown === OUTRA_CIDADE) return free.trim();
    return dropdown.trim();
  }

  // ── Seletor de imóvel ScoreCasa (filtrado por UF/cidade) ──────────────────
  // Mostra apenas imóveis disponíveis na mesma UF do imóvel pretendido.
  // Filtramos a cidade no client porque GetPropertiesParams suporta `city`
  // (uma string só) — manter aqui evita acoplar a busca a uma normalização
  // específica do server.
  const propertiesQueryEnabled =
    form.propertyInScorecasa === "sim" && !!form.ufImovel;
  const { data: properties } = useGetProperties(
    undefined,
    {
      query: {
        queryKey: ["properties", "linkPicker"],
        enabled: propertiesQueryEnabled,
        staleTime: 60_000,
      },
    },
  );
  const propertyOptions = useMemo(() => {
    if (!properties) return [];
    const ufFilter = form.ufImovel;
    const cidadeAlvo = effectiveCity(form.cidadeImovel, form.cidadeImovelFree);
    return properties
      .filter((p: any) => p.status === "available" || p.status == null)
      .filter((p: any) => !ufFilter || p.state === ufFilter)
      .filter((p: any) => !cidadeAlvo || normalizeCity(p.city ?? "") === normalizeCity(cidadeAlvo))
      .map((p: any) => ({
        value: String(p.id),
        label: `${p.title} — ${p.city}/${p.state} (R$ ${Number(p.price).toLocaleString("pt-BR")})`,
        title: p.title,
        price: p.price,
        city: p.city,
        state: p.state,
        imageUrl: p.imageUrl ?? null,
      }));
  }, [properties, form.ufImovel, form.cidadeImovel, form.cidadeImovelFree]);

  // Quando o cliente marca "Sim, está no ScoreCasa" e escolhe um imóvel,
  // sincroniza propertyValue/cidade/uf a partir do imóvel.
  useEffect(() => {
    if (form.propertyInScorecasa !== "sim" || !form.linkedPropertyId) return;
    const sel = propertyOptions.find((o) => o.value === form.linkedPropertyId);
    if (!sel) return;
    setForm((f) => ({
      ...f,
      propertyValue: brlFromNumber(sel.price),
      ufImovel: sel.state,
      cidadeImovel: sel.city,
      cidadeImovelFree: "",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.linkedPropertyId, form.propertyInScorecasa]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = "Nome obrigatório";
    if (form.cidadeImovel === OUTRA_CIDADE && !form.cidadeImovelFree.trim()) {
      e.cidadeImovel = "Digite o nome do município do imóvel";
    }
    if (form.cidadeMoradia === OUTRA_CIDADE && !form.cidadeMoradiaFree.trim()) {
      e.cidadeMoradia = "Digite o nome do município de moradia";
    }
    if (form.propertyInScorecasa === "sim" && !form.linkedPropertyId) {
      e.linkedPropertyId = "Escolha o imóvel do ScoreCasa Imóveis";
    }
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
      const cidadeImovelFinal = effectiveCity(form.cidadeImovel, form.cidadeImovelFree);
      const cidadeMoradiaFinal = effectiveCity(form.cidadeMoradia, form.cidadeMoradiaFree);

      const body: Record<string, any> = {
        name: form.name.trim(),
        birthDate: form.birthDate || null,
        profession: form.profissao.trim() || null,
        employmentType: form.carteiraAssinada === "sim" ? "clt" : form.carteiraAssinada === "nao" ? "autonomo" : null,
        income: parseBRL(form.income) || undefined,
        informalIncome: parseBRL(form.informalIncome) || null,
        maritalStatus: form.maritalStatus || null,
        propertyValue: parseBRL(form.propertyValue) || undefined,
        propertyCity: cidadeImovelFinal || null,
        propertyState: form.ufImovel || null,
        residentCity: cidadeMoradiaFinal || null,
        residentState: form.ufMoradia || null,
        alreadyOwnsPropertyInPropertyCity:
          form.alreadyOwnsProperty === "sim"
            ? true
            : form.alreadyOwnsProperty === "nao"
            ? false
            : null,
        linkedPropertyId:
          form.propertyInScorecasa === "sim" && form.linkedPropertyId
            ? parseInt(form.linkedPropertyId, 10)
            : null,
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
          { key: "documentos" as const, label: "Meus Documentos / Meu Financiamento" },
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
            <Field label="CPF / CNPJ" value={form.cpf} readOnly />
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

          {/* Row 3: Estado + Cidade de moradia */}
          <CityStateRow
            cityLabel="Cidade de moradia"
            uf={form.ufMoradia}
            city={form.cidadeMoradia}
            freeCity={form.cidadeMoradiaFree}
            onUf={(v) => {
              setForm((f) => ({ ...f, ufMoradia: v, cidadeMoradia: "", cidadeMoradiaFree: "" }));
              clearFieldError("ufMoradia");
            }}
            onCity={(v) => setForm((f) => ({ ...f, cidadeMoradia: v, cidadeMoradiaFree: "" }))}
            onFreeCity={(v) => setForm((f) => ({ ...f, cidadeMoradiaFree: v }))}
            ufInvalid={isInvalid("ufMoradia")}
            cityInvalid={isInvalid("cidadeMoradia") || !!errors.cidadeMoradia}
          />

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
            <Field
              label="Valor do imóvel pretendido (R$)"
              value={form.propertyValue}
              onChange={setBRL("propertyValue")}
              placeholder="0,00"
              invalid={isInvalid("propertyValue")}
            />
          </div>

          {/* ── Imóvel pretendido ──────────────────────────────────── */}
          <div className="rounded-xl border border-gray-200 bg-[#F7F8FF] p-5 space-y-4">
            <p className="text-sm font-semibold text-[#0D1B8C]">Imóvel pretendido</p>

            <CityStateRow
              cityLabel="Cidade do imóvel"
              uf={form.ufImovel}
              city={form.cidadeImovel}
              freeCity={form.cidadeImovelFree}
              onUf={(v) => {
                setForm((f) => ({
                  ...f, ufImovel: v, cidadeImovel: "", cidadeImovelFree: "",
                  // Trocar UF invalida o imóvel vinculado.
                  linkedPropertyId: "",
                }));
                clearFieldError("ufImovel");
              }}
              onCity={(v) => setForm((f) => ({ ...f, cidadeImovel: v, cidadeImovelFree: "", linkedPropertyId: "" }))}
              onFreeCity={(v) => setForm((f) => ({ ...f, cidadeImovelFree: v }))}
              ufInvalid={isInvalid("ufImovel")}
              cityInvalid={isInvalid("cidadeImovel") || !!errors.cidadeImovel}
            />

            <RadioGroup
              label="Você já tem outro imóvel neste município?"
              value={form.alreadyOwnsProperty}
              onChange={(v) => setForm((f) => ({ ...f, alreadyOwnsProperty: v as any }))}
              options={[{ value: "nao", label: "Não" }, { value: "sim", label: "Sim" }]}
              invalid={isInvalid("alreadyOwnsProperty")}
              hint="Pelo regulamento do MCMV (FAR/PMCMV), titulares que já possuem imóvel no mesmo município ficam impedidos de participar."
            />

            {form.alreadyOwnsProperty === "sim" && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                <p className="text-xs text-amber-800">
                  <strong>Atenção:</strong> Você não atende a um dos requisitos do
                  MCMV. Vamos analisar o seu financiamento como SBPE / Caixa
                  tradicional — sem o subsídio.
                </p>
              </div>
            )}

            <RadioGroup
              label="O imóvel está no ScoreCasa Imóveis?"
              value={form.propertyInScorecasa}
              onChange={(v) => setForm((f) => ({
                ...f,
                propertyInScorecasa: v as any,
                linkedPropertyId: v === "nao" ? "" : f.linkedPropertyId,
              }))}
              options={[{ value: "nao", label: "Não" }, { value: "sim", label: "Sim" }]}
              hint="Vincular ao catálogo agiliza a análise e abre acesso a fotos, condições e contato com o corretor."
            />

            {form.propertyInScorecasa === "sim" && (() => {
              const selected = propertyOptions.find((o) => o.value === form.linkedPropertyId);
              // Imóvel já escolhido → card resumido com Trocar/Remover.
              if (selected) {
                return (
                  <div
                    className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex gap-3 items-center"
                    data-testid="selected-property-card"
                  >
                    {selected.imageUrl ? (
                      <img
                        src={selected.imageUrl}
                        alt={selected.title}
                        className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 text-xs flex-shrink-0">
                        Sem foto
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{selected.title}</p>
                      <p className="text-xs text-gray-600">{selected.city}/{selected.state}</p>
                      <p className="text-sm font-semibold text-emerald-700 mt-0.5">
                        R$ {Number(selected.price).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, linkedPropertyId: "" }))}
                        className="text-xs px-2.5 py-1 rounded border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100"
                        data-testid="button-trocar-imovel"
                      >
                        Trocar
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({
                          ...f,
                          linkedPropertyId: "",
                          propertyInScorecasa: "nao",
                        }))}
                        className="text-xs px-2.5 py-1 rounded border border-red-200 bg-white text-red-600 hover:bg-red-50"
                        data-testid="button-remover-imovel"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                );
              }
              // Nenhum escolhido ainda → grid de cards selecionáveis (catálogo).
              return (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Escolha o imóvel</p>
                  {!form.ufImovel ? (
                    <p className="text-sm text-gray-500 italic">
                      Escolha a UF do imóvel acima para listar os disponíveis.
                    </p>
                  ) : propertyOptions.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">
                      Nenhum imóvel disponível para essa cidade/UF no momento.
                    </p>
                  ) : (
                    <div
                      className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1"
                      data-testid="property-catalog"
                    >
                      {propertyOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, linkedPropertyId: opt.value }))}
                          className="text-left rounded-lg border border-gray-200 bg-white hover:border-emerald-400 hover:shadow-sm transition p-2 flex gap-3 items-center"
                          data-testid={`property-option-${opt.value}`}
                        >
                          {opt.imageUrl ? (
                            <img
                              src={opt.imageUrl}
                              alt={opt.title}
                              className="w-16 h-16 rounded object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-[10px] flex-shrink-0">
                              Sem foto
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{opt.title}</p>
                            <p className="text-xs text-gray-600 truncate">{opt.city}/{opt.state}</p>
                            <p className="text-sm font-semibold text-emerald-700">
                              R$ {Number(opt.price).toLocaleString("pt-BR")}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {errors.linkedPropertyId && (
                    <p className="text-xs text-red-600 mt-1">{errors.linkedPropertyId}</p>
                  )}
                </div>
              );
            })()}
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
                  label="Profissão *"
                  value={form.spouseProfissao}
                  onChange={setField("spouseProfissao")}
                  placeholder="Profissão do cônjuge"
                  invalid={isInvalid("spouseProfissao")}
                />
              </div>

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
