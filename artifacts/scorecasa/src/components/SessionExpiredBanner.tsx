import { AlertTriangle, Info } from "lucide-react";

interface SessionExpiredBannerProps {
  /** Quando true, exibe o aviso amarelo de "sessão expirou" com botão de login. */
  expired: boolean;
  /** Quando true (e não expirado), mostra um aviso azul de "rascunho restaurado". */
  draftRestored?: boolean;
  /** Mensagem opcional explicando o rascunho restaurado (default genérico). */
  draftRestoredMessage?: string;
  /** Chamado quando o usuário clica em "Fazer login para salvar". */
  onLogin: () => void;
  /** Texto do botão de login (default: "Fazer login para salvar"). */
  loginLabel?: string;
  /** Mensagem secundária para o banner de sessão expirada. */
  description?: string;
  testId?: string;
}

/**
 * Banner reutilizável para avisar que a sessão do cliente expirou.
 * Combina o aviso de "sessão expirou" e (opcionalmente) o aviso de
 * "recuperamos o que você tinha digitado" usado pelas telas do portal.
 */
export function SessionExpiredBanner({
  expired,
  draftRestored,
  draftRestoredMessage,
  onLogin,
  loginLabel = "Fazer login para salvar",
  description = "Para salvar o que você digitou, faça login novamente. Seus valores ficam guardados aqui e voltam automaticamente assim que você entrar.",
  testId,
}: SessionExpiredBannerProps) {
  if (expired) {
    return (
      <div
        className="rounded-lg p-4 flex items-start gap-3 text-sm"
        style={{ background: "#FFFBEB", border: "1px solid #F59E0B66", color: "#92400E" }}
        role="alert"
        data-testid={testId ?? "banner-session-expired"}
      >
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#B45309" }} />
        <div className="flex-1">
          <div className="font-semibold mb-1">Sua sessão expirou</div>
          <div className="text-xs mb-3" style={{ color: "#78350F" }}>
            {description}
          </div>
          <button
            type="button"
            onClick={onLogin}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold text-white"
            style={{ background: "#0D1B8C" }}
            data-testid="button-relogin"
          >
            {loginLabel}
          </button>
        </div>
      </div>
    );
  }

  if (draftRestored) {
    return (
      <div
        className="rounded-lg p-3 flex items-start gap-2 text-xs"
        style={{ background: "#EFF6FF", color: "#1E40AF" }}
        data-testid="banner-draft-restored"
      >
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          {draftRestoredMessage ??
            "Recuperamos os valores que você tinha digitado antes da sessão expirar. Confira e salve novamente."}
        </span>
      </div>
    );
  }

  return null;
}
