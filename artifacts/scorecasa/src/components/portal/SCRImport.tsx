import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetClientProfileQueryKey } from "@workspace/api-client-react";

type Operacao = {
  instituicao: string;
  modalidade?: string;
  categoria?: string;
  emDia?: number;
  vencida?: number;
  saldoDevedor?: number;
  parcelaMensal?: number | null;
  limiteCredito?: number;
};

type Lead = {
  bcbTotalDebt?: number | null;
  bcbMonthlyCommitment?: number | null;
  bcbOperationsCount?: number | null;
  bcbQueryDate?: string | null;
  bcbDebtsCurrent?: number | null;
  bcbDebtsOverdue?: number | null;
  bcbCreditLimits?: number | null;
  bcbOperationsJson?: string | null;
};

const fmtBRL = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      const idx = r.indexOf(",");
      resolve(idx >= 0 ? r.slice(idx + 1) : r);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function SCRImport({ lead }: { lead: Lead }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasData =
    lead.bcbDebtsCurrent != null ||
    lead.bcbDebtsOverdue != null ||
    lead.bcbTotalDebt != null ||
    lead.bcbOperationsCount != null;

  let operacoes: Operacao[] = [];
  if (lead.bcbOperationsJson) {
    try {
      const parsed = JSON.parse(lead.bcbOperationsJson);
      if (Array.isArray(parsed)) operacoes = parsed;
    } catch {
      // ignore parse errors
    }
  }

  const byInstitution = new Map<string, Operacao[]>();
  for (const op of operacoes) {
    const key = op.instituicao || "—";
    if (!byInstitution.has(key)) byInstitution.set(key, []);
    byInstitution.get(key)!.push(op);
  }

  async function handleFile(file: File) {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      if (!/pdf/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
        throw new Error("Envie o PDF do Relatório SCR baixado em gov.br/Registrato.");
      }
      const imageBase64 = await fileToBase64(file);
      const importRes = await fetch("/api/client/scr-import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          mimeType: file.type || "application/pdf",
        }),
      });
      if (!importRes.ok) {
        const j = await importRes.json().catch(() => ({}));
        throw new Error(j.error || `Falha ao processar o SCR (${importRes.status}).`);
      }

      await qc.invalidateQueries({ queryKey: getGetClientProfileQueryKey() });
      setSuccess("Relatório SCR importado com sucesso. Seus indicadores foram atualizados.");
    } catch (e: any) {
      setError(e?.message ?? "Erro ao processar o arquivo.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6 bg-white">
      <div className="px-5 py-4 border-b border-gray-100" style={{ background: "#0D1B8C" }}>
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">RELATÓRIO SCR · BANCO CENTRAL</p>
        <p className="text-white font-bold text-lg leading-tight mt-0.5">Empréstimos e Financiamentos (Registrato)</p>
        <p className="text-blue-100 text-xs mt-2 leading-relaxed">
          Importe seu relatório SCR oficial para enriquecer sua análise. Você baixa direto no gov.br — leva menos de 2 minutos.
        </p>
      </div>

      <div className="p-5 space-y-4">
        {/* Steps */}
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
          <p className="font-bold text-sm mb-2" style={{ color: "#0D1B8C" }}>Como obter seu SCR em 3 passos:</p>
          <ol className="space-y-2 text-sm text-gray-700">
            <li className="flex gap-2">
              <span className="font-bold flex-shrink-0" style={{ color: "#0D1B8C" }}>1.</span>
              <span>Acesse o <strong>Registrato</strong> do Banco Central com sua conta gov.br.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold flex-shrink-0" style={{ color: "#0D1B8C" }}>2.</span>
              <span>No menu, escolha <strong>“Relatório de Empréstimos e Financiamentos (SCR)”</strong> e baixe o PDF.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold flex-shrink-0" style={{ color: "#0D1B8C" }}>3.</span>
              <span>Faça o <strong>upload aqui embaixo</strong>. A leitura é automática.</span>
            </li>
          </ol>
          <a
            href="https://www.bcb.gov.br/meubc/registrato"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90"
            style={{ background: "#10A65A" }}
            data-testid="link-registrato"
          >
            Acessar gov.br Registrato
            <span aria-hidden>↗</span>
          </a>
        </div>

        {/* Upload */}
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-5 text-center">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
            data-testid="input-scr-pdf"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "#0D1B8C" }}
            data-testid="button-upload-scr"
          >
            {busy ? "Lendo PDF…" : hasData ? "Substituir relatório SCR" : "Enviar PDF do SCR"}
          </button>
          <p className="text-xs text-gray-400 mt-2">Apenas PDF. Seus dados ficam visíveis somente para você.</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700" data-testid="text-scr-error">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2 text-sm text-green-700" data-testid="text-scr-success">
            {success}
          </div>
        )}

        {/* Extracted data */}
        {hasData && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-gray-100 p-3 bg-gray-50">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Em dia</p>
                <p className="text-lg font-bold mt-1" style={{ color: "#10A65A" }}>{fmtBRL(lead.bcbDebtsCurrent)}</p>
              </div>
              <div className="rounded-xl border border-gray-100 p-3 bg-gray-50">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Vencidas</p>
                <p className="text-lg font-bold mt-1" style={{ color: lead.bcbDebtsOverdue ? "#EF4444" : "#10A65A" }}>
                  {fmtBRL(lead.bcbDebtsOverdue)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 p-3 bg-gray-50">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Limites de crédito</p>
                <p className="text-lg font-bold mt-1" style={{ color: "#0D1B8C" }}>{fmtBRL(lead.bcbCreditLimits)}</p>
              </div>
              <div className="rounded-xl border border-gray-100 p-3 bg-gray-50">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Operações</p>
                <p className="text-lg font-bold mt-1" style={{ color: "#07113A" }}>{lead.bcbOperationsCount ?? "—"}</p>
              </div>
            </div>

            {lead.bcbQueryDate && (
              <p className="text-xs text-gray-500">
                Mês de referência: <strong>{lead.bcbQueryDate}</strong>
              </p>
            )}

            {byInstitution.size > 0 && (
              <div>
                <p className="font-bold text-sm text-gray-800 mb-2">Por instituição</p>
                <div className="rounded-xl border border-gray-100 overflow-hidden text-sm">
                  <div className="grid grid-cols-[1.7fr_1fr_1fr_1fr] bg-gray-50 px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                    <span>Instituição / modalidade</span>
                    <span className="text-right">Em dia</span>
                    <span className="text-right">Vencida</span>
                    <span className="text-right">Limite</span>
                  </div>
                  {Array.from(byInstitution.entries()).map(([inst, ops]) => {
                    const sumDia = ops.reduce((s, o) => s + (o.emDia ?? 0), 0);
                    const sumVenc = ops.reduce((s, o) => s + (o.vencida ?? 0), 0);
                    const sumLim = ops.reduce((s, o) => s + (o.limiteCredito ?? 0), 0);
                    return (
                      <div key={inst} className="border-b border-gray-50 last:border-0">
                        <div className="grid grid-cols-[1.7fr_1fr_1fr_1fr] px-3 py-2 bg-gray-50/40">
                          <span className="font-bold text-gray-800 text-xs">{inst}</span>
                          <span className="text-right text-xs font-bold" style={{ color: "#10A65A" }}>{sumDia > 0 ? fmtBRL(sumDia) : "—"}</span>
                          <span className="text-right text-xs font-bold" style={{ color: sumVenc > 0 ? "#EF4444" : "#9CA3AF" }}>{sumVenc > 0 ? fmtBRL(sumVenc) : "—"}</span>
                          <span className="text-right text-xs font-bold" style={{ color: "#0D1B8C" }}>{sumLim > 0 ? fmtBRL(sumLim) : "—"}</span>
                        </div>
                        {ops.map((op, i) => (
                          <div key={i} className="grid grid-cols-[1.7fr_1fr_1fr_1fr] px-3 py-1.5 text-xs text-gray-600 border-t border-gray-50">
                            <span className="pl-3">↳ {op.modalidade || op.categoria || "—"}</span>
                            <span className="text-right">{op.emDia ? fmtBRL(op.emDia) : "—"}</span>
                            <span className="text-right">{op.vencida ? fmtBRL(op.vencida) : "—"}</span>
                            <span className="text-right">{op.limiteCredito ? fmtBRL(op.limiteCredito) : "—"}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(lead.bcbDebtsOverdue ?? 0) > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-800">
                ⚠ Há <strong>{fmtBRL(lead.bcbDebtsOverdue)}</strong> em dívidas vencidas no SCR. Regularize antes de buscar financiamento — esse é um dos maiores fatores de reprovação na Caixa.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
