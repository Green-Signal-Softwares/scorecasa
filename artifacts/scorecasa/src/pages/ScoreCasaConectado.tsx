import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useGetMe, useGetLeads, getGetLeadsQueryKey } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Plug, CheckCircle2, AlertCircle, Download, ExternalLink,
  ArrowRightLeft, Building2, ChevronRight, Sparkles, Lock,
} from "lucide-react";

const EXTENSION_ID = "scorecasa-connect";
const EXT_PING_TIMEOUT_MS = 800;

type Bank = {
  id: string;
  name: string;
  shortName: string;
  domain: string;
  color: string;
  bg: string;
  status: "available" | "soon";
};

const BANKS: Bank[] = [
  { id: "caixa",     name: "Caixa Aqui",            shortName: "Caixa",     domain: "caixaaqui.caixa.gov.br", color: "#005CA9", bg: "#E6F1FB", status: "available" },
  { id: "itau",      name: "Itaú Imóveis",          shortName: "Itaú",      domain: "credimovel.itau.com.br", color: "#EC7000", bg: "#FFF3E6", status: "soon" },
  { id: "bradesco",  name: "Bradesco Crédito Imob.",shortName: "Bradesco",  domain: "bradesco.com.br",        color: "#CC092F", bg: "#FCE7EC", status: "soon" },
  { id: "santander", name: "Santander Imóveis",     shortName: "Santander", domain: "santander.com.br",       color: "#EC0000", bg: "#FCE5E5", status: "soon" },
  { id: "bb",        name: "Banco do Brasil",       shortName: "BB",        domain: "bb.com.br",              color: "#FFCC29", bg: "#FFF8DD", status: "soon" },
];

const fmtCurrency = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtCpf = (cpf: string | null | undefined) => {
  const d = (cpf ?? "").replace(/\D/g, "");
  if (d.length !== 11) return cpf ?? "—";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

// ── Detecta se a extensão Chrome está instalada ────────────────────────────
function useExtensionStatus() {
  const [installed, setInstalled] = useState<boolean | null>(null);

  useEffect(() => {
    let done = false;
    const handler = (ev: MessageEvent) => {
      if (ev.source !== window) return;
      if (ev.data && ev.data.source === EXTENSION_ID && ev.data.type === "PONG") {
        done = true;
        setInstalled(true);
      }
    };
    window.addEventListener("message", handler);
    window.postMessage({ source: "scorecasa-app", type: "PING" }, "*");
    const t = setTimeout(() => {
      if (!done) setInstalled(false);
    }, EXT_PING_TIMEOUT_MS);
    return () => {
      clearTimeout(t);
      window.removeEventListener("message", handler);
    };
  }, []);

  return installed;
}

export function ScoreCasaConectado() {
  const { toast } = useToast();
  const { data: me } = useGetMe({ query: { queryKey: ["me"], staleTime: 60_000 } });
  const isCorrespondent = (me?.role as string) === "correspondent";
  const { data: leadsResp, isLoading } = useGetLeads(undefined, {
    query: { queryKey: getGetLeadsQueryKey(), enabled: isCorrespondent },
  });
  const leads = (leadsResp as any)?.data ?? (Array.isArray(leadsResp) ? leadsResp : []);

  const extInstalled = useExtensionStatus();

  // Leads aprovados ou em processo — candidatos a espelhamento
  const ready = useMemo(
    () =>
      (leads as any[]).filter((l: any) =>
        ["approved", "in_progress"].includes(l.status),
      ),
    [leads],
  );

  // Apenas correspondente vê esta página (após todos os hooks)
  if (me && (me.role as string) !== "correspondent") {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <Card className="p-8 text-center">
          <Lock className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <h2 className="text-lg font-bold" style={{ color: "#07113A" }}>
            Ferramenta exclusiva para correspondentes
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            O ScoreCasa Conectado está disponível apenas para perfis de Correspondente Bancário.
          </p>
          <Link href="/dashboard">
            <Button className="mt-5" style={{ background: "#0D1B8C", color: "white" }}>
              Voltar ao Resumo
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const handleSendToBank = (bank: Bank, leadId: number, leadName: string) => {
    if (bank.status !== "available") {
      toast({
        title: "Em breve",
        description: `Integração com ${bank.name} estará disponível na próxima versão da extensão.`,
      });
      return;
    }
    if (!extInstalled) {
      toast({
        variant: "destructive",
        title: "Extensão não detectada",
        description: "Instale a extensão ScoreCasa Conectado no Chrome para enviar dados aos bancos.",
      });
      return;
    }
    window.postMessage(
      {
        source: "scorecasa-app",
        type: "MIRROR_LEAD",
        bank: bank.id,
        leadId,
      },
      "*",
    );
    toast({
      title: `Enviado para ${bank.name}`,
      description: `${leadName} — abra a aba do ${bank.shortName} e os campos serão preenchidos automaticamente.`,
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>
              ScoreCasa Conectado
            </h1>
            <Badge style={{ background: "#7C3AED", color: "white" }}>
              <Sparkles className="w-3 h-3 mr-1" /> Correspondente
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Espelhe os dados do cliente entre o ScoreCasa e os portais dos bancos.
            Preenche os formulários do Caixa Aqui automaticamente — e importa cadastros já existentes nos portais com um clique.
          </p>
        </div>
      </div>

      {/* Status da extensão */}
      <Card className="p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: extInstalled ? "#F0FDF4" : "#FEF2F2",
              color: extInstalled ? "#10A65A" : "#DC2626",
            }}
          >
            {extInstalled ? <CheckCircle2 className="w-6 h-6" /> : <Plug className="w-6 h-6" />}
          </div>
          <div className="flex-1 min-w-[240px]">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold" style={{ color: "#07113A" }}>
                Extensão para Chrome
              </h3>
              {extInstalled === null ? (
                <Badge variant="outline" className="text-xs">Verificando…</Badge>
              ) : extInstalled ? (
                <Badge style={{ background: "#10A65A", color: "white" }} className="text-xs">
                  Instalada e ativa
                </Badge>
              ) : (
                <Badge variant="outline" style={{ borderColor: "#DC2626", color: "#DC2626" }} className="text-xs">
                  Não detectada
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {extInstalled
                ? "Tudo pronto. Abra um portal de banco suportado para começar a espelhar dados."
                : "Instale a extensão ScoreCasa Conectado para liberar o auto-preenchimento e a importação reversa."}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() =>
                toast({
                  title: "Em preparação",
                  description: "O pacote .zip da extensão ficará disponível assim que publicarmos na Chrome Web Store.",
                })
              }
            >
              <Download className="w-4 h-4 mr-2" /> Baixar .zip
            </Button>
            <Button style={{ background: "#0D1B8C", color: "white" }}
              onClick={() =>
                toast({
                  title: "Como instalar",
                  description: "1) Baixe o .zip 2) chrome://extensions 3) Modo desenvolvedor 4) Carregar sem compactação.",
                })
              }
            >
              Como instalar <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Bancos suportados */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Bancos suportados
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {BANKS.map((b) => (
            <Card key={b.id} className="p-4" data-testid={`bank-card-${b.id}`}>
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: b.bg, color: b.color }}
                >
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm truncate" style={{ color: "#07113A" }}>
                      {b.name}
                    </h3>
                    {b.status === "available" ? (
                      <Badge style={{ background: "#10A65A", color: "white" }} className="text-[10px]">
                        Disponível
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Em breve</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{b.domain}</p>
                  {b.status === "available" && (
                    <a
                      href={`https://${b.domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs mt-2 font-medium"
                      style={{ color: "#0D1B8C" }}
                    >
                      Abrir portal <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Leads prontos para espelhar */}
      <div>
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Leads prontos para espelhar
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Apenas leads aprovados ou em processo aparecem aqui.
            </p>
          </div>
          <Badge variant="outline">{ready.length} {ready.length === 1 ? "lead" : "leads"}</Badge>
        </div>

        {isLoading ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">Carregando…</Card>
        ) : ready.length === 0 ? (
          <Card className="p-8 text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium" style={{ color: "#07113A" }}>
              Nenhum lead pronto para espelhar
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Aprove um lead na aba <Link href="/leads" className="underline">Leads</Link> para liberá-lo no ScoreCasa Conectado.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {ready.map((lead: any) => (
              <Card key={lead.id} className="p-4" data-testid={`mirror-lead-${lead.id}`}>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" style={{ color: "#07113A" }}>
                        {lead.name}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {fmtCpf(lead.cpf)}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      <span>Renda: {fmtCurrency(lead.income)}</span>
                      <span>Imóvel: {fmtCurrency(lead.propertyValue)}</span>
                      {lead.propertyCity && (
                        <span>{lead.propertyCity}{lead.propertyState ? `/${lead.propertyState}` : ""}</span>
                      )}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    style={{ background: "#005CA9", color: "white" }}
                    onClick={() => handleSendToBank(BANKS[0], lead.id, lead.name)}
                    data-testid={`send-caixa-${lead.id}`}
                  >
                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                    Enviar para Caixa Aqui
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Como funciona */}
      <Card className="p-5" style={{ background: "#F8FAFC" }}>
        <h3 className="font-semibold mb-3" style={{ color: "#07113A" }}>Como funciona</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="flex items-center gap-2 font-medium mb-1" style={{ color: "#0D1B8C" }}>
              <ArrowRightLeft className="w-4 h-4" /> ScoreCasa → Banco
            </div>
            <p className="text-muted-foreground">
              Com o lead aprovado no ScoreCasa, abra o portal do banco (ex: Caixa Aqui) e a extensão preenche automaticamente todos os campos do formulário.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 font-medium mb-1" style={{ color: "#10A65A" }}>
              <ArrowRightLeft className="w-4 h-4 rotate-180" /> Banco → ScoreCasa
            </div>
            <p className="text-muted-foreground">
              Já tem um cadastro feito direto no Caixa Aqui? Acesse-o e clique em "Importar para o ScoreCasa" — o lead é criado no sistema com todos os dados.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
