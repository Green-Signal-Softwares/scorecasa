import { useState } from "react";
import {
  useGetMyCorrespondent,
  useLinkCorrespondent,
  getGetMyCorrespondentQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link2, Unlink, Phone, Mail, Building2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const BANK_INFO: Record<string, { label: string; color: string; bg: string }> = {
  caixa: { label: "Caixa", color: "#FFFFFF", bg: "#0D1B8C" },
  bb: { label: "Banco do Brasil", color: "#000000", bg: "#FBBF24" },
  bradesco: { label: "Bradesco", color: "#FFFFFF", bg: "#E11D48" },
  itau: { label: "Itaú", color: "#FFFFFF", bg: "#EA580C" },
  santander: { label: "Santander", color: "#FFFFFF", bg: "#DC2626" },
  inter: { label: "Inter", color: "#FFFFFF", bg: "#F97316" },
};

export function BrokerCorrespondente() {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkCode, setLinkCode] = useState("");
  const [linking, setLinking] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleLinkByCode = () => {
    if (!linkCode) {
      toast({ title: "Erro", description: "CCA / Código é obrigatório.", variant: "destructive" });
      return;
    }
    setLinking(true);
    linkMutation.mutate(
      { data: { code: linkCode } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMyCorrespondentQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["getLeads"] });
          toast({ title: "Correspondente vinculado com sucesso!" });
          setLinkOpen(false);
          setLinkCode("");
        },
        onError: (err: any) => {
          toast({
            title: "Erro ao vincular correspondente",
            description: err?.message || "Tente novamente mais tarde.",
            variant: "destructive",
          });
        },
        onSettled: () => {
          setLinking(false);
        },
      }
    );
  };

  const { data, isLoading } = useGetMyCorrespondent();

  const linkMutation = useLinkCorrespondent();

  const handleUnlink = () => {
    linkMutation.mutate(
      { data: { correspondentId: null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMyCorrespondentQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["getLeads"] });
          toast({ title: "Vinculação removida com sucesso." });
        },
        onError: (err: any) => {
          toast({
            title: "Erro ao desvincular correspondente",
            description: err?.message || "Tente novamente mais tarde.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const linked = data?.linkedCorrespondent;

  const getBankBadge = (bankSlug: string) => {
    const info = BANK_INFO[bankSlug] ?? { label: bankSlug.toUpperCase(), color: "#374151", bg: "#F3F4F6" };
    return (
      <span
        className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
        style={{ color: info.color, backgroundColor: info.bg }}
      >
        {info.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Correspondente Parceiro</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie a vinculação com seu correspondente bancário para envio automático de leads.
          </p>
        </div>

        {!linked && (
          <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
            <DialogTrigger asChild>
              <Button
                className="text-white gap-2 h-10 px-4 rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg shadow-emerald-900/10 hover:-translate-y-0.5 active:translate-y-0"
                style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}
                data-testid="button-link-correspondent-modal"
              >
                <Link2 className="w-4 h-4" />
                Vincular por CCA
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
                      Vincular Correspondente
                    </DialogTitle>
                    <p className="text-[11px] text-blue-200 font-semibold mt-0.5">
                      Vincule um correspondente por CCA ou código de registro
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-5 text-left font-sans">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Insira o CCA ou código do correspondente ativo na plataforma para estabelecer a vinculação e direcionar seus leads.
                </p>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">CCA / Código do Correspondente</label>
                  <Input
                    type="text"
                    value={linkCode}
                    onChange={(e) => setLinkCode(e.target.value)}
                    placeholder="Ex: CCA-23432424 ou 23432424"
                    data-testid="input-link-correspondent-code"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 text-sm outline-none transition-all focus:border-[#0D1B8C] focus:bg-white font-medium text-slate-800"
                  />
                </div>
                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => { setLinkOpen(false); setLinkCode(""); }}
                    className="flex-1 py-3 rounded-2xl text-xs font-bold border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleLinkByCode}
                    disabled={linking}
                    data-testid="button-confirm-link-correspondent"
                    className="flex-1 py-3 rounded-2xl text-xs font-bold text-white transition-all disabled:opacity-60 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-98"
                    style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}
                  >
                    {linking ? "Vinculando..." : "Vincular Correspondente →"}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Linked Correspondent Status */}
      {isLoading ? (
        <Skeleton className="h-44 rounded-xl" />
      ) : linked ? (
        <Card className="border border-card-border overflow-hidden">
          <div className="h-2" style={{ background: "linear-gradient(90deg, #0D1B8C 0%, #10A65A 100%)" }} />
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-800" />
                  {linked.name}
                </CardTitle>
                <CardDescription className="mt-1 flex items-center gap-2 flex-wrap">
                  {getBankBadge(linked.bank)}
                  <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                    {linked.bank === "caixa" ? "CCA: " : "Código: "}{linked.code}
                  </span>
                </CardDescription>
              </div>
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-2 border-red-200"
                onClick={handleUnlink}
                disabled={linkMutation.isPending}
                data-testid="button-unlink-correspondent"
              >
                <Unlink className="w-4 h-4" />
                Desvincular
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 grid sm:grid-cols-2 gap-4 text-sm text-muted-foreground">
            {linked.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" />
                <span>{linked.phone}</span>
              </div>
            )}
            {linked.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" />
                <span>{linked.email}</span>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-amber-50/50 border border-amber-200/60 p-5 rounded-xl">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-800">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 text-sm">Sem vinculação ativa</h3>
              <p className="text-xs text-amber-700/90 mt-1 max-w-xl leading-relaxed">
                Você ainda não tem um correspondente parceiro de preferência. Seus novos leads serão distribuídos de forma aleatória (sorteio) entre os correspondentes ativos. Use o botão no topo da página para vincular diretamente por CCA/Código.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
