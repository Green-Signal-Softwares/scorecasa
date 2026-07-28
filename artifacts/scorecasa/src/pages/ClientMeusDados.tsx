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
  normalizeCity,
  type UF,
} from "@workspace/cities-br";
import {
  User,
  Building2,
  Users,
  Briefcase,
  DollarSign,
  Calendar,
  Wallet,
  FileText,
} from "lucide-react";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { CityTierChip } from "@/components/CityTierChip";
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

// ── Components ────────────────────────────────────────────────────────────────

const Field = FormField;

function SelectField({
  label, value, onChange, options, placeholder, error, invalid, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
  error?: string; invalid?: boolean; disabled?: boolean;
}) {
  const isInvalid = !!(invalid || error);
  const labelCls = isInvalid ? "text-red-600" : "text-gray-700";
  const labelText = label.endsWith(" *") ? label.slice(0, -2) : label;
  const isRequired = label.endsWith(" *");
  const selectCls = isInvalid
    ? "w-full h-11 px-3 rounded-xl border-2 border-red-400 bg-red-50 text-red-700 text-sm outline-none focus:ring-2 focus:ring-red-200"
    : disabled
    ? "w-full h-11 px-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-400 text-sm cursor-not-allowed"
    : "w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 outline-none transition-all focus:border-[#0D1B8C] focus:ring-2 focus:ring-[#0D1B8C]/10 hover:border-gray-300";
  return (
    <div>
      <label className={`block text-sm font-medium mb-1.5 ${labelCls}`}>
        {labelText}{isRequired && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={isInvalid || undefined}
        disabled={disabled}
        className={selectCls}
      >
        <option value="">{placeholder ?? "Selecione..."}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function RadioGroup({
  label, value, onChange, options, error, invalid, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; error?: string; invalid?: boolean; hint?: string;
}) {
  const isInvalid = !!(invalid || error);
  const labelCls = isInvalid ? "text-red-600" : "text-gray-700";
  const labelTextR = label.endsWith(" *") ? label.slice(0, -2) : label;
  const isRequiredR = label.endsWith(" *");
  return (
    <div>
      <label className={`block text-sm font-medium mb-2 ${labelCls}`}>
        {labelTextR}{isRequiredR && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div
        className={`flex flex-wrap gap-2 ${ isInvalid ? "p-2 rounded-xl border border-red-300 bg-red-50" : ""}`}
        role="radiogroup"
        aria-invalid={isInvalid || undefined}
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
              value === o.value
                ? "bg-[#0D1B8C] text-white border-[#0D1B8C] shadow-sm"
                : isInvalid
                ? "bg-white text-red-700 border-red-300 hover:border-red-400"
                : "bg-white text-gray-700 border-gray-200 hover:border-[#0D1B8C]/40 hover:bg-[#F7F8FF]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint && <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function CityStateRow({
  cityLabel, uf, city, freeCity, onUf, onCity, onFreeCity, ufError, cityError, ufInvalid, cityInvalid,
}: {
  cityLabel: string;
  uf: string;
  city: string;
  freeCity: string;
  onUf: (v: string) => void;
  onCity: (v: string) => void;
  onFreeCity: (v: string) => void;
  ufError?: string;
  cityError?: string;
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
          label="Estado *"
          value={uf}
          onChange={onUf}
          options={UF_OPTIONS}
          placeholder="UF"
          error={ufError}
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
          error={cityError}
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
    setErrors((prev) => {
      const next = { ...prev };
      delete next[formKey];
      return next;
    });
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

  const needsSpouse = form.maritalStatus === "casado" || form.maritalStatus === "uniao_estavel";

  const setField = (key: keyof typeof form) => (val: string) => {
    setForm((f) => ({ ...f, [key]: val }));
    clearFieldError(key);

    const errText = validateField(key, val, key.startsWith("spouse") ? true : needsSpouse);
    if (errText) {
      setErrors((prev) => ({ ...prev, [key]: errText }));
    }
  };

  const setBRL = (key: keyof typeof form) => (raw: string) => {
    const masked = maskBRL(raw);
    setForm((f) => ({ ...f, [key]: masked }));
    clearFieldError(key);

    const errText = validateField(key, masked, key.startsWith("spouse") ? true : needsSpouse);
    if (errText) {
      setErrors((prev) => ({ ...prev, [key]: errText }));
    }
  };


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
    for (const key of Object.keys(form) as Array<keyof typeof form>) {
      const errText = validateField(key, form[key], key.startsWith("spouse") ? true : needsSpouse);
      if (errText) {
        e[key] = errText;
      }
    }

    if (!form.ufMoradia) {
      e.ufMoradia = "Selecione o estado de moradia.";
    }
    if (!form.cidadeMoradia) {
      e.cidadeMoradia = "Selecione a cidade de moradia.";
    } else if (form.cidadeMoradia === OUTRA_CIDADE) {
      if (!form.cidadeMoradiaFree.trim()) {
        e.cidadeMoradia = "Digite o nome do município de moradia.";
      } else if (form.cidadeMoradiaFree.trim().length < 2) {
        e.cidadeMoradia = "O nome do município deve ter pelo menos 2 caracteres.";
      } else if (form.cidadeMoradiaFree.trim().length > 80) {
        e.cidadeMoradia = "O nome do município deve ter no máximo 80 caracteres.";
      }
    }

    if (!form.ufImovel) {
      e.ufImovel = "Selecione o estado do imóvel.";
    }
    if (!form.cidadeImovel) {
      e.cidadeImovel = "Selecione a cidade do imóvel.";
    } else if (form.cidadeImovel === OUTRA_CIDADE) {
      if (!form.cidadeImovelFree.trim()) {
        e.cidadeImovel = "Digite o nome do município do imóvel.";
      } else if (form.cidadeImovelFree.trim().length < 2) {
        e.cidadeImovel = "O nome do município deve ter pelo menos 2 caracteres.";
      } else if (form.cidadeImovelFree.trim().length > 80) {
        e.cidadeImovel = "O nome do município deve ter no máximo 80 caracteres.";
      }
    }

    if (form.propertyInScorecasa === "sim" && !form.linkedPropertyId) {
      e.linkedPropertyId = "Selecione o imóvel pretendido do catálogo.";
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
          const apiFields = j.fields.filter((f): f is string => typeof f === "string");
          setErrFields(new Set(apiFields));

          const newErrors: Record<string, string> = {};
          for (const apiField of apiFields) {
            const formKey = FIELD_TO_FORM[apiField];
            if (formKey) {
              if (apiField === "birthDate" || apiField === "spouseBirthDate") {
                newErrors[formKey] = "A data deve ser válida e ter pelo menos 18 anos.";
              } else if (apiField === "spouseCpf") {
                newErrors[formKey] = "O CPF deve ter 11 dígitos e ser válido.";
              } else if (apiField === "income" || apiField === "propertyValue" || apiField === "informalIncome" || apiField === "spouseIncome") {
                newErrors[formKey] = "Insira um valor válido e não negativo.";
              } else if (apiField === "phone") {
                newErrors[formKey] = "Insira um telefone válido com DDD.";
              } else if (apiField === "name" || apiField === "spouseName") {
                newErrors[formKey] = "O nome deve ter entre 2 e 120 caracteres.";
              } else if (apiField === "profession" || apiField === "spouseProfession") {
                newErrors[formKey] = "A profissão deve ter entre 2 e 80 caracteres.";
              } else if (apiField === "residentCity" || apiField === "propertyCity") {
                newErrors[formKey] = "O nome do município deve ter entre 2 e 80 caracteres.";
              } else {
                newErrors[formKey] = "Dado inválido.";
              }
            }
          }
          setErrors((prev) => ({ ...prev, ...newErrors }));
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
        <div className="space-y-6">
          {/* Required legend */}
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <span className="text-red-500 font-bold">*</span>
            Campos obrigatórios
          </p>

          {/* CARD 1: Informações Pessoais */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-[#F7F8FF] to-white">
              <div className="w-8 h-8 rounded-lg bg-[#0D1B8C]/10 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-[#0D1B8C]" />
              </div>
              <h2 className="text-sm font-bold text-gray-900">Informações Pessoais</h2>
            </div>
            <div className="p-6 space-y-5">
            
            {/* CPF / Receita */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="CPF / CNPJ" value={form.cpf} readOnly icon={FileText} />
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

            {/* Nome / Nascimento */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Field
                label="Nome completo *"
                value={form.name}
                onChange={setField("name")}
                placeholder="Seu nome completo"
                error={errors.name}
                invalid={isInvalid("name") || !!errors.name}
                icon={User}
              />
              <Field
                label="Data de nascimento"
                value={form.birthDate}
                onChange={setField("birthDate")}
                type="date"
                hint="Opcional. Mínimo 18 anos se informada."
                error={errors.birthDate}
                invalid={isInvalid("birthDate") || !!errors.birthDate}
                icon={Calendar}
              />
            </div>

            {/* Cidade / UF Moradia */}
            <CityStateRow
              cityLabel="Cidade de moradia *"
              uf={form.ufMoradia}
              city={form.cidadeMoradia}
              freeCity={form.cidadeMoradiaFree}
              onUf={(v) => {
                setForm((f) => ({ ...f, ufMoradia: v, cidadeMoradia: "", cidadeMoradiaFree: "" }));
                clearFieldError("ufMoradia");
              }}
              onCity={(v) => setForm((f) => ({ ...f, cidadeMoradia: v, cidadeMoradiaFree: "" }))}
              onFreeCity={(v) => setForm((f) => ({ ...f, cidadeMoradiaFree: v }))}
              ufError={errors.ufMoradia}
              cityError={errors.cidadeMoradia}
              ufInvalid={isInvalid("ufMoradia") || !!errors.ufMoradia}
              cityInvalid={isInvalid("cidadeMoradia") || !!errors.cidadeMoradia}
            />

            {/* Profissão / CLT */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Field
                label="Profissão *"
                value={form.profissao}
                onChange={setField("profissao")}
                placeholder="Sua profissão"
                error={errors.profissao}
                invalid={isInvalid("profissao") || !!errors.profissao}
                icon={Briefcase}
              />
              <RadioGroup
                label="Tem ou já teve mais de 3 anos de carteira assinada? *"
                value={form.carteiraAssinada}
                onChange={setField("carteiraAssinada")}
                options={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }]}
                error={errors.carteiraAssinada}
                invalid={isInvalid("carteiraAssinada") || !!errors.carteiraAssinada}
              />
            </div>

            {/* Rendas */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Field
                label="Renda formal (R$) *"
                value={form.income}
                onChange={setBRL("income")}
                placeholder="0,00"
                error={errors.income}
                invalid={isInvalid("income") || !!errors.income}
                icon={DollarSign}
              />
              <Field
                label="Renda informal (R$)"
                value={form.informalIncome}
                onChange={setBRL("informalIncome")}
                placeholder="0,00"
                error={errors.informalIncome}
                invalid={isInvalid("informalIncome") || !!errors.informalIncome}
                icon={DollarSign}
              />
            </div>

            {/* Estado civil */}
            <div className="grid sm:grid-cols-2 gap-4">
              <SelectField
                label="Estado civil *"
                value={form.maritalStatus}
                onChange={setField("maritalStatus")}
                options={MARITAL_OPTIONS}
                error={errors.maritalStatus}
                invalid={isInvalid("maritalStatus") || !!errors.maritalStatus}
              />
            </div>
          </div>{/* end card 1 content */}
          </div>{/* end card 1 */}

          {/* CARD 2: Imóvel Pretendido e Financiamento */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-[#F7F8FF] to-white">
              <div className="w-8 h-8 rounded-lg bg-[#0D1B8C]/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-[#0D1B8C]" />
              </div>
              <h2 className="text-sm font-bold text-gray-900">Imóvel Pretendido e Renda</h2>
            </div>
            <div className="p-6 space-y-5">

            <div className="grid sm:grid-cols-2 gap-4">
              <Field
                label="Valor do imóvel pretendido (R$) *"
                value={form.propertyValue}
                onChange={setBRL("propertyValue")}
                placeholder="0,00"
                error={errors.propertyValue}
                invalid={isInvalid("propertyValue") || !!errors.propertyValue}
                icon={DollarSign}
              />
            </div>

            <div className="rounded-xl border border-gray-100 bg-[#F7F8FF] p-5 space-y-4">
              <p className="text-sm font-semibold text-[#0D1B8C]">Localização e Vínculo</p>

              <CityStateRow
                cityLabel="Cidade do imóvel *"
                uf={form.ufImovel}
                city={form.cidadeImovel}
                freeCity={form.cidadeImovelFree}
                onUf={(v) => {
                  setForm((f) => ({
                    ...f, ufImovel: v, cidadeImovel: "", cidadeImovelFree: "",
                    linkedPropertyId: "",
                  }));
                  clearFieldError("ufImovel");
                }}
                onCity={(v) => setForm((f) => ({ ...f, cidadeImovel: v, cidadeImovelFree: "", linkedPropertyId: "" }))}
                onFreeCity={(v) => setForm((f) => ({ ...f, cidadeImovelFree: v }))}
                ufError={errors.ufImovel}
                cityError={errors.cidadeImovel}
                ufInvalid={isInvalid("ufImovel") || !!errors.ufImovel}
                cityInvalid={isInvalid("cidadeImovel") || !!errors.cidadeImovel}
              />

              <RadioGroup
                label="Você já tem outro imóvel neste município? *"
                value={form.alreadyOwnsProperty}
                onChange={(v) => setForm((f) => ({ ...f, alreadyOwnsProperty: v as any }))}
                options={[{ value: "nao", label: "Não" }, { value: "sim", label: "Sim" }]}
                error={errors.alreadyOwnsProperty}
                invalid={isInvalid("alreadyOwnsProperty") || !!errors.alreadyOwnsProperty}
                hint="Pelo regulamento do MCMV (FAR/PMCMV), titulares que já possuem imóvel no mesmo município ficam impedidos de participar."
              />

              {form.alreadyOwnsProperty === "sim" && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <p className="text-xs text-amber-800">
                    <strong>Atenção:</strong> Você não atende a um dos requisitos do MCMV. Vamos analisar o seu financiamento como SBPE / Caixa tradicional — sem o subsídio.
                  </p>
                </div>
              )}

              <RadioGroup
                label="O imóvel está no ScoreCasa Imóveis? *"
                value={form.propertyInScorecasa}
                onChange={(v) => setForm((f) => ({
                  ...f,
                  propertyInScorecasa: v as any,
                  linkedPropertyId: v === "nao" ? "" : f.linkedPropertyId,
                }))}
                options={[{ value: "nao", label: "Não" }, { value: "sim", label: "Sim" }]}
                error={errors.propertyInScorecasa}
                invalid={isInvalid("propertyInScorecasa") || !!errors.propertyInScorecasa}
                hint="Vincular ao catálogo agiliza a análise e abre acesso a fotos, condições e contato com o corretor."
              />

              {form.propertyInScorecasa === "sim" && (() => {
                const selected = propertyOptions.find((o) => o.value === form.linkedPropertyId);
                if (selected) {
                  return (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex gap-3 items-center" data-testid="selected-property-card">
                      {selected.imageUrl ? (
                        <img src={selected.imageUrl} alt={selected.title} className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 text-xs flex-shrink-0">Sem foto</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{selected.title}</p>
                        <p className="text-xs text-gray-600">{selected.city}/{selected.state}</p>
                        <p className="text-sm font-semibold text-emerald-700 mt-0.5">R$ {Number(selected.price).toLocaleString("pt-BR")}</p>
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
                          onClick={() => setForm((f) => ({ ...f, linkedPropertyId: "", propertyInScorecasa: "nao" }))}
                          className="text-xs px-2.5 py-1 rounded border border-red-200 bg-white text-red-600 hover:bg-red-50"
                          data-testid="button-remover-imovel"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Escolha o imóvel</p>
                    {!form.ufImovel ? (
                      <p className="text-sm text-gray-500 italic">Escolha a UF do imóvel acima para listar os disponíveis.</p>
                    ) : propertyOptions.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">Nenhum imóvel disponível para essa cidade/UF no momento.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1" data-testid="property-catalog">
                        {propertyOptions.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, linkedPropertyId: opt.value }))}
                            className="text-left rounded-lg border border-gray-200 bg-white hover:border-emerald-400 hover:shadow-sm transition p-2 flex gap-3 items-center"
                            data-testid={`property-option-${opt.value}`}
                          >
                            {opt.imageUrl ? (
                              <img src={opt.imageUrl} alt={opt.title} className="w-16 h-16 rounded object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-16 h-16 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-[10px] flex-shrink-0">Sem foto</div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{opt.title}</p>
                              <p className="text-xs text-gray-600 truncate">{opt.city}/{opt.state}</p>
                              <p className="text-sm font-semibold text-emerald-700">R$ {Number(opt.price).toLocaleString("pt-BR")}</p>
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
            </div>{/* end card 2 content */}
          </div>{/* end card 2 */}

          {/* CARD 3: Dados do Cônjuge */}
          {needsSpouse && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-rose-50 to-white">
                <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-rose-600" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">Dados do Cônjuge / Companheiro</h2>
              </div>
              <div className="p-6 space-y-5">

              <div className="grid sm:grid-cols-2 gap-4">
                <Field
                  label="CPF do cônjuge *"
                  value={form.spouseCpf}
                  onChange={(v) => {
                    setForm((f) => ({ ...f, spouseCpf: maskCPF(v) }));
                    clearFieldError("spouseCpf");
                    const errText = validateField("spouseCpf", maskCPF(v), true);
                    if (errText) setErrors((prev) => ({ ...prev, spouseCpf: errText }));
                  }}
                  placeholder="000.000.000-00"
                  error={errors.spouseCpf}
                  invalid={isInvalid("spouseCpf") || !!errors.spouseCpf}
                  icon={FileText}
                />
                <Field
                  label="Nome do cônjuge *"
                  value={form.spouseName}
                  onChange={setField("spouseName")}
                  placeholder="Nome completo"
                  error={errors.spouseName}
                  invalid={isInvalid("spouseName") || !!errors.spouseName}
                  icon={User}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field
                  label="Data de nascimento *"
                  value={form.spouseBirthDate}
                  onChange={setField("spouseBirthDate")}
                  type="date"
                  error={errors.spouseBirthDate}
                  invalid={isInvalid("spouseBirthDate") || !!errors.spouseBirthDate}
                  icon={Calendar}
                />
                <Field
                  label="Profissão *"
                  value={form.spouseProfissao}
                  onChange={setField("spouseProfissao")}
                  placeholder="Profissão do cônjuge"
                  error={errors.spouseProfissao}
                  invalid={isInvalid("spouseProfissao") || !!errors.spouseProfissao}
                  icon={Briefcase}
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
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setLocation("/portal")}
              className="px-5 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={guard.sessionExpired ? () => guard.goToLogin(form) : handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 shadow-md shadow-[#0D1B8C]/20 hover:shadow-lg hover:shadow-[#0D1B8C]/30 active:scale-[0.99]"
              style={{ background: "linear-gradient(135deg, #0D1B8C 0%, #1A2FB0 100%)" }}
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

function validateField(name: string, value: string, needsSpouse?: boolean): string | null {
  const v = value.trim();
  if (name === "name") {
    if (!v) return "Por favor, insira seu nome completo.";
    if (v.length < 2) return "O nome completo deve ter pelo menos 2 caracteres.";
    if (v.length > 120) return "O nome completo deve ter no máximo 120 caracteres.";
  }
  if (name === "birthDate") {
    if (v) {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return "Por favor, insira uma data de nascimento válida.";
      const year = d.getUTCFullYear();
      if (year < 1900 || year > new Date().getUTCFullYear()) {
        return "Por favor, insira um ano plausível (a partir de 1900).";
      }
      const today = new Date();
      let age = today.getUTCFullYear() - d.getUTCFullYear();
      const m = today.getUTCMonth() - d.getUTCMonth();
      if (m < 0 || (m === 0 && today.getUTCDate() < d.getUTCDate())) age--;
      if (age < 18) return "Ops! Você precisa ter pelo menos 18 anos.";
      if (age > 120) return "Por favor, insira uma idade válida.";
    }
  }
  if (name === "profissao") {
    if (!v) return "Por favor, insira sua profissão.";
    if (v.length < 2) return "A profissão deve ter pelo menos 2 caracteres.";
    if (v.length > 80) return "A profissão deve ter no máximo 80 caracteres.";
  }
  if (name === "carteiraAssinada") {
    if (!v) return "Por favor, responda se possui ou já possuiu 3 anos ou mais de carteira assinada.";
  }
  if (name === "maritalStatus") {
    if (!v) return "Por favor, selecione seu estado civil.";
  }
  if (name === "propertyValue") {
    if (!v) return "Por favor, insira o valor do imóvel pretendido.";
    const num = parseBRL(value);
    if (num <= 0) return "O valor do imóvel deve ser maior que R$ 0,00.";
  }
  if (name === "income") {
    if (!v) return "Por favor, insira sua renda formal.";
    const num = parseBRL(value);
    if (num < 0) return "A renda formal não pode ser menor que R$ 0,00.";
  }
  if (name === "informalIncome") {
    if (v) {
      const num = parseBRL(value);
      if (num < 0) return "A renda informal não pode ser menor que R$ 0,00.";
    }
  }
  if (name === "alreadyOwnsProperty") {
    if (!v) return "Por favor, responda se já possui outro imóvel residencial no mesmo município.";
  }
  if (name === "propertyInScorecasa") {
    if (!v) return "Por favor, responda se o imóvel está anunciado no ScoreCasa Imóveis.";
  }
  if (needsSpouse) {
    if (name === "spouseName") {
      if (!v) return "Por favor, insira o nome completo do cônjuge.";
      if (v.length < 2) return "O nome completo do cônjuge deve ter pelo menos 2 caracteres.";
      if (v.length > 120) return "O nome completo do cônjuge deve ter no máximo 120 caracteres.";
    }
    if (name === "spouseCpf") {
      if (!v) return "Por favor, insira o CPF do cônjuge.";
      const digits = v.replace(/\D/g, "");
      if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) {
        return "Por favor, insira um CPF válido com 11 dígitos.";
      }
    }
    if (name === "spouseBirthDate") {
      if (!v) return "Por favor, insira a data de nascimento do cônjuge.";
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return "Por favor, insira uma data válida.";
      const year = d.getUTCFullYear();
      if (year < 1900 || year > new Date().getUTCFullYear()) {
        return "Por favor, insira um ano plausível (a partir de 1900).";
      }
      const today = new Date();
      let age = today.getUTCFullYear() - d.getUTCFullYear();
      const m = today.getUTCMonth() - d.getUTCMonth();
      if (m < 0 || (m === 0 && today.getUTCDate() < d.getUTCDate())) age--;
      if (age < 18) return "Ops! O cônjuge precisa ter pelo menos 18 anos.";
      if (age > 120) return "Por favor, insira uma idade válida para o cônjuge.";
    }
    if (name === "spouseProfissao") {
      if (!v) return "Por favor, insira a profissão do cônjuge.";
      if (v.length < 2) return "A profissão do cônjuge deve ter pelo menos 2 caracteres.";
      if (v.length > 80) return "A profissão do cônjuge deve ter no máximo 80 caracteres.";
    }
    if (name === "spouseIncome") {
      if (v) {
        const num = parseBRL(value);
        if (num < 0) return "A renda do cônjuge não pode ser menor que R$ 0,00.";
      }
    }
  }
  return null;
}
