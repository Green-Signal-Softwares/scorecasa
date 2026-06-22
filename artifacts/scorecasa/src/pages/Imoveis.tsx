import { useEffect, useRef, useState, useMemo } from "react";
import { Link } from "wouter";
import { useGetProperties, useCreateProperty, useUpdateProperty, useDeleteProperty, useTogglePropertyInterest, useGetMyInterests, useGetMe, useGetMySubscription, ApiError } from "@workspace/api-client-react";
import { useSessionGuard } from "@/hooks/use-session-guard";
import { SessionExpiredBanner } from "@/components/SessionExpiredBanner";
import { useQueryClient } from "@tanstack/react-query";
import { getGetPropertiesQueryKey, getGetMyInterestsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2, Home, Search, Plus, Heart, MapPin, Ruler, BedDouble, Bath,
  Car, X, Save, ChevronDown, CheckCircle, Tag, Pencil, Trash2, Eye,
  Wifi, Dumbbell, Waves, TreePine, Filter,
  ImagePlus, Link2, Upload, Loader2, ImageOff,
} from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  comercial: "Comercial",
  terreno: "Terreno",
  cobertura: "Cobertura",
  studio: "Studio",
};

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  available: { bg: "#F0FDF4", text: "#10A65A", label: "Disponível" },
  reserved:  { bg: "#FFFBEB", text: "#D97706", label: "Reservado" },
  sold:      { bg: "#FEF2F2", text: "#EF4444", label: "Vendido" },
  inactive:  { bg: "#F3F4F6", text: "#6B7280", label: "Inativo" },
};

const BR_STATES = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

const EMPTY_FORM = {
  title: "", description: "", type: "apartamento" as const,
  price: "", condominiumFee: "", iptu: "",
  address: "", neighborhood: "", city: "", state: "SP", zipCode: "",
  areaSqm: "", bedrooms: "", bathrooms: "", parkingSpots: "",
  hasFurnished: false, hasPool: false, hasGym: false, hasBalcony: false,
  imageUrl: "", imageUrl2: "", imageUrl3: "",
  acceptsFgts: true, acceptsMcmv: false, acceptsSbpe: true,
  brokerName: "", brokerPhone: "",
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// ─── Image Upload Hook ────────────────────────────────────────────────────────
function useImageUpload(opts: { onError?: (err: Error) => void } = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const uploadFile = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    try {
      const res = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "image/jpeg" }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao gerar URL de upload");
      const { uploadURL, objectPath } = (await res.json()) as { uploadURL: string; objectPath: string };
      const put = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "image/jpeg" },
      });
      if (!put.ok) throw new Error("Falha ao enviar arquivo");
      // Serve via storage proxy so the card's <img> can load it
      return `/api/storage${objectPath.startsWith("/") ? objectPath : "/" + objectPath}`;
    } catch (err) {
      opts.onError?.(err instanceof Error ? err : new Error("Upload falhou"));
      return null;
    } finally {
      setIsUploading(false);
    }
  };
  return { uploadFile, isUploading };
}

// ─── Dual-mode image field (URL link OR file upload) ──────────────────────────
function ImageUploadField({
  label, value, onChange, isUploading, onUpload,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  isUploading: boolean;
  onUpload: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"url" | "upload">(value && !value.startsWith("/api/storage") ? "url" : value.startsWith("/api/storage") ? "upload" : "url");
  const previewSrc = value || null;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMode("upload");
    onUpload(file);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {/* Mode toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden flex-shrink-0">
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 transition-colors ${
              mode === "url" ? "bg-[#0D1B8C] text-white" : "bg-white text-gray-400 hover:bg-gray-50"
            }`}
          >
            <Link2 className="w-3 h-3" /> Link
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isUploading}
            className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 transition-colors ${
              mode === "upload" ? "bg-[#0D1B8C] text-white" : "bg-white text-gray-400 hover:bg-gray-50"
            } disabled:opacity-60`}
          >
            {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Upload
          </button>
        </div>
        {/* URL input (shown when mode=url) */}
        {mode === "url" ? (
          <Input
            placeholder={`URL da ${label}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="text-xs flex-1"
          />
        ) : (
          <div className="flex-1 text-xs text-gray-400 italic truncate">
            {isUploading ? "Enviando imagem…" : value ? "Imagem carregada via upload" : "Clique em Upload para selecionar"}
          </div>
        )}
        {/* Clear button */}
        {value && (
          <button type="button" onClick={() => { onChange(""); setMode("url"); }} className="text-gray-300 hover:text-red-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {/* Preview */}
      {previewSrc && (
        <div className="relative h-24 rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
          <img src={previewSrc} alt={label} className="w-full h-full object-cover" />
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

function PropertyCard({
  prop, isInterested, onInterest, onEdit, onDelete, canManage,
}: {
  prop: any; isInterested: boolean; onInterest: (id: number) => void;
  onEdit: (p: any) => void; onDelete: (id: number) => void; canManage: boolean;
}) {
  const st = STATUS_COLORS[prop.status] ?? STATUS_COLORS.available;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow group flex flex-col">
      {/* Image */}
      <div className="relative h-48 bg-gradient-to-br from-[#0D1B8C]/10 to-[#10A65A]/10 flex-shrink-0 overflow-hidden">
        {prop.imageUrl ? (
          <img src={prop.imageUrl} alt={prop.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="w-16 h-16 text-[#0D1B8C]/20" />
          </div>
        )}
        {/* Status badge */}
        <div className="absolute top-3 left-3 z-10">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-xs text-white" style={{ background: st.text }}>
            {st.label}
          </span>
        </div>
        {/* Floating Heart Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onInterest(prop.id);
          }}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/95 backdrop-blur-xs shadow-xs flex items-center justify-center hover:scale-110 active:scale-95 transition-all text-gray-400 hover:text-red-500"
          title={isInterested ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Heart className={`w-4.5 h-4.5 transition-colors ${isInterested ? "fill-red-500 text-red-500" : "text-gray-400"}`} />
        </button>
        {/* Type badge */}
        <div className="absolute bottom-3 left-3 z-10">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/60 text-white backdrop-blur-xs">
            {TYPE_LABELS[prop.type] ?? prop.type}
          </span>
        </div>
        {/* Action buttons (for managers) */}
        {canManage && (
          <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <button
              onClick={() => onEdit(prop)}
              className="w-8 h-8 rounded-lg bg-white shadow-xs flex items-center justify-center hover:bg-[#0D1B8C] hover:text-white transition-colors"
              title="Editar imóvel"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(prop.id)}
              className="w-8 h-8 rounded-lg bg-white shadow-xs flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
              title="Excluir imóvel"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        <div className="mb-3">
          <div className="font-bold text-[#07113A] text-sm leading-snug mb-1 line-clamp-2 min-h-[40px]">{prop.title}</div>
          {(prop.neighborhood || prop.city) && (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-gray-300" />
              <span className="truncate">{[prop.neighborhood, prop.city, prop.state].filter(Boolean).join(", ")}</span>
            </div>
          )}
        </div>

        {/* Price */}
        <div className="mb-4">
          <div className="text-xl font-extrabold text-[#0D1B8C]">{formatBRL(prop.price)}</div>
          {prop.condominiumFee && (
            <div className="text-[10px] text-gray-400 font-semibold mt-0.5">+ {formatBRL(prop.condominiumFee)}/mês cond.</div>
          )}
        </div>

        {/* Specs Grid */}
        <div className="grid grid-cols-4 gap-1 text-center text-xs text-gray-500 mb-4 bg-gray-50/50 p-2.5 rounded-xl border border-gray-100/50">
          <div className="flex flex-col items-center">
            <span className="text-gray-400 text-[8px] uppercase font-bold flex items-center gap-0.5"><Ruler className="w-2.5 h-2.5 text-gray-300" />Área</span>
            <span className="font-bold text-gray-700 mt-0.5">{prop.areaSqm ? `${prop.areaSqm}m²` : "—"}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-gray-400 text-[8px] uppercase font-bold flex items-center gap-0.5"><BedDouble className="w-2.5 h-2.5 text-gray-300" />Qtos</span>
            <span className="font-bold text-gray-700 mt-0.5">{prop.bedrooms ?? "—"}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-gray-400 text-[8px] uppercase font-bold flex items-center gap-0.5"><Bath className="w-2.5 h-2.5 text-gray-300" />Banh</span>
            <span className="font-bold text-gray-700 mt-0.5">{prop.bathrooms ?? "—"}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-gray-400 text-[8px] uppercase font-bold flex items-center gap-0.5"><Car className="w-2.5 h-2.5 text-gray-300" />Vagas</span>
            <span className="font-bold text-gray-700 mt-0.5">{prop.parkingSpots ?? "—"}</span>
          </div>
        </div>

        {/* Financing badges */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {prop.acceptsFgts && <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100/50 font-bold uppercase tracking-wider">FGTS</span>}
          {prop.acceptsMcmv && <span className="text-[9px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100/50 font-bold uppercase tracking-wider">MCMV</span>}
          {prop.acceptsSbpe && <span className="text-[9px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100/50 font-bold uppercase tracking-wider">SBPE</span>}
        </div>

        {/* Broker info */}
        {prop.brokerName && (
          <div className="text-xs text-gray-400 mb-4 border-t border-gray-50 pt-3 flex items-center justify-between">
            <span className="truncate">Corretor: <strong className="text-gray-600 font-semibold">{prop.brokerName}</strong></span>
          </div>
        )}

        {/* View details */}
        <Link href={`/imoveis/${prop.id}`} className="w-full mt-auto block" data-testid={`button-view-property-${prop.id}`}>
          <button className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold bg-[#0D1B8C]/5 hover:bg-[#0D1B8C] text-[#0D1B8C] hover:text-white border border-[#0D1B8C]/10 hover:border-[#0D1B8C] transition-all">
            Ver Detalhes
            <Eye className="w-3.5 h-3.5" />
          </button>
        </Link>
      </div>
    </div>
  );
}

export function Imoveis() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: me, error: meError } = useGetMe({});
  const role = (me as any)?.role ?? "client";
  const { data: sub, error: subError } = useGetMySubscription({ query: { retry: false } } as any);
  const planId = (sub as any)?.plan;
  const hasMarketplaceAccess = !!(sub as any)?.marketplaceAddon || planId === "imobiliaria" || planId === "enterprise";
  // Só admin/analista e corretor com add-on de Vitrine ou plano correspondente podem cadastrar/editar.
  // Cliente e correspondente apenas visualizam o catálogo divulgado pelos corretores.
  const canManage =
    role === "admin" ||
    role === "analyst" ||
    (role === "broker" && hasMarketplaceAccess);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState(role === "client" ? "available" : "");
  const [showForm, setShowForm] = useState(false);
  const [editingProp, setEditingProp] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [uploadingSlot, setUploadingSlot] = useState<0 | 1 | 2 | 3>(0);

  const { uploadFile: uploadImage } = useImageUpload({
    onError: (err) => toast({ title: "Erro no upload da imagem", description: err.message, variant: "destructive" }),
  });

  async function handleImageUpload(file: File, slot: 1 | 2 | 3) {
    setUploadingSlot(slot);
    const url = await uploadImage(file);
    setUploadingSlot(0);
    if (!url) return;
    if (slot === 1) setForm((f) => ({ ...f, imageUrl: url }));
    if (slot === 2) setForm((f) => ({ ...f, imageUrl2: url }));
    if (slot === 3) setForm((f) => ({ ...f, imageUrl3: url }));
  }

  const getPropsOptions = useMemo(() => ({ query: { keepPreviousData: true } }), []);
  const { data: properties = [], isLoading, error: propsError } = useGetProperties(undefined, getPropsOptions);
  const { data: myInterests = [], error: interestsError } = useGetMyInterests({});

  const createProp = useCreateProperty();
  const updateProp = useUpdateProperty();
  const deleteProp = useDeleteProperty();
  const toggleInterest = useTogglePropertyInterest();

  // Detecta 401 em qualquer um dos fetches do catálogo e mostra a mesma UX
  // de sessão expirada usada nas demais páginas do portal.
  const guard = useSessionGuard();
  const is401 = (e: unknown) => e instanceof ApiError && e.status === 401;
  const anyUnauthorized = is401(meError) || is401(subError) || is401(propsError) || is401(interestsError);
  useEffect(() => {
    if (anyUnauthorized) guard.handleAuthFailure();
  }, [anyUnauthorized, guard]);

  const interestedIds = new Set(myInterests as number[]);

  const filtered = (properties as any[]).filter((p) => {
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) &&
        !p.city.toLowerCase().includes(search.toLowerCase()) &&
        !(p.neighborhood ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && p.type !== filterType) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    return true;
  });

  function openAdd() { setForm({ ...EMPTY_FORM }); setEditingProp(null); setShowForm(true); }
  function openEdit(p: any) {
    setForm({
      title: p.title ?? "", description: p.description ?? "", type: p.type ?? "apartamento",
      price: String(p.price ?? ""), condominiumFee: String(p.condominiumFee ?? ""), iptu: String(p.iptu ?? ""),
      address: p.address ?? "", neighborhood: p.neighborhood ?? "", city: p.city ?? "",
      state: p.state ?? "SP", zipCode: p.zipCode ?? "",
      areaSqm: String(p.areaSqm ?? ""), bedrooms: String(p.bedrooms ?? ""),
      bathrooms: String(p.bathrooms ?? ""), parkingSpots: String(p.parkingSpots ?? ""),
      hasFurnished: p.hasFurnished ?? false, hasPool: p.hasPool ?? false,
      hasGym: p.hasGym ?? false, hasBalcony: p.hasBalcony ?? false,
      imageUrl: p.imageUrl ?? "", imageUrl2: p.imageUrl2 ?? "", imageUrl3: p.imageUrl3 ?? "",
      acceptsFgts: p.acceptsFgts ?? true, acceptsMcmv: p.acceptsMcmv ?? false, acceptsSbpe: p.acceptsSbpe ?? true,
      brokerName: p.brokerName ?? "", brokerPhone: p.brokerPhone ?? "",
    });
    setEditingProp(p);
    setShowForm(true);
  }

  function handleSave() {
    const data = {
      title: form.title, description: form.description || undefined, type: form.type as any,
      price: Number(form.price), condominiumFee: form.condominiumFee ? Number(form.condominiumFee) : undefined,
      iptu: form.iptu ? Number(form.iptu) : undefined,
      address: form.address || undefined, neighborhood: form.neighborhood || undefined,
      city: form.city, state: form.state, zipCode: form.zipCode || undefined,
      areaSqm: Number(form.areaSqm), bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined,
      bathrooms: form.bathrooms ? Number(form.bathrooms) : undefined,
      parkingSpots: form.parkingSpots ? Number(form.parkingSpots) : undefined,
      hasFurnished: form.hasFurnished, hasPool: form.hasPool, hasGym: form.hasGym, hasBalcony: form.hasBalcony,
      imageUrl: form.imageUrl || undefined, imageUrl2: form.imageUrl2 || undefined, imageUrl3: form.imageUrl3 || undefined,
      acceptsFgts: form.acceptsFgts, acceptsMcmv: form.acceptsMcmv, acceptsSbpe: form.acceptsSbpe,
      brokerName: form.brokerName || undefined, brokerPhone: form.brokerPhone || undefined,
    };

    if (editingProp) {
      updateProp.mutate({ id: editingProp.id, data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPropertiesQueryKey() });
          toast({ title: "Imóvel atualizado com sucesso" });
          setShowForm(false);
        },
        onError: () => toast({ title: "Erro ao atualizar imóvel", variant: "destructive" }),
      });
    } else {
      createProp.mutate({ data }, {
        onSuccess: (newProp) => {
          // Atualiza o cache local para evitar lista vazia entre refetches
          queryClient.setQueryData(getGetPropertiesQueryKey(), (old) => {
            const prev = (old as any[]) ?? [];
            return [...prev, newProp];
          });
          toast({ title: "Imóvel cadastrado com sucesso!" });
          setShowForm(false);
        },
        onError: () => toast({ title: "Erro ao cadastrar imóvel", variant: "destructive" }),
      });
    }
  }

  function handleDelete(id: number) {
    if (!confirm("Remover este imóvel?")) return;
    deleteProp.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPropertiesQueryKey() });
        toast({ title: "Imóvel removido" });
      },
    });
  }

  function handleInterest(propertyId: number) {
    toggleInterest.mutate({ id: propertyId }, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetMyInterestsQueryKey() });
        toast({ title: (data as any).interested ? "Interesse registrado!" : "Interesse removido" });
      },
    });
  }

  // Corretor sem add-on/plano de Vitrine não deve nem ter acesso à página (a aba está oculta).
  // Se chegar aqui via URL direta, mostramos um aviso direcionando ao Financeiro.
  if (role === "broker" && !hasMarketplaceAccess) {
    return (
      <div className="max-w-xl mx-auto mt-12 bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <Building2 className="w-12 h-12 mx-auto mb-4" style={{ color: "#0D1B8C", opacity: 0.3 }} />
        <h2 className="text-xl font-bold mb-2" style={{ color: "#07113A" }}>Vitrine de Imóveis</h2>
        <p className="text-sm text-gray-500 mb-6">
          Para divulgar seu portfólio de imóveis no marketplace ScoreCasa, contrate o add-on de Vitrine na página Financeiro.
        </p>
        <a
          href="/financeiro"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white"
          style={{ background: "#0D1B8C" }}
        >
          Ir para Financeiro
        </a>
      </div>
    );
  }

  if (guard.sessionExpired) {
    return (
      <div className="max-w-md mx-auto">
        <SessionExpiredBanner
          expired
          description="Sua sessão expirou. Faça login novamente para continuar visualizando os imóveis."
          loginLabel="Fazer login"
          onLogin={() => guard.goToLogin()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>Imóveis</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {canManage
              ? "Gerencie o catálogo de imóveis da plataforma"
              : "Encontre o imóvel ideal divulgado pelos nossos corretores parceiros"}
          </p>
        </div>
        {canManage && (
          <Button
            onClick={openAdd}
            className="flex items-center gap-2 text-white font-semibold"
            style={{ background: "#0D1B8C" }}
          >
            <Plus className="w-4 h-4" /> Cadastrar Imóvel
          </Button>
        )}
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
              placeholder="Buscar por título, cidade, bairro..."
              className="pl-10 h-10 rounded-xl border-gray-200/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-xs font-semibold text-gray-700"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filterType || "__all__"} onValueChange={(v) => setFilterType(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-full sm:w-44 h-10 rounded-xl border-gray-200/80 text-xs font-semibold text-gray-700">
              <SelectValue placeholder="Tipo de Imóvel" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="__all__" className="text-xs font-semibold">Todos os tipos</SelectItem>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs font-semibold">{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canManage && (
            <Select value={filterStatus || "__all__"} onValueChange={(v) => setFilterStatus(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-44 h-10 rounded-xl border-gray-200/80 text-xs font-semibold text-gray-700">
                <SelectValue placeholder="Status do Imóvel" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="__all__" className="text-xs font-semibold">Todos status</SelectItem>
                <SelectItem value="available" className="text-xs font-semibold">Disponível</SelectItem>
                <SelectItem value="reserved" className="text-xs font-semibold">Reservado</SelectItem>
                <SelectItem value="sold" className="text-xs font-semibold">Vendido</SelectItem>
                <SelectItem value="inactive" className="text-xs font-semibold">Inativo</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className={`grid grid-cols-2 ${role === "client" ? "sm:grid-cols-2 max-w-2xl" : "sm:grid-cols-4"} gap-4`}>
        {[
          { label: "Total cadastrados", count: (properties as any[]).length, color: "#0D1B8C", bg: "#EEF2FF", icon: Building2, hideForClient: true },
          { label: "Disponíveis", count: (properties as any[]).filter((p) => p.status === "available").length, color: "#10A65A", bg: "#F0FDF4", icon: CheckCircle },
          { label: "Reservados", count: (properties as any[]).filter((p) => p.status === "reserved").length, color: "#D97706", bg: "#FFFBEB", icon: Home, hideForClient: true },
          { label: "Favoritos (Interesses)", count: interestedIds.size, color: "#EF4444", bg: "#FEF2F2", icon: Heart },
        ]
          .filter((s) => role !== "client" || !s.hideForClient)
          .map((s) => {
            const IconComponent = s.icon;
            return (
              <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center justify-between transition-all hover:shadow-md" style={{ borderLeftWidth: 4, borderLeftColor: s.color }}>
                <div>
                  <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{s.label}</div>
                  <div className="text-2xl font-extrabold text-gray-800 mt-1">{s.count}</div>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.bg, color: s.color }}>
                  <IconComponent className="w-5 h-5" />
                </div>
              </div>
            );
          })}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 h-72 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <Building2 className="w-12 h-12 mx-auto mb-4" style={{ color: "#0D1B8C", opacity: 0.2 }} />
          <p className="text-gray-500 font-medium">Nenhum imóvel encontrado</p>
          {canManage && (
            <Button onClick={openAdd} className="mt-4 text-white" style={{ background: "#0D1B8C" }}>
              <Plus className="w-4 h-4 mr-2" /> Cadastrar primeiro imóvel
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p) => (
            <PropertyCard
              key={p.id}
              prop={p}
              isInterested={interestedIds.has(p.id)}
              onInterest={handleInterest}
              onEdit={openEdit}
              onDelete={handleDelete}
              canManage={canManage}
            />
          ))}
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-bold" style={{ color: "#07113A" }}>
                  {editingProp ? "Editar Imóvel" : "Cadastrar Imóvel"}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Preencha os dados do imóvel</p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Informações básicas */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#0D1B8C" }}>
                  Informações básicas
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Título *</label>
                    <Input placeholder="Ex: Apartamento 3 quartos no Jardins" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Descrição</label>
                    <textarea
                      placeholder="Descreva o imóvel..."
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      className="w-full rounded-lg border border-input text-sm px-3 py-2 min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-[#0D1B8C]/20"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Tipo *</label>
                      <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as any }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Área (m²) *</label>
                      <Input type="number" placeholder="Ex: 85" value={form.areaSqm} onChange={(e) => setForm((f) => ({ ...f, areaSqm: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Valores */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#0D1B8C" }}>Valores</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Preço (R$) *</label>
                    <Input type="number" placeholder="Ex: 450000" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Condomínio (R$)</label>
                    <Input type="number" placeholder="Ex: 800" value={form.condominiumFee} onChange={(e) => setForm((f) => ({ ...f, condominiumFee: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">IPTU anual (R$)</label>
                    <Input type="number" placeholder="Ex: 1200" value={form.iptu} onChange={(e) => setForm((f) => ({ ...f, iptu: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Localização */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#0D1B8C" }}>Localização</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Endereço</label>
                    <Input placeholder="Rua, número" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Bairro</label>
                    <Input placeholder="Ex: Jardins" value={form.neighborhood} onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Cidade *</label>
                    <Input placeholder="Ex: São Paulo" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Estado *</label>
                    <Select value={form.state} onValueChange={(v) => setForm((f) => ({ ...f, state: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BR_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Características */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#0D1B8C" }}>Características</div>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Quartos</label>
                    <Input type="number" min={0} placeholder="0" value={form.bedrooms} onChange={(e) => setForm((f) => ({ ...f, bedrooms: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Banheiros</label>
                    <Input type="number" min={0} placeholder="0" value={form.bathrooms} onChange={(e) => setForm((f) => ({ ...f, bathrooms: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Vagas</label>
                    <Input type="number" min={0} placeholder="0" value={form.parkingSpots} onChange={(e) => setForm((f) => ({ ...f, parkingSpots: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["hasFurnished", "Mobiliado"],
                    ["hasPool", "Piscina"],
                    ["hasGym", "Academia"],
                    ["hasBalcony", "Varanda"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form[key] as boolean} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))} className="rounded" />
                      <span className="text-sm text-gray-600">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Financiamento */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#0D1B8C" }}>Aceita financiamento</div>
                <div className="grid grid-cols-3 gap-2">
                  {([["acceptsFgts", "FGTS"], ["acceptsMcmv", "MCMV"], ["acceptsSbpe", "SBPE"]] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form[key] as boolean} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))} className="rounded" />
                      <span className="text-sm text-gray-600">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Corretor */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#0D1B8C" }}>Corretor responsável</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Nome</label>
                    <Input placeholder="Nome do corretor" value={form.brokerName} onChange={(e) => setForm((f) => ({ ...f, brokerName: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Telefone</label>
                    <Input placeholder="(11) 99999-9999" value={form.brokerPhone} onChange={(e) => setForm((f) => ({ ...f, brokerPhone: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Fotos */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#0D1B8C" }}>Fotos</div>
                  <span className="text-[10px] text-gray-400">(cole um link ou faça upload)</span>
                </div>
                <div className="space-y-4">
                  <ImageUploadField
                    label="foto principal"
                    value={form.imageUrl}
                    onChange={(v) => setForm((f) => ({ ...f, imageUrl: v }))}
                    isUploading={uploadingSlot === 1}
                    onUpload={(file) => handleImageUpload(file, 1)}
                  />
                  <ImageUploadField
                    label="foto 2"
                    value={form.imageUrl2}
                    onChange={(v) => setForm((f) => ({ ...f, imageUrl2: v }))}
                    isUploading={uploadingSlot === 2}
                    onUpload={(file) => handleImageUpload(file, 2)}
                  />
                  <ImageUploadField
                    label="foto 3"
                    value={form.imageUrl3}
                    onChange={(v) => setForm((f) => ({ ...f, imageUrl3: v }))}
                    isUploading={uploadingSlot === 3}
                    onUpload={(file) => handleImageUpload(file, 3)}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-6 border-t border-gray-100 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={createProp.isPending || updateProp.isPending || !form.title || !form.price || !form.city || !form.areaSqm}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
                style={{ background: "#0D1B8C" }}
              >
                <Save className="w-4 h-4" />
                {(createProp.isPending || updateProp.isPending) ? "Salvando..." : (editingProp ? "Atualizar" : "Cadastrar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
