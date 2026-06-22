import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetProperty,
  useGetMyInterests,
  useTogglePropertyInterest,
  getGetMyInterestsQueryKey,
  getGetPropertyQueryKey,
  useGetMe,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Building2, MapPin, Ruler, BedDouble, Bath, Car, Heart, ArrowLeft,
  Calculator, Phone, User as UserIcon, CheckCircle2, ChevronLeft, ChevronRight,
  Link2, Check,
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

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function PropertyDetails({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeImage, setActiveImage] = useState(0);
  const [copied, setCopied] = useState(false);

  const { data: me } = useGetMe({});
  const role = (me as any)?.role ?? "client";

  const { data: property, isLoading, error } = useGetProperty(id, {
    query: {
      enabled: Number.isInteger(id) && id > 0,
      retry: false,
      queryKey: getGetPropertyQueryKey(id),
    },
  });
  const { data: myInterests = [] } = useGetMyInterests({});
  const toggleInterest = useTogglePropertyInterest();

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="h-8 w-40 bg-gray-100 rounded animate-pulse" />
        <div className="h-96 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="max-w-xl mx-auto mt-12 bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <Building2 className="w-12 h-12 mx-auto mb-4" style={{ color: "#0D1B8C", opacity: 0.3 }} />
        <h2 className="text-xl font-bold mb-2" style={{ color: "#07113A" }}>Imóvel não encontrado</h2>
        <p className="text-sm text-gray-500 mb-6">
          Este imóvel pode ter sido removido do catálogo ou o link está incorreto.
        </p>
        <Link href={role === "client" ? "/portal/imoveis" : "/imoveis"}>
          <Button className="text-white" style={{ background: "#0D1B8C" }}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para a vitrine
          </Button>
        </Link>
      </div>
    );
  }

  const prop = property as any;
  const isInterested = (myInterests as number[]).includes(prop.id);
  const status = STATUS_COLORS[prop.status] ?? STATUS_COLORS.available;
  const images: string[] = [prop.imageUrl, prop.imageUrl2, prop.imageUrl3].filter(Boolean);
  const current = images[activeImage] ?? null;
  const totalCost = (Number(prop.price) || 0) +
    (prop.condominiumFee ? Number(prop.condominiumFee) * 12 : 0) +
    (prop.iptu ? Number(prop.iptu) : 0);

  const handleInterest = () => {
    toggleInterest.mutate({ id: prop.id }, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetMyInterestsQueryKey() });
        toast({ title: (data as any).interested ? "Interesse registrado!" : "Interesse removido" });
      },
    });
  };

  const handleSimulate = () => {
    if (role === "client") {
      setLocation(`/portal/simulador?prefillProperty=${prop.id}`);
    } else {
      setLocation(`/leads?prefillProperty=${prop.id}`);
    }
  };

  const handleCopyPublicLink = async () => {
    const base = import.meta.env.BASE_URL;
    const url = `${window.location.origin}${base}p/${prop.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Link público copiado!", description: "Cole no WhatsApp para enviar ao cliente." });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({
        title: "Não foi possível copiar",
        description: url,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5" data-testid="page-property-details">
      {/* Breadcrumb / back */}
      <div className="flex items-center justify-between">
        <Link href={role === "client" ? "/portal/imoveis" : "/imoveis"}>
          <button
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#0D1B8C] transition-colors"
            data-testid="link-back-properties"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar para a vitrine
          </button>
        </Link>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: status.bg, color: status.text }}
        >
          {status.label}
        </span>
      </div>

      {/* Gallery */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="relative h-72 sm:h-96 bg-gradient-to-br from-[#0D1B8C]/10 to-[#10A65A]/10">
          {current ? (
            <img
              src={current}
              alt={prop.title}
              className="w-full h-full object-cover"
              data-testid="img-property-active"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Building2 className="w-20 h-20 text-[#0D1B8C]/20" />
            </div>
          )}
          {images.length > 1 && (
            <>
              <button
                onClick={() => setActiveImage((i) => (i === 0 ? images.length - 1 : i - 1))}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white"
                aria-label="Foto anterior"
              >
                <ChevronLeft className="w-5 h-5 text-[#07113A]" />
              </button>
              <button
                onClick={() => setActiveImage((i) => (i + 1) % images.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white"
                aria-label="Próxima foto"
              >
                <ChevronRight className="w-5 h-5 text-[#07113A]" />
              </button>
            </>
          )}
          <div className="absolute top-3 right-3">
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/90 text-[#07113A]">
              {TYPE_LABELS[prop.type] ?? prop.type}
            </span>
          </div>
        </div>
        {images.length > 1 && (
          <div className="flex gap-2 p-3 overflow-x-auto">
            {images.map((src, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImage(idx)}
                className={`relative w-20 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                  idx === activeImage ? "border-[#0D1B8C]" : "border-transparent"
                }`}
                data-testid={`thumb-property-${idx}`}
              >
                <img src={src} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h1
              className="text-2xl font-bold mb-1"
              style={{ color: "#07113A" }}
              data-testid="text-property-title"
            >
              {prop.title}
            </h1>
            {(prop.address || prop.neighborhood || prop.city) && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span>
                  {[prop.address, prop.neighborhood, prop.city, prop.state]
                    .filter(Boolean)
                    .join(", ")}
                  {prop.zipCode ? ` — CEP ${prop.zipCode}` : ""}
                </span>
              </div>
            )}

            <div className="flex items-end gap-4 flex-wrap mb-4">
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">Preço</div>
                <div
                  className="text-3xl font-bold"
                  style={{ color: "#0D1B8C" }}
                  data-testid="text-property-price"
                >
                  {formatBRL(Number(prop.price) || 0)}
                </div>
              </div>
              {prop.condominiumFee ? (
                <div className="text-xs text-gray-500">
                  + {formatBRL(Number(prop.condominiumFee))}/mês cond.
                </div>
              ) : null}
              {prop.iptu ? (
                <div className="text-xs text-gray-500">
                  + {formatBRL(Number(prop.iptu))}/ano IPTU
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {prop.areaSqm ? (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Ruler className="w-4 h-4 text-[#0D1B8C]" /> {prop.areaSqm} m²
                </div>
              ) : null}
              {prop.bedrooms != null && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <BedDouble className="w-4 h-4 text-[#0D1B8C]" /> {prop.bedrooms} quarto
                  {prop.bedrooms !== 1 ? "s" : ""}
                </div>
              )}
              {prop.bathrooms != null && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Bath className="w-4 h-4 text-[#0D1B8C]" /> {prop.bathrooms} banheiro
                  {prop.bathrooms !== 1 ? "s" : ""}
                </div>
              )}
              {prop.parkingSpots != null && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Car className="w-4 h-4 text-[#0D1B8C]" /> {prop.parkingSpots} vaga
                  {prop.parkingSpots !== 1 ? "s" : ""}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {prop.acceptsFgts && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-medium">
                  Aceita FGTS
                </span>
              )}
              {prop.acceptsMcmv && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
                  Minha Casa Minha Vida
                </span>
              )}
              {prop.acceptsSbpe && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                  SBPE
                </span>
              )}
              {prop.hasFurnished && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-medium">
                  Mobiliado
                </span>
              )}
              {prop.hasPool && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-medium">
                  Piscina
                </span>
              )}
              {prop.hasGym && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-medium">
                  Academia
                </span>
              )}
              {prop.hasBalcony && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-medium">
                  Varanda
                </span>
              )}
            </div>
          </div>

          {prop.description && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2
                className="text-xs font-semibold uppercase tracking-wide mb-3"
                style={{ color: "#0D1B8C" }}
              >
                Descrição
              </h2>
              <p
                className="text-sm text-gray-600 whitespace-pre-line leading-relaxed"
                data-testid="text-property-description"
              >
                {prop.description}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar: broker contact + CTA */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <div
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "#0D1B8C" }}
            >
              Corretor responsável
            </div>
            {prop.brokerName || prop.brokerPhone ? (
              <>
                {prop.brokerName && (
                  <div className="flex items-center gap-2 text-sm text-[#07113A]" data-testid="text-broker-name">
                    <UserIcon className="w-4 h-4 text-gray-400" /> {prop.brokerName}
                  </div>
                )}
                {prop.brokerPhone && (
                  <a
                    href={`tel:${String(prop.brokerPhone).replace(/\D/g, "")}`}
                    className="flex items-center gap-2 text-sm text-[#0D1B8C] hover:underline"
                    data-testid="link-broker-phone"
                  >
                    <Phone className="w-4 h-4" /> {prop.brokerPhone}
                  </a>
                )}
              </>
            ) : (
              <div className="text-sm text-gray-400 italic">Não informado</div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <Button
              onClick={handleSimulate}
              className="w-full text-white font-semibold gap-2"
              style={{ background: "#0D1B8C" }}
              data-testid="button-simulate-financing"
            >
              <Calculator className="w-4 h-4" /> Simular financiamento
            </Button>
            <button
              onClick={handleInterest}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-semibold transition-all"
              style={isInterested
                ? { background: "#FEF2F2", color: "#EF4444", border: "1px solid #FCA5A5" }
                : { background: "#F0FDF4", color: "#10A65A", border: "1px solid #86EFAC" }}
              data-testid="button-toggle-interest"
            >
              <Heart className={`w-4 h-4 ${isInterested ? "fill-red-400" : ""}`} />
              {isInterested ? "Remover interesse" : "Tenho interesse"}
            </button>
            <button
              onClick={handleCopyPublicLink}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-semibold transition-all border"
              style={{
                background: copied ? "#F0FDF4" : "#FFFFFF",
                color: copied ? "#10A65A" : "#0D1B8C",
                borderColor: copied ? "#86EFAC" : "#C7D2FE",
              }}
              data-testid="button-copy-public-link"
            >
              {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
              {copied ? "Link copiado" : "Copiar link público"}
            </button>
            <p className="text-[11px] text-gray-400 text-center leading-relaxed">
              A simulação será iniciada com os dados deste imóvel pré-preenchidos no cadastro do lead.
              O link público pode ser enviado ao cliente por WhatsApp.
            </p>
          </div>

          {totalCost > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: "#0D1B8C" }}
              >
                Custo total estimado (ano 1)
              </div>
              <div className="text-xl font-bold" style={{ color: "#07113A" }}>
                {formatBRL(totalCost)}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Inclui preço, 12× condomínio e IPTU anual.
              </p>
              <div className="mt-3 flex items-start gap-1.5 text-[11px] text-gray-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10A65A] flex-shrink-0 mt-0.5" />
                <span>Use a simulação para calcular score e parcelas para esse imóvel.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PropertyDetails;
