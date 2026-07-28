import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import {
  useGetMe,
  getGetMeQueryKey,
  useGetClientProfile,
  getGetClientProfileQueryKey,
  useGetProperties,
  customFetch,
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
  Upload,
  FileText,
  CheckCircle2,
  Clock,
  Trash2,
  ShieldCheck,
  Loader2,
  AlertCircle,
  PenLine,
  ArrowRight,
  TrendingUp,
  LogOut,
  User as UserIcon,
  Building2,
  DollarSign,
  SlidersHorizontal,
  Calculator,
  Landmark,
  Heart,
} from "lucide-react";
import { BankAndCorrespondentPicker } from "@/components/BankAndCorrespondentPicker";

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
const OUTRA_CIDADE = "__outra__";

const FIELD_TO_FORM: Record<string, string> = {
  name: "name",
  cpf: "cpf",
  birthDate: "birthDate",
  profession: "profissao",
  residentState: "ufMoradia",
  residentCity: "cidadeMoradia",
  propertyState: "ufImovel",
  propertyCity: "cidadeImovel",
  employmentType: "carteiraAssinada",
  income: "income",
  informalIncome: "informalIncome",
  maritalStatus: "maritalStatus",
  propertyValue: "propertyValue",
  alreadyOwnsPropertyInPropertyCity: "alreadyOwnsProperty",
  linkedPropertyId: "linkedPropertyId",
  spouseCpf: "spouseCpf",
  spouseName: "spouseName",
  spouseBirthDate: "spouseBirthDate",
  spouseProfession: "spouseProfissao",
  spouseIncome: "spouseIncome",
};

type Category = { slug: string; name: string; required: boolean; uploaded: boolean };
type Doc = {
  id: number; leadId: number; stage: string; slug: string; name: string;
  fileUrl: string; contentType: string | null; status: "pending" | "approved" | "rejected";
  notes: string | null; uploadedByName: string | null; visibleToClient: boolean;
  signatureRequired: boolean; signedAt: string | null; signatureProvider: string | null;
  signatureRef: string | null; createdAt: string; updatedAt: string;
};
type DocsPayload = { categories: Category[]; documents: Doc[]; proceedWithBank: string | null };

async function presignAndUpload(file: File): Promise<string> {
  const { uploadURL, objectPath } = await customFetch<{ uploadURL: string; objectPath: string }>("/api/storage/uploads/request-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      contentType: file.type || "application/octet-stream",
    }),
  });

  const put = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!put.ok) throw new Error("Falha ao enviar o arquivo");
  return objectPath;
}

// ── Components ────────────────────────────────────────────────────────────────
function FormField({
  label, value, onChange, placeholder, type = "text", readOnly, hint, error,
}: {
  label: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; type?: string; readOnly?: boolean; hint?: string; error?: string;
}) {
  const labelText = label.endsWith(" *") ? label.slice(0, -2) : label;
  const isRequired = label.endsWith(" *");
  return (
    <div className="flex flex-col gap-1 w-full">
      <label className="text-xs font-semibold text-[#07113A]">
        {labelText}{isRequired && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={readOnly}
        className={`px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
          readOnly
            ? "bg-gray-100/80 border-gray-200 text-gray-400 cursor-not-allowed"
            : error
            ? "border-red-500 bg-red-50 text-red-700 focus:ring-1 focus:ring-red-200"
            : "border-gray-200 bg-white focus:border-[#0D1B8C] focus:ring-1 focus:ring-[#0D1B8C]/15 text-gray-800"
        }`}
      />
      {hint && <span className="text-[10px] text-gray-400 leading-normal">{hint}</span>}
      {error && <span className="text-[10px] text-red-500 font-medium">{error}</span>}
    </div>
  );
}

function SelectField({
  label, value, onChange, options, placeholder, error, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
  error?: string; disabled?: boolean;
}) {
  const labelText = label.endsWith(" *") ? label.slice(0, -2) : label;
  const isRequired = label.endsWith(" *");
  return (
    <div className="flex flex-col gap-1 w-full">
      <label className="text-xs font-semibold text-[#07113A]">
        {labelText}{isRequired && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all ${
          disabled
            ? "bg-gray-100/80 border-gray-200 text-gray-400 cursor-not-allowed"
            : error
            ? "border-red-500 bg-red-50 text-red-700 focus:ring-1 focus:ring-red-200"
            : "border-gray-200 bg-white focus:border-[#0D1B8C] focus:ring-1 focus:ring-[#0D1B8C]/15 text-gray-800"
        }`}
      >
        <option value="">{placeholder ?? "Selecione..."}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span className="text-[10px] text-red-500 font-medium">{error}</span>}
    </div>
  );
}

function RadioGroup({
  label, value, onChange, options, hint, error,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; hint?: string; error?: string;
}) {
  const labelText = label.endsWith(" *") ? label.slice(0, -2) : label;
  const isRequired = label.endsWith(" *");
  return (
    <div className="flex flex-col gap-2 w-full">
      <label className="text-xs font-semibold text-[#07113A]">
        {labelText}{isRequired && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className={`flex flex-wrap gap-2 ${error ? "p-2 rounded-xl border border-red-200 bg-red-50" : ""}`}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
              value === o.value
                ? "bg-[#0D1B8C] text-white border-[#0D1B8C] shadow-sm"
                : error
                ? "bg-white text-red-600 border-red-300"
                : "bg-white text-gray-600 border-gray-200 hover:border-[#0D1B8C]/40"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint && <span className="text-[10px] text-gray-400 leading-relaxed">{hint}</span>}
      {error && <span className="text-[10px] text-red-500 font-medium">{error}</span>}
    </div>
  );
}

function CityStateRow({
  cityLabel, uf, city, freeCity, onUf, onCity, onFreeCity, ufError, cityError,
}: {
  cityLabel: string; uf: string; city: string; freeCity: string;
  onUf: (v: string) => void; onCity: (v: string) => void; onFreeCity: (v: string) => void;
  ufError?: string; cityError?: string;
}) {
  const cityList = useMemo(
    () => (uf ? citiesOf(uf as UF).map((c) => ({ value: c.name, label: c.name })) : []),
    [uf]
  );
  const options = [...cityList, { value: OUTRA_CIDADE, label: "Outro município..." }];
  const showFree = city === OUTRA_CIDADE;

  return (
    <div className="flex flex-col gap-3 w-full border-l-2 border-gray-100 pl-3">
      <SelectField
        label="Estado *"
        value={uf}
        onChange={onUf}
        options={UF_OPTIONS}
        placeholder="UF"
        error={ufError}
      />
      <SelectField
        label={cityLabel}
        value={city}
        onChange={onCity}
        options={options}
        placeholder={uf ? "Selecione a cidade..." : "Escolha primeiro o Estado (UF)"}
        error={cityError}
        disabled={!uf}
      />
      {showFree && (
        <div className="flex flex-col gap-1">
          <input
            type="text"
            value={freeCity}
            onChange={(e) => onFreeCity(e.target.value)}
            placeholder="Digite o nome da cidade"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-[#0D1B8C] focus:ring-1 focus:ring-[#0D1B8C]/15 text-gray-800"
          />
          <span className="text-[10px] text-amber-600">
            Município fora da nossa base — o MCMV usará o teto mais restrito.
          </span>
        </div>
      )}
    </div>
  );
}

function BottomNav({ onLogout }: { onLogout: () => void }) {
  const [, setLocation] = useLocation();
  const tabs = [
    { label: "Score",      icon: CheckCircle2,     href: "/portal/score",      key: "score" },
    { label: "Imóveis",    icon: Building2,         href: "/portal/imoveis",    key: "imoveis" },
    { label: "Simulador",  icon: Calculator,        href: "/portal/simulador",  key: "simulador" },
    { label: "Pagamentos", icon: DollarSign,        href: "/portal/pagamentos", key: "pagamentos" },
    { label: "Dívidas",    icon: Landmark,         href: "/portal/dividas",    key: "dividas" },
    { label: "Dados",      icon: SlidersHorizontal, href: "/portal/meus-dados", key: "dados" },
  ];
  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex items-center justify-around pt-3 pb-safe"
      style={{
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(16px)",
        borderTop: "1px solid rgba(0,0,0,0.06)",
        paddingBottom: `max(16px, env(safe-area-inset-bottom))`,
        zIndex: 50,
      }}
    >
      {tabs.map(({ label, icon: Icon, href, key }) => {
        const active = key === "dados";
        return (
          <button key={key} type="button" onClick={() => setLocation(href)} className="flex flex-col items-center gap-1">
            <Icon className="w-5 h-5" style={{ color: active ? "#0D1B8C" : "#9CA3AF" }} />
            <span className="text-[10px] font-semibold" style={{ color: active ? "#0D1B8C" : "#9CA3AF" }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function MeusDados() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: me } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 60_000 },
  });

  const { data: profile, isLoading } = useGetClientProfile({
    query: { queryKey: getGetClientProfileQueryKey(), staleTime: 30_000, retry: false },
  });

  // ── Tabs ──
  const [tab, setTab] = useState<"dados" | "documentos">("dados");

  // ── Profile Form State ──
  const [form, setForm] = useState({
    name: "", cpf: "", birthDate: "", profissao: "",
    ufMoradia: "", cidadeMoradia: "", cidadeMoradiaFree: "",
    ufImovel: "", cidadeImovel: "", cidadeImovelFree: "",
    carteiraAssinada: "", income: "", informalIncome: "", maritalStatus: "",
    propertyValue: "", alreadyOwnsProperty: "" as "" | "sim" | "nao",
    propertyInScorecasa: "" as "" | "sim" | "nao", linkedPropertyId: "",
    // cônjuge
    spouseCpf: "", spouseName: "", spouseBirthDate: "", spouseProfissao: "", spouseIncome: "",
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errFields, setErrFields] = useState<Set<string>>(new Set());

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
  const [notification, setNotification] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // ── Document State ──
  const [docsData, setDocsData] = useState<DocsPayload | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadingSlug, setUploadingSlug] = useState<string | null>(null);
  const [signingId, setSigningId] = useState<number | null>(null);

  const needsSpouse = form.maritalStatus === "casado" || form.maritalStatus === "uniao_estavel";

  function resolveCity(uf: string | null | undefined, city: string | null | undefined) {
    if (!uf || !city) return { dropdown: "", free: "" };
    const list = citiesOf(uf as UF);
    const match = list.find((c) => normalizeCity(c.name) === normalizeCity(city));
    if (match) return { dropdown: match.name, free: "" };
    return { dropdown: OUTRA_CIDADE, free: city };
  }

  // Sincroniza dados do profile vindo da API para o state local
  useEffect(() => {
    if (!profile) return;
    const l = profile.lead as any;
    if (!l) return;
    const moradia = resolveCity(l.residentState, l.residentCity);
    const imovel = resolveCity(l.propertyState, l.propertyCity);

    setForm({
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
      spouseProfissao: l.spouseProfession ?? "",
      spouseIncome: brlFromNumber(l.spouseIncome),
    });
  }, [profile]);

  // Seletor de imóvel
  const propertiesQueryEnabled = form.propertyInScorecasa === "sim" && !!form.ufImovel;
  const { data: properties } = useGetProperties(undefined, {
    query: {
      queryKey: ["properties", "linkPickerMobile"],
      enabled: propertiesQueryEnabled,
      staleTime: 60_000,
    },
  });

  const propertyOptions = useMemo(() => {
    if (!properties) return [];
    const ufFilter = form.ufImovel;
    const cityTarget = form.cidadeImovel === OUTRA_CIDADE ? form.cidadeImovelFree : form.cidadeImovel;
    return properties
      .filter((p: any) => p.status === "available" || p.status == null)
      .filter((p: any) => !ufFilter || p.state === ufFilter)
      .filter((p: any) => !cityTarget || normalizeCity(p.city ?? "") === normalizeCity(cityTarget))
      .map((p: any) => ({
        value: String(p.id),
        label: `${p.title} — ${p.city}/${p.state} (R$ ${Number(p.price).toLocaleString("pt-BR")})`,
        price: p.price,
        city: p.city,
        state: p.state,
      }));
  }, [properties, form.ufImovel, form.cidadeImovel, form.cidadeImovelFree]);

  // Sincroniza imóvel ScoreCasa
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
  }, [form.linkedPropertyId, form.propertyInScorecasa, propertyOptions]);

  // ── Document Handlers ──
  const fetchDocs = async () => {
    setLoadingDocs(true);
    try {
      const data = await customFetch<DocsPayload>("/api/client/documents");
      setDocsData(data);
    } catch (e) {
      console.error("Falha ao carregar documentos", e);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (tab === "documentos") {
      fetchDocs();
    }
  }, [tab]);

  const handleUpload = async (slug: string, file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      showNotice("Arquivo muito grande. Máximo 15 MB.", "error");
      return;
    }
    setUploadingSlug(slug);
    try {
      const objectPath = await presignAndUpload(file);
      await customFetch("/api/client/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          fileUrl: objectPath,
          contentType: file.type || null,
          name: slug === "identidade" ? "RG / CNH" : slug === "residencia" ? "Comprovante de residência" : slug === "renda" ? "Comprovante de renda" : "Extrato FGTS",
        }),
      });
      showNotice("Documento enviado com sucesso!", "success");
      fetchDocs();
    } catch (err: any) {
      showNotice(err?.message ?? "Falha ao enviar o arquivo.", "error");
    } finally {
      setUploadingSlug(null);
    }
  };

  const handleDeleteDoc = async (id: number) => {
    if (!window.confirm("Deseja realmente excluir este documento?")) return;
    try {
      await customFetch(`/api/client/documents/${id}`, { method: "DELETE" });
      showNotice("Documento removido.", "success");
      fetchDocs();
    } catch (err: any) {
      showNotice(err?.message ?? "Falha ao remover o documento.", "error");
    }
  };

  const handleSignDoc = async (id: number) => {
    setSigningId(id);
    try {
      const resp = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/client/documents/${id}/sign`, {
        method: "POST",
        credentials: "include",
      });
      const body = await resp.json().catch(() => ({}));
      if (resp.status === 503) {
        showNotice(body?.message ?? "Integração gov.br em homologação.", "error");
        return;
      }
      if (!resp.ok) throw new Error(body?.error ?? "Falha ao assinar");
      showNotice("Documento assinado com sucesso via gov.br!", "success");
      fetchDocs();
    } catch (err: any) {
      showNotice(err?.message ?? "Erro ao assinar o documento.", "error");
    } finally {
      setSigningId(null);
    }
  };

  const handleProceedCaixa = async (bank: string | null) => {
    try {
      await customFetch("/api/client/documents/proceed-with-bank", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bank }),
      });
      showNotice(bank === "caixa" ? "Opção registrada: Caixa Econômica." : "Opção redefinida.", "success");
      fetchDocs();
    } catch (err: any) {
      showNotice("Erro ao salvar opção bancária.", "error");
    }
  };

  const showNotice = (msg: string, type: "success" | "error") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // ── Save Form ──
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

  function validateField(name: string, value: string, needsSpouseActive?: boolean): string | null {
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
    if (needsSpouseActive) {
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

  // ── Save Form ──
  const validateForm = () => {
    const errs: Record<string, string> = {};
    for (const key of Object.keys(form) as Array<keyof typeof form>) {
      const errText = validateField(key, form[key], key.startsWith("spouse") ? true : needsSpouse);
      if (errText) {
        errs[key] = errText;
      }
    }

    if (!form.ufMoradia) {
      errs.ufMoradia = "Selecione o estado de moradia.";
    }
    if (!form.cidadeMoradia) {
      errs.cidadeMoradia = "Selecione a cidade de moradia.";
    } else if (form.cidadeMoradia === OUTRA_CIDADE) {
      if (!form.cidadeMoradiaFree.trim()) {
        errs.cidadeMoradia = "Digite o nome do município de moradia.";
      } else if (form.cidadeMoradiaFree.trim().length < 2) {
        errs.cidadeMoradia = "O nome do município deve ter pelo menos 2 caracteres.";
      } else if (form.cidadeMoradiaFree.trim().length > 80) {
        errs.cidadeMoradia = "O nome do município deve ter no máximo 80 caracteres.";
      }
    }

    if (!form.ufImovel) {
      errs.ufImovel = "Selecione o estado do imóvel.";
    }
    if (!form.cidadeImovel) {
      errs.cidadeImovel = "Selecione a cidade do imóvel.";
    } else if (form.cidadeImovel === OUTRA_CIDADE) {
      if (!form.cidadeImovelFree.trim()) {
        errs.cidadeImovel = "Digite o nome do município do imóvel.";
      } else if (form.cidadeImovelFree.trim().length < 2) {
        errs.cidadeImovel = "O nome do município deve ter pelo menos 2 caracteres.";
      } else if (form.cidadeImovelFree.trim().length > 80) {
        errs.cidadeImovel = "O nome do município deve ter no máximo 80 caracteres.";
      }
    }

    if (form.propertyInScorecasa === "sim" && !form.linkedPropertyId) {
      errs.linkedPropertyId = "Selecione o imóvel pretendido do catálogo.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      showNotice("Por favor, preencha os campos obrigatórios corretamente.", "error");
      return;
    }

    setSaving(true);
    setErrFields(new Set());
    try {
      const cityResident = form.cidadeMoradia === OUTRA_CIDADE ? form.cidadeMoradiaFree : form.cidadeMoradia;
      const cityProperty = form.cidadeImovel === OUTRA_CIDADE ? form.cidadeImovelFree : form.cidadeImovel;

      const body: Record<string, any> = {
        name: form.name.trim(),
        birthDate: form.birthDate || null,
        profession: form.profissao.trim() || null,
        employmentType: form.carteiraAssinada === "sim" ? "clt" : form.carteiraAssinada === "nao" ? "autonomo" : null,
        income: parseBRL(form.income) || undefined,
        informalIncome: parseBRL(form.informalIncome) || null,
        maritalStatus: form.maritalStatus || null,
        propertyValue: parseBRL(form.propertyValue) || undefined,
        propertyCity: cityProperty || null,
        propertyState: form.ufImovel || null,
        residentCity: cityResident || null,
        residentState: form.ufMoradia || null,
        alreadyOwnsPropertyInPropertyCity:
          form.alreadyOwnsProperty === "sim" ? true : form.alreadyOwnsProperty === "nao" ? false : null,
        linkedPropertyId:
          form.propertyInScorecasa === "sim" && form.linkedPropertyId ? parseInt(form.linkedPropertyId, 10) : null,
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

      await customFetch("/api/client/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      await queryClient.invalidateQueries({ queryKey: getGetClientProfileQueryKey() });
      showNotice("Dados atualizados com sucesso!", "success");
    } catch (err: any) {
      if (err?.status === 400 && err?.data?.fields) {
        const apiFields = err.data.fields.filter((f: any): f is string => typeof f === "string");
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
        showNotice("Verifique os campos destacados", "error");
      } else {
        showNotice(err?.message ?? "Falha ao salvar os dados.", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await customFetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout failed", e);
    }
    queryClient.clear();
    setLocation("/login");
  };

  const docsMap = useMemo(() => {
    const map = new Map<string, Doc>();
    if (!docsData?.documents) return map;
    for (const d of docsData.documents) {
      const cur = map.get(d.slug);
      if (!cur || new Date(d.createdAt) > new Date(cur.createdAt)) {
        map.set(d.slug, d);
      }
    }
    return map;
  }, [docsData]);

  const scoreApproved =
    (profile?.lead?.scoreCaixa ?? 0) >= 650 && (profile?.lead?.approvalChance ?? 0) >= 60;

  const showPendingDocsWarning =
    scoreApproved &&
    docsData?.categories.filter((c) => c.required).some((c) => !docsMap.has(c.slug));

  const ccaForms = docsData?.documents.filter((d) => d.signatureRequired && d.visibleToClient) || [];

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#F2F4F7", fontFamily: "Poppins, sans-serif", paddingBottom: 90 }}
    >
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 left-4 right-4 z-[99] p-4 rounded-2xl shadow-lg border text-sm flex items-start gap-2.5 transition-all animate-fade-up`}
          style={{
            background: notification.type === "success" ? "#ECFDF5" : "#FEF2F2",
            borderColor: notification.type === "success" ? "#10A65A" : "#EF4444",
            color: notification.type === "success" ? "#065F46" : "#991B1B",
          }}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1 font-semibold">{notification.msg}</div>
        </div>
      )}

      {/* Header */}
      <div
        className="px-5 pt-14 pb-6"
        style={{ background: "linear-gradient(160deg, #0D1B8C 0%, #07113A 100%)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase font-semibold text-blue-200 bg-white/10 px-2.5 py-1 rounded-full">
              Configurações
            </div>
            <h1 className="text-xl font-bold text-white mt-1">Meus Dados</h1>
          </div>
          <button
            onClick={handleLogout}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="mt-4 p-0.5 bg-white/10 backdrop-blur-md rounded-xl flex">
          {[
            { id: "dados" as const, label: "Perfil" },
            { id: "documentos" as const, label: "Documentos & Financiamento" },
          ].map((t) => {
            const isTabActive = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all"
                style={{
                  background: isTabActive ? "#FFFFFF" : "transparent",
                  color: isTabActive ? "#07113A" : "rgba(255, 255, 255, 0.75)",
                  boxShadow: isTabActive ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pt-4 flex flex-col gap-4">
        {isLoading && (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#0D1B8C]" />
          </div>
        )}

        {!isLoading && profile && (
          <>
            {/* Tab: Profile Form */}
            {tab === "dados" && (
              <form onSubmit={handleSave} className="space-y-4">
                {/* Required legend */}
                <p className="text-[11px] text-gray-400 flex items-center gap-1">
                  <span className="text-red-500 font-bold text-xs">*</span>
                  Campos obrigatórios
                </p>

                {/* Informações Pessoais Card */}
                <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                  <div
                    className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100"
                    style={{ background: "linear-gradient(90deg, #F7F8FF 0%, #FFFFFF 100%)" }}
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#0D1B8C]/10 flex items-center justify-center flex-shrink-0">
                      <UserIcon className="w-3.5 h-3.5 text-[#0D1B8C]" />
                    </div>
                    <h3 className="text-xs font-bold text-[#07113A]">Informações Pessoais</h3>
                  </div>
                  <div className="p-5 space-y-4">

                  <FormField label="CPF / CNPJ" value={form.cpf} readOnly />

                  <FormField
                    label="Nome completo *"
                    value={form.name}
                    onChange={setField("name")}
                    error={errors.name}
                  />

                  <FormField
                    label="Data de nascimento"
                    value={form.birthDate}
                    onChange={setField("birthDate")}
                    type="date"
                    hint="Opcional. Mínimo 18 anos se informada."
                    error={errors.birthDate}
                  />

                  <CityStateRow
                    cityLabel="Cidade de moradia *"
                    uf={form.ufMoradia}
                    city={form.cidadeMoradia}
                    freeCity={form.cidadeMoradiaFree}
                    onUf={(v) => {
                      setForm((f) => ({ ...f, ufMoradia: v, cidadeMoradia: "", cidadeMoradiaFree: "" }));
                      clearFieldError("ufMoradia");
                    }}
                    onCity={(v) => {
                      setForm((f) => ({ ...f, cidadeMoradia: v, cidadeMoradiaFree: "" }));
                      clearFieldError("cidadeMoradia");
                    }}
                    onFreeCity={(v) => {
                      setForm((f) => ({ ...f, cidadeMoradiaFree: v }));
                      clearFieldError("cidadeMoradia");
                    }}
                    ufError={errors.ufMoradia}
                    cityError={errors.cidadeMoradia}
                  />

                  <FormField
                    label="Profissão *"
                    value={form.profissao}
                    onChange={setField("profissao")}
                    placeholder="Sua profissão"
                    error={errors.profissao}
                  />

                  <RadioGroup
                    label="Possui ou já possuiu 3 anos ou mais de carteira assinada (FGTS)? *"
                    value={form.carteiraAssinada}
                    onChange={setField("carteiraAssinada")}
                    options={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }]}
                    error={errors.carteiraAssinada}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      label="Renda formal (R$) *"
                      value={form.income}
                      onChange={setBRL("income")}
                      placeholder="0,00"
                      error={errors.income}
                    />
                    <FormField
                      label="Renda informal (R$)"
                      value={form.informalIncome}
                      onChange={setBRL("informalIncome")}
                      placeholder="0,00"
                      error={errors.informalIncome}
                    />
                  </div>

                  <SelectField
                    label="Estado civil *"
                    value={form.maritalStatus}
                    onChange={setField("maritalStatus")}
                    options={MARITAL_OPTIONS}
                    error={errors.maritalStatus}
                  />
                  </div>{/* end pessoais content */}
                </section>{/* end pessoais */}

                {/* Dados do Cônjuge Card */}
                {needsSpouse && (
                  <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                    <div
                      className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100"
                      style={{ background: "linear-gradient(90deg, #FFF1F2 0%, #FFFFFF 100%)" }}
                    >
                      <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                        <Heart className="w-3.5 h-3.5 text-rose-500" />
                      </div>
                      <h3 className="text-xs font-bold text-[#07113A]">Dados do Cônjuge</h3>
                    </div>
                    <div className="p-5 space-y-4">

                    <FormField
                      label="Nome do cônjuge *"
                      value={form.spouseName}
                      onChange={setField("spouseName")}
                      error={errors.spouseName}
                    />
                    <FormField
                      label="CPF do cônjuge *"
                      value={form.spouseCpf}
                      onChange={(v) => {
                        setForm((f) => ({ ...f, spouseCpf: maskCPF(v) }));
                        clearFieldError("spouseCpf");
                        const errText = validateField("spouseCpf", maskCPF(v), true);
                        if (errText) setErrors((prev) => ({ ...prev, spouseCpf: errText }));
                      }}
                      error={errors.spouseCpf}
                    />
                    <FormField
                      label="Data de nascimento do cônjuge *"
                      value={form.spouseBirthDate}
                      onChange={setField("spouseBirthDate")}
                      type="date"
                      error={errors.spouseBirthDate}
                    />
                    <FormField
                      label="Profissão do cônjuge *"
                      value={form.spouseProfissao}
                      onChange={setField("spouseProfissao")}
                      error={errors.spouseProfissao}
                    />
                    <FormField
                      label="Renda do cônjuge (R$)"
                      value={form.spouseIncome}
                      onChange={setBRL("spouseIncome")}
                      placeholder="0,00"
                      error={errors.spouseIncome}
                    />
                    </div>
                  </section>
                )}

                {/* Imóvel Pretendido Card */}
                <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                  <div
                    className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100"
                    style={{ background: "linear-gradient(90deg, #F7F8FF 0%, #FFFFFF 100%)" }}
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#0D1B8C]/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-3.5 h-3.5 text-[#0D1B8C]" />
                    </div>
                    <h3 className="text-xs font-bold text-[#07113A]">Imóvel Pretendido</h3>
                  </div>
                  <div className="p-5 space-y-4">

                  <CityStateRow
                    cityLabel="Cidade do imóvel pretendido *"
                    uf={form.ufImovel}
                    city={form.cidadeImovel}
                    freeCity={form.cidadeImovelFree}
                    onUf={(v) => {
                      setForm((f) => ({ ...f, ufImovel: v, cidadeImovel: "", cidadeImovelFree: "", linkedPropertyId: "" }));
                      clearFieldError("ufImovel");
                    }}
                    onCity={(v) => {
                      setForm((f) => ({ ...f, cidadeImovel: v, cidadeImovelFree: "", linkedPropertyId: "" }));
                      clearFieldError("cidadeImovel");
                    }}
                    onFreeCity={(v) => {
                      setForm((f) => ({ ...f, cidadeImovelFree: v }));
                      clearFieldError("cidadeImovel");
                    }}
                    ufError={errors.ufImovel}
                    cityError={errors.cidadeImovel}
                  />

                  <FormField
                    label="Valor do imóvel pretendido (R$) *"
                    value={form.propertyValue}
                    onChange={setBRL("propertyValue")}
                    placeholder="0,00"
                    error={errors.propertyValue}
                  />

                  <RadioGroup
                    label="Já possui outro imóvel residencial no mesmo município? *"
                    value={form.alreadyOwnsProperty}
                    onChange={(v) => setForm((f) => ({ ...f, alreadyOwnsProperty: v as any }))}
                    options={[{ value: "nao", label: "Não" }, { value: "sim", label: "Sim" }]}
                    hint="Pelo regulamento do MCMV, proprietários ficam impedidos de participar."
                    error={errors.alreadyOwnsProperty}
                  />

                  {form.alreadyOwnsProperty === "sim" && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
                      <strong>Atenção:</strong> Você não atende ao regulamento do MCMV. Analisaremos seu caso na linha SBPE/Tradicional.
                    </div>
                  )}

                  <RadioGroup
                    label="O imóvel está anunciado no ScoreCasa Imóveis? *"
                    value={form.propertyInScorecasa}
                    onChange={(v) => setForm((f) => ({ ...f, propertyInScorecasa: v as any, linkedPropertyId: "" }))}
                    options={[{ value: "nao", label: "Não" }, { value: "sim", label: "Sim" }]}
                    error={errors.propertyInScorecasa}
                  />

                  {form.propertyInScorecasa === "sim" && (
                    <SelectField
                      label="Selecione o Imóvel anunciado"
                      value={form.linkedPropertyId}
                      onChange={(v) => {
                        setForm((f) => ({ ...f, linkedPropertyId: v }));
                        clearFieldError("linkedPropertyId");
                      }}
                      options={propertyOptions}
                      placeholder="Selecione o imóvel..."
                      error={errors.linkedPropertyId}
                    />
                  )}
                  </div>{/* end imovel content */}
                </section>{/* end imovel */}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3.5 rounded-2xl text-white font-bold text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #0D1B8C 0%, #1A2FB0 100%)", boxShadow: "0 4px 20px rgba(13,27,140,0.30)" }}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Salvar Alterações
                </button>
              </form>
            )}

            {/* Tab: Documents Upload & Bank Picker */}
            {tab === "documentos" && (
              <div className="space-y-4">
                {/* Pending documents warning */}
                {showPendingDocsWarning && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-900">Documentos pendentes!</h4>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Sua análise de crédito foi aprovada! Envie os documentos exigidos abaixo para o correspondente habilitado.
                      </p>
                    </div>
                  </div>
                )}

                {/* Financing Picker (Bank Selection) */}
                {scoreApproved && (
                  <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
                    <h3 className="text-sm font-bold text-[#07113A]">Vínculo de Financiamento</h3>
                    <BankAndCorrespondentPicker variant="full" onError={(msg) => showNotice(msg, "error")} />
                  </section>
                )}

                {/* Document List */}
                <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#07113A]">Documentos Pessoais</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">Formatos suportados: PDF, PNG, JPG, JPEG. Limite de 15MB.</p>
                  </div>

                  {loadingDocs && (
                    <div className="py-6 flex justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  )}

                  {!loadingDocs && docsData && (
                    <div className="space-y-3">
                      {docsData.categories.map((cat) => {
                        const doc = docsMap.get(cat.slug);
                        const isUploading = uploadingSlug === cat.slug;

                        return (
                          <div key={cat.slug} className="border border-gray-100 rounded-xl p-3.5 flex flex-col gap-3 bg-gray-50/20">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2.5">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${doc ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}>
                                  {doc ? <FileText className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-bold text-gray-800">{cat.name}</span>
                                    {cat.required && (
                                      <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">Obrigatorio</span>
                                    )}
                                  </div>
                                  {doc ? (
                                    <span className="text-[10px] text-gray-400">Enviado em {new Date(doc.createdAt).toLocaleDateString()}</span>
                                  ) : (
                                    <span className="text-[10px] text-gray-400">Aguardando arquivo</span>
                                  )}
                                </div>
                              </div>

                              {doc && (
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  doc.status === "approved"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                    : doc.status === "rejected"
                                    ? "bg-red-50 text-red-700 border border-red-100"
                                    : "bg-amber-50 text-amber-700 border border-amber-100"
                                }`}>
                                  {doc.status === "approved" ? "Aprovado" : doc.status === "rejected" ? "Rejeitado" : "Em análise"}
                                </span>
                              )}
                            </div>

                            {doc?.notes && doc.status === "rejected" && (
                              <div className="p-2.5 bg-red-50/50 rounded-lg text-[10px] text-red-700 border border-red-100/50">
                                <strong>Motivo da rejeição:</strong> {doc.notes}
                              </div>
                            )}

                            <div className="flex gap-2">
                              {/* File Input trigger */}
                              <label className="flex-1">
                                <input
                                  type="file"
                                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                                  className="hidden"
                                  disabled={isUploading}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleUpload(cat.slug, file);
                                  }}
                                />
                                <div className="w-full py-2 bg-[#0D1B8C] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] transition-all">
                                  {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                  {doc ? "Substituir" : "Enviar Arquivo"}
                                </div>
                              </label>

                              {doc && doc.status !== "approved" && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDoc(doc.id)}
                                  className="px-3 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 flex items-center justify-center"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Signature Forms */}
                <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#07113A]">Formulários para Assinar</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">Assinatura digital integrada ao Gov.br</p>
                  </div>

                  {!loadingDocs && ccaForms.length === 0 && (
                    <div className="p-6 border border-dashed border-gray-200 rounded-xl text-center text-xs text-gray-400">
                      Nenhum formulário compartilhado ainda. Quando o correspondente enviar, eles aparecerão aqui.
                    </div>
                  )}

                  {!loadingDocs && ccaForms.map((doc) => {
                    const signed = !!doc.signedAt;
                    const isSigning = signingId === doc.id;

                    return (
                      <div key={doc.id} className="border border-gray-100 rounded-xl p-3.5 flex flex-col gap-3 bg-gray-50/20">
                        <div className="flex gap-2.5 items-start">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${signed ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                            {signed ? <ShieldCheck className="w-4 h-4" /> : <PenLine className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold text-gray-800 block truncate">{doc.name}</span>
                            <span className="text-[10px] text-gray-400">Enviado por {doc.uploadedByName ?? "Correspondente"}</span>
                          </div>
                        </div>

                        {signed ? (
                          <div className="text-[10px] text-emerald-700 font-bold bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                            Assinado em {new Date(doc.signedAt!).toLocaleDateString()}
                            {doc.signatureRef ? ` · prot. ${doc.signatureRef}` : ""}
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <a
                              href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/storage/objects/${doc.fileUrl.replace(/^\/?objects\//, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 py-2 text-center border border-gray-200 text-[#07113A] text-xs font-semibold rounded-lg active:scale-95 transition-all"
                            >
                              Ver Documento
                            </a>
                            <button
                              type="button"
                              onClick={() => handleSignDoc(doc.id)}
                              disabled={isSigning}
                              className="flex-1 py-2 bg-[#0D1B8C] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 active:scale-95 transition-all"
                            >
                              {isSigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                              Assinar Gov.br
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </section>
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav onLogout={handleLogout} />
    </div>
  );
}
