import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  Loader2,
  X,
  Search,
  Sparkles,
  ChevronRight,
  Building2,
  Mail,
  Phone,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getGetClientProfileQueryKey } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Tipos espelhando o response da API ─────────────────────────────────────
export type Correspondent = {
  id: number;
  name: string;
  bank: string;
  code: string;
  email: string | null;
  phone: string | null;
  status: "active" | "inactive";
};
export type BankOption = {
  bank: string;
  shortName: string;
  name: string;
  color: string;
  bgColor: string | null;
  eligible: boolean;
  eligibilityLabel: string | null;
};
export type BanksAndCorrespondentsResponse = {
  banks: BankOption[];
  correspondents: Correspondent[];
  chosenBank: string | null;
  linkedCorrespondentId: number | null;
  linkedCorrespondent: Correspondent | null;
};

export const BANKS_AND_CORRESPONDENTS_QK = ["clientBanksAndCorrespondents"] as const;

async function fetchBanksAndCorrespondents(): Promise<BanksAndCorrespondentsResponse> {
  const r = await fetch(`${BASE}/api/client/banks-and-correspondents`, { credentials: "include" });
  if (!r.ok) throw new Error("Falha ao carregar bancos e correspondentes");
  return r.json();
}

async function chooseFinancing(body: {
  bank: string | null;
  correspondentId?: number | null;
  correspondentCode?: string | null;
  autoAssign?: boolean;
}): Promise<BanksAndCorrespondentsResponse> {
  const r = await fetch(`${BASE}/api/client/choose-financing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error ?? "Falha ao salvar escolha");
  return j;
}

// ── Hook compartilhado pelas duas superfícies ──────────────────────────────
export function useBanksAndCorrespondents() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: BANKS_AND_CORRESPONDENTS_QK,
    queryFn: fetchBanksAndCorrespondents,
    staleTime: 15_000,
  });

  const mutation = useMutation({
    mutationFn: chooseFinancing,
    onSuccess: (data) => {
      qc.setQueryData(BANKS_AND_CORRESPONDENTS_QK, data);
      // Invalida o profile pra que a aba Documentos e o resto da UI
      // peguem proceedWithBank/linkedCorrespondent atualizados.
      qc.invalidateQueries({ queryKey: getGetClientProfileQueryKey() });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Tente novamente." });
    },
  });

  return { query, mutation };
}

// ── Componente: card resumo do vínculo atual ───────────────────────────────
function LinkedSummary({
  data,
  onChange,
  onClear,
  pending,
}: {
  data: BanksAndCorrespondentsResponse;
  onChange: () => void;
  onClear: () => void;
  pending: boolean;
}) {
  const bank = data.banks.find((b) => b.bank === data.chosenBank);
  const corr = data.linkedCorrespondent;

  return (
    <div
      className="rounded-2xl border p-4 flex items-start gap-3"
      style={{ background: "#ECFDF5", borderColor: "#10A65A55" }}
      data-testid="financing-linked-summary"
    >
      <CheckCircle2 className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-emerald-900">
          Financiamento vinculado{bank ? ` ao ${bank.name}` : ""}
        </div>
        {corr ? (
          <div className="mt-1 text-xs text-emerald-900 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> <strong>{corr.name}</strong> · código{" "}
              <code className="font-mono">{corr.code}</code>
            </div>
            {corr.email && (
              <div className="flex items-center gap-1.5">
                <Mail className="w-3 h-3" /> {corr.email}
              </div>
            )}
            {corr.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="w-3 h-3" /> {corr.phone}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-1 text-xs text-emerald-900">
            Você escolheu o banco mas ainda não vinculou um correspondente.
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <button
          type="button"
          onClick={onChange}
          disabled={pending}
          className="text-xs font-semibold text-emerald-900 underline hover:no-underline disabled:opacity-50"
          data-testid="financing-change-btn"
        >
          Trocar
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={pending}
          className="text-xs font-medium text-emerald-900/70 underline hover:no-underline disabled:opacity-50"
          data-testid="financing-clear-btn"
        >
          Desfazer
        </button>
      </div>
    </div>
  );
}

// ── Modal: lista de correspondentes / código manual / auto-assign ──────────
function CorrespondentModal({
  bank,
  corrs,
  currentId,
  onClose,
  onPick,
  pending,
}: {
  bank: BankOption;
  corrs: Correspondent[];
  currentId: number | null;
  onClose: () => void;
  onPick: (input: { correspondentId?: number; correspondentCode?: string; autoAssign?: boolean }) => void;
  pending: boolean;
}) {
  const [query, setQuery] = useState("");
  const [manualCode, setManualCode] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sameBank = corrs.filter((c) => c.bank === bank.bank);
    if (!q) return sameBank;
    return sameBank.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [corrs, bank.bank, query]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      data-testid="correspondent-modal"
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs"
              style={{ background: bank.color }}
            >
              {bank.shortName}
            </div>
            <div>
              <div className="text-base font-bold text-[#07113A]">
                Escolha seu correspondente
              </div>
              <div className="text-xs text-gray-500">{bank.name}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-auto">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou código"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#0D1B8C] focus:ring-1 focus:ring-[#0D1B8C]/20 outline-none"
              data-testid="correspondent-search"
            />
          </div>

          {/* Lista */}
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-xl">
                Nenhum correspondente {bank.name} encontrado.
              </div>
            ) : (
              filtered.map((c) => {
                const isCurrent = c.id === currentId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onPick({ correspondentId: c.id })}
                    disabled={pending}
                    className={`w-full text-left rounded-xl border p-3 flex items-center gap-3 transition-colors hover:border-[#0D1B8C] hover:bg-[#EEF1FF] disabled:opacity-60 ${
                      isCurrent ? "border-emerald-500 bg-emerald-50" : "border-gray-200"
                    }`}
                    data-testid={`correspondent-row-${c.id}`}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: bank.color }}
                    >
                      {bank.shortName}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{c.name}</div>
                      <div className="text-xs text-gray-500">
                        Código <code className="font-mono">{c.code}</code>
                      </div>
                    </div>
                    {isCurrent ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Código manual */}
          <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
            <div className="text-xs font-semibold text-gray-700 mb-1">
              Já tenho um código de correspondente
            </div>
            <p className="text-[11px] text-gray-500 mb-2">
              Se você já recebeu um código de um correspondente {bank.name} (ex.: CCA-1024),
              digite abaixo para linkar direto.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Ex.: CCA-1024"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:border-[#0D1B8C] focus:ring-1 focus:ring-[#0D1B8C]/20 outline-none"
                data-testid="correspondent-code-input"
              />
              <button
                type="button"
                onClick={() => onPick({ correspondentCode: manualCode.trim() })}
                disabled={pending || !manualCode.trim()}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: "#0D1B8C" }}
                data-testid="correspondent-code-submit"
              >
                Linkar
              </button>
            </div>
          </div>

          {/* Auto-assign */}
          <div
            className="rounded-xl border p-3 flex items-start gap-3"
            style={{ background: "#FEF3C7", borderColor: "#F59E0B66" }}
          >
            <Sparkles className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-xs font-semibold text-amber-900">Não tenho correspondente</div>
              <p className="text-[11px] text-amber-900/80 mt-0.5 mb-2">
                A gente escolhe um correspondente {bank.name} disponível pra tocar o seu processo.
              </p>
              <button
                type="button"
                onClick={() => onPick({ autoAssign: true })}
                disabled={pending}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                style={{ background: "#92400E" }}
                data-testid="correspondent-auto-assign"
              >
                {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : "Escolher automaticamente"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Componente público ─────────────────────────────────────────────────────
export function BankAndCorrespondentPicker({
  variant = "full",
  initialBank,
  onOpened,
}: {
  // "full" mostra o seletor inteiro de bancos + correspondente.
  // "summary" mostra apenas o vínculo atual com botão "Trocar" (compacto).
  variant?: "full" | "summary";
  initialBank?: string | null;
  onOpened?: () => void;
}) {
  const { query, mutation } = useBanksAndCorrespondents();
  const [openBank, setOpenBank] = useState<string | null>(initialBank ?? null);

  if (query.isLoading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }
  if (query.error || !query.data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
        <AlertCircle className="w-4 h-4" /> Não foi possível carregar bancos e correspondentes.
      </div>
    );
  }
  const data = query.data;

  const handlePickCorrespondent = (
    bankSlug: string,
    input: { correspondentId?: number; correspondentCode?: string; autoAssign?: boolean },
  ) => {
    mutation.mutate(
      { bank: bankSlug, ...input },
      { onSuccess: () => setOpenBank(null) },
    );
  };

  const handlePickBank = (bankSlug: string) => {
    // Se o cliente trocou de banco, abre o modal pra escolher correspondente novo.
    // Se manteve o banco atual, também reabre pra trocar correspondente.
    if (bankSlug === data.chosenBank && data.linkedCorrespondentId) {
      setOpenBank(bankSlug);
      return;
    }
    // Persiste o banco escolhido (sem correspondente ainda) e abre modal.
    mutation.mutate(
      { bank: bankSlug },
      { onSuccess: () => setOpenBank(bankSlug) },
    );
    onOpened?.();
  };

  const handleClear = () => mutation.mutate({ bank: null });

  // Variant summary: usado em locais onde já mostramos os bancos detalhados
  // (BankComparison). Apenas o resumo do vínculo + botão trocar.
  if (variant === "summary") {
    if (!data.chosenBank) return null;
    return (
      <LinkedSummary
        data={data}
        onChange={() => setOpenBank(data.chosenBank)}
        onClear={handleClear}
        pending={mutation.isPending}
      />
    );
  }

  const modalBank = openBank ? data.banks.find((b) => b.bank === openBank) : null;

  return (
    <>
      <div className="space-y-4">
        {data.chosenBank && (
          <LinkedSummary
            data={data}
            onChange={() => setOpenBank(data.chosenBank)}
            onClear={handleClear}
            pending={mutation.isPending}
          />
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-bold text-[#07113A]">Escolha o banco do seu financiamento</h2>
          <p className="text-xs text-gray-500 mt-1 mb-4">
            Selecione com qual banco você quer prosseguir. Em seguida você vincula o correspondente que vai tocar o processo.
            Trocar de banco limpa o correspondente anterior.
          </p>
          <div className="grid sm:grid-cols-2 gap-3" data-testid="bank-picker-grid">
            {data.banks.map((b) => {
              const isChosen = b.bank === data.chosenBank;
              return (
                <button
                  key={b.bank}
                  type="button"
                  onClick={() => handlePickBank(b.bank)}
                  disabled={!b.eligible || mutation.isPending}
                  className={`text-left rounded-xl border p-3 flex items-center gap-3 transition-all hover:border-[#0D1B8C] hover:bg-[#EEF1FF] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-white ${
                    isChosen ? "border-emerald-500 bg-emerald-50" : "border-gray-200"
                  }`}
                  data-testid={`bank-picker-${b.bank}`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                    style={{ background: b.color }}
                  >
                    {b.shortName}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{b.name}</div>
                    <div
                      className="text-[11px] font-medium"
                      style={{ color: b.eligible ? "#065F46" : "#92400E" }}
                    >
                      {b.eligibilityLabel ?? (b.eligible ? "Elegível" : "Em análise")}
                    </div>
                  </div>
                  {isChosen && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {modalBank && (
        <CorrespondentModal
          bank={modalBank}
          corrs={data.correspondents}
          currentId={data.linkedCorrespondentId}
          onClose={() => setOpenBank(null)}
          onPick={(input) => handlePickCorrespondent(modalBank.bank, input)}
          pending={mutation.isPending}
        />
      )}
    </>
  );
}
