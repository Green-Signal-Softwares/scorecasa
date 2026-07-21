import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useGetProperties,
  useTogglePropertyInterest,
  useGetMyInterests,
  useGetMe,
  getGetMeQueryKey,
  getGetPropertiesQueryKey,
  getGetMyInterestsQueryKey,
  customFetch,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Search,
  MapPin,
  Ruler,
  BedDouble,
  Bath,
  Car,
  Heart,
  Eye,
  SlidersHorizontal,
  Building2,
  Phone,
  Calculator,
  ArrowLeft,
  CheckCircle2,
  X,
  XCircle,
  AlertTriangle,
  Info,
  DollarSign,
  HeartOff,
  Landmark,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// ── Property Details Bottom Sheet / Overlay ──────────────────────────────────
function PropertyDetailsModal({
  propertyId,
  onClose,
  isInterested,
  onToggleInterest,
}: {
  propertyId: number;
  onClose: () => void;
  isInterested: boolean;
  onToggleInterest: () => void;
}) {
  const [, setLocation] = useLocation();
  const [activeImage, setActiveImage] = useState(0);
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await customFetch<any>(`/api/properties/${propertyId}`);
        if (active) {
          setProperty(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [propertyId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-[#0D1B8C] rounded-full animate-spin" />
          <span className="text-xs text-gray-500 font-semibold">Carregando detalhes...</span>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="font-bold text-gray-800">Imóvel não encontrado</h3>
          <button onClick={onClose} className="mt-4 px-5 py-2.5 bg-[#0D1B8C] text-white rounded-xl text-xs font-bold w-full">
            Fechar
          </button>
        </div>
      </div>
    );
  }

  const images = [property.imageUrl, property.imageUrl2, property.imageUrl3].filter(Boolean);
  const currentImage = images[activeImage] ?? null;
  const totalCost = (Number(property.price) || 0) +
    (property.condominiumFee ? Number(property.condominiumFee) * 12 : 0) +
    (property.iptu ? Number(property.iptu) : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[#F8FAFC] rounded-t-[32px] w-full max-h-[92vh] overflow-y-auto flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Drag Handle / Close indicator */}
        <div className="flex justify-center py-3">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>

        {/* Gallery */}
        <div className="relative h-64 bg-gray-100 flex-shrink-0">
          {currentImage ? (
            <img src={currentImage} alt={property.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-200">
              <Building2 className="w-12 h-12 text-gray-400" />
            </div>
          )}

          {/* Close Floating */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center shadow-md active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-gray-800" />
          </button>

          {/* Heart Floating */}
          <button
            onClick={onToggleInterest}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center shadow-md active:scale-95 text-gray-400"
          >
            <Heart className={`w-4 h-4 ${isInterested ? "fill-red-500 text-red-500" : ""}`} />
          </button>

          {/* Indicators */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 px-3 py-1 rounded-full text-[10px] text-white font-bold">
              {activeImage + 1} / {images.length}
            </div>
          )}
        </div>

        {/* Carousel thumbnails */}
        {images.length > 1 && (
          <div className="flex gap-2 px-5 pt-3 overflow-x-auto">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={`w-16 h-12 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                  i === activeImage ? "border-[#0D1B8C] scale-95" : "border-transparent"
                }`}
              >
                <img src={img} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Details Content */}
        <div className="p-5 space-y-5 flex-1">
          <div>
            <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded bg-gray-200 text-gray-700">
              {TYPE_LABELS[property.type] ?? property.type}
            </span>
            <h2 className="text-lg font-extrabold text-[#07113A] mt-2 leading-snug">{property.title}</h2>
            {(property.address || property.neighborhood || property.city) && (
              <div className="flex items-center gap-1 mt-1 text-xs text-gray-400 font-medium">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{[property.neighborhood, property.city, property.state].filter(Boolean).join(", ")}</span>
              </div>
            )}
          </div>

          {/* Specs */}
          <div className="grid grid-cols-4 gap-1 text-center bg-white p-3 rounded-2xl border border-gray-100 shadow-xs">
            <div className="flex flex-col items-center">
              <span className="text-gray-400 text-[8px] uppercase font-bold">Área</span>
              <span className="font-extrabold text-gray-800 text-xs mt-0.5">{property.areaSqm ? `${property.areaSqm}m²` : "—"}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-gray-400 text-[8px] uppercase font-bold">Quartos</span>
              <span className="font-extrabold text-gray-800 text-xs mt-0.5">{property.bedrooms ?? "—"}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-gray-400 text-[8px] uppercase font-bold">Banheiros</span>
              <span className="font-extrabold text-gray-800 text-xs mt-0.5">{property.bathrooms ?? "—"}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-gray-400 text-[8px] uppercase font-bold">Vagas</span>
              <span className="font-extrabold text-gray-800 text-xs mt-0.5">{property.parkingSpots ?? "—"}</span>
            </div>
          </div>

          {/* Pricing Box */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-2">
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Custo do Imóvel</div>
            <div className="text-2xl font-extrabold text-[#0D1B8C]">{fmtBRL(property.price)}</div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1.5 border-t border-gray-50">
              {property.condominiumFee > 0 && (
                <div>
                  <span className="text-gray-400 text-[10px]">Condomínio:</span>
                  <div className="font-bold text-gray-700">{fmtBRL(property.condominiumFee)}/mês</div>
                </div>
              )}
              {property.iptu > 0 && (
                <div>
                  <span className="text-gray-400 text-[10px]">IPTU anual:</span>
                  <div className="font-bold text-gray-700">{fmtBRL(property.iptu)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {property.description && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Descrição</h4>
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{property.description}</p>
            </div>
          )}

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 pt-2">
            {property.acceptsFgts && <span className="text-[9px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold uppercase">FGTS</span>}
            {property.acceptsMcmv && <span className="text-[9px] px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-bold uppercase">MCMV</span>}
            {property.acceptsSbpe && <span className="text-[9px] px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold uppercase">SBPE</span>}
            {property.hasFurnished && <span className="text-[9px] px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-bold uppercase">Mobiliado</span>}
            {property.hasPool && <span className="text-[9px] px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-bold uppercase">Piscina</span>}
            {property.hasGym && <span className="text-[9px] px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-bold uppercase">Academia</span>}
          </div>

          {/* Broker Section */}
          {(property.brokerName || property.brokerPhone) && (
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Corretor Responsável</h4>
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xs font-bold text-gray-800">{property.brokerName || "Parceiro ScoreCasa"}</div>
                  {property.brokerPhone && (
                    <div className="text-[10px] text-gray-400 font-semibold mt-0.5">{property.brokerPhone}</div>
                  )}
                </div>
                {property.brokerPhone && (
                  <a
                    href={`tel:${String(property.brokerPhone).replace(/\D/g, "")}`}
                    className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 active:scale-95 shadow-xs border border-emerald-100"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                onClose();
                setLocation(`/portal/score`); // Navigate to Banks simulation in score tab
              }}
              className="flex-1 py-3.5 bg-[#0D1B8C] text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-98"
            >
              <Calculator className="w-4 h-4" />
              Simular Financiamento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bottom Navigation ────────────────────────────────────────────────────────
function BottomNav({ activePage, onLogout }: { activePage: string; onLogout: () => void }) {
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
        const active = activePage === key;
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

// ── ImoveisMobile Page ────────────────────────────────────────────────────────
export function ImoveisMobile() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);

  const { data: me } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 60_000 },
  });

  const { data: properties = [], isLoading } = useGetProperties();
  const { data: myInterests = [] } = useGetMyInterests();
  const toggleInterest = useTogglePropertyInterest();

  const interestedIds = new Set(myInterests as number[]);

  // Filter properties
  const filtered = useMemo(() => {
    return (properties as any[]).filter((p) => {
      // Client only views "available" properties
      if (p.status !== "available") return false;

      if (search && !p.title.toLowerCase().includes(search.toLowerCase()) &&
          !p.city.toLowerCase().includes(search.toLowerCase()) &&
          !(p.neighborhood ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      if (filterType && p.type !== filterType) return false;
      return true;
    });
  }, [properties, search, filterType]);

  const handleInterest = (propertyId: number) => {
    toggleInterest.mutate({ id: propertyId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyInterestsQueryKey() });
      },
    });
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

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#F2F4F7", fontFamily: "Poppins, sans-serif", paddingBottom: 90 }}
    >
      {/* Header Banner */}
      <div
        className="px-5 pt-14 pb-6"
        style={{ background: "linear-gradient(160deg, #0D1B8C 0%, #07113A 100%)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>
              Catálogo de
            </div>
            <div className="text-base font-bold text-white">
              Imóveis
            </div>
          </div>
          <span className="text-[10px] font-semibold text-[#10A65A] bg-[#10A65A]/10 border border-[#10A65A]/25 px-2.5 py-0.5 rounded-full">
            {filtered.length} disponíveis
          </span>
        </div>

        {/* Search Input inside header */}
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por título, bairro ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-xs text-white placeholder-gray-400 focus:outline-none focus:border-white/30"
          />
        </div>

        {/* Quick Filter Badges */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
          <button
            onClick={() => setFilterType("")}
            className={`px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
              !filterType ? "bg-white text-[#07113A]" : "bg-white/10 text-white/80"
            }`}
          >
            Todos
          </button>
          {Object.entries(TYPE_LABELS).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilterType(k)}
              className={`px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all flex-shrink-0 ${
                filterType === k ? "bg-white text-[#07113A]" : "bg-white/10 text-white/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="flex-1 px-4 pt-4 space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-3xl border border-gray-100 h-52 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 p-6">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <h4 className="font-bold text-gray-700 text-sm">Nenhum imóvel encontrado</h4>
            <p className="text-xs text-gray-400 mt-1">Experimente mudar os filtros ou o termo de busca.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filtered.map((prop) => {
              const isFav = interestedIds.has(prop.id);
              return (
                <div
                  key={prop.id}
                  onClick={() => setSelectedPropertyId(prop.id)}
                  className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col active:scale-[0.99] transition-all"
                >
                  {/* Image Header */}
                  <div className="relative h-44 bg-gray-100">
                    {prop.imageUrl ? (
                      <img src={prop.imageUrl} alt={prop.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-200">
                        <Building2 className="w-12 h-12 text-gray-400" />
                      </div>
                    )}

                    {/* Status floating */}
                    <div className="absolute top-3 left-3 bg-black/60 px-2 py-0.5 rounded text-[8px] font-extrabold text-white uppercase tracking-wider">
                      {TYPE_LABELS[prop.type] ?? prop.type}
                    </div>

                    {/* Heart indicator */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInterest(prop.id);
                      }}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/95 backdrop-blur-xs flex items-center justify-center text-gray-400"
                    >
                      <Heart className={`w-4 h-4 ${isFav ? "fill-red-500 text-red-500" : ""}`} />
                    </button>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-extrabold text-[#0D1B8C]">{fmtBRL(prop.price)}</div>
                      <h3 className="font-bold text-[#07113A] text-sm mt-1 line-clamp-1">{prop.title}</h3>
                      {prop.city && (
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-400 font-medium">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span>{[prop.neighborhood, prop.city].filter(Boolean).join(", ")}</span>
                        </div>
                      )}
                    </div>

                    {/* Specifications footer */}
                    <div className="flex items-center justify-between border-t border-gray-50 pt-3 mt-3">
                      <div className="flex gap-3 text-[10px] text-gray-500 font-semibold">
                        <span className="flex items-center gap-0.5"><Ruler className="w-3 h-3" /> {prop.areaSqm ? `${prop.areaSqm}m²` : "—"}</span>
                        <span className="flex items-center gap-0.5"><BedDouble className="w-3 h-3" /> {prop.bedrooms ?? "—"}</span>
                        <span className="flex items-center gap-0.5"><Bath className="w-3 h-3" /> {prop.bathrooms ?? "—"}</span>
                      </div>
                      <div className="flex gap-1">
                        {prop.acceptsMcmv && (
                          <span className="text-[7px] font-extrabold px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded">MCMV</span>
                        )}
                        {prop.acceptsSbpe && (
                          <span className="text-[7px] font-extrabold px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded">SBPE</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Details modal overlay */}
      {selectedPropertyId && (
        <PropertyDetailsModal
          propertyId={selectedPropertyId}
          onClose={() => setSelectedPropertyId(null)}
          isInterested={interestedIds.has(selectedPropertyId)}
          onToggleInterest={() => handleInterest(selectedPropertyId)}
        />
      )}

      {/* Bottom Nav */}
      <BottomNav activePage="imoveis" onLogout={handleLogout} />
    </div>
  );
}
