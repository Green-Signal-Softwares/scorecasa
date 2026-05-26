import { useState } from "react";
import { Link } from "wouter";
import {
  useGetProperty,
  getGetPropertyQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Building2, MapPin, Ruler, BedDouble, Bath, Car,
  Phone, User as UserIcon, ChevronLeft, ChevronRight, ShieldCheck,
} from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  comercial: "Comercial",
  terreno: "Terreno",
  cobertura: "Cobertura",
  studio: "Studio",
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function PropertyPublic({ id }: { id: number }) {
  const [activeImage, setActiveImage] = useState(0);

  const { data: property, isLoading, error } = useGetProperty(id, {
    query: {
      enabled: Number.isInteger(id) && id > 0,
      retry: false,
      queryKey: getGetPropertyQueryKey(id),
    },
  });

  const base = import.meta.env.BASE_URL;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="h-96 bg-gray-100 rounded-2xl animate-pulse" />
          <div className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <Building2 className="w-12 h-12 mx-auto mb-4" style={{ color: "#0D1B8C", opacity: 0.3 }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: "#07113A" }}>Imóvel indisponível</h2>
          <p className="text-sm text-gray-500 mb-6">
            Este imóvel pode ter sido removido ou o link está incorreto.
          </p>
          <Link href="/cadastro">
            <Button className="text-white" style={{ background: "#0D1B8C" }}>
              Conhecer a ScoreCasa
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const prop = property as any;
  const images: string[] = [prop.imageUrl, prop.imageUrl2, prop.imageUrl3].filter(Boolean);
  const current = images[activeImage] ?? null;

  return (
    <div className="min-h-screen bg-gray-50" data-testid="page-property-public">
      {/* Public header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/">
            <a className="flex items-center gap-2" data-testid="link-scorecasa-home">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ background: "#0D1B8C" }}
              >
                S
              </div>
              <span className="font-bold text-lg" style={{ color: "#07113A" }}>ScoreCasa</span>
            </a>
          </Link>
          <Link href="/cadastro">
            <Button
              size="sm"
              className="text-white"
              style={{ background: "#10A65A" }}
              data-testid="button-header-cta"
            >
              Quero financiar
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto py-6 px-4 space-y-5">
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

          {/* Sidebar */}
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
                <div className="text-sm text-gray-400 italic">Em breve</div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <Link href="/cadastro">
                <Button
                  className="w-full text-white font-semibold"
                  style={{ background: "#10A65A" }}
                  data-testid="button-quero-financiar"
                >
                  Quero financiar este imóvel
                </Button>
              </Link>
              <p className="text-[11px] text-gray-500 text-center leading-relaxed">
                Faça seu cadastro grátis na ScoreCasa, descubra seu score
                imobiliário e simule o financiamento deste imóvel.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start gap-2 text-xs text-gray-500">
                <ShieldCheck className="w-4 h-4 text-[#10A65A] flex-shrink-0 mt-0.5" />
                <span>
                  Anúncio compartilhado por um corretor parceiro da
                  ScoreCasa. Verifique sempre os dados antes de fechar
                  negócio.
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-100 py-6 mt-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} ScoreCasa ·{" "}
          <a href={`${base}termos`} className="hover:text-[#0D1B8C]">Termos</a>
          {" · "}
          <a href={`${base}privacidade`} className="hover:text-[#0D1B8C]">Privacidade</a>
        </div>
      </footer>
    </div>
  );
}

export default PropertyPublic;
