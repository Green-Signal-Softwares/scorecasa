import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useLocation } from "wouter";

interface UseSessionGuardOptions<T extends Record<string, unknown>> {
  /** Chave usada no sessionStorage para preservar o formulário entre relogins. */
  draftKey?: string;
  /** Retorna o estado atual do formulário. Chamado no momento do snapshot. */
  getForm?: () => T;
}

export interface SessionGuard<T extends Record<string, unknown>> {
  sessionExpired: boolean;
  draftRestored: boolean;
  /** Tira snapshot manualmente (chamado antes de navegar/relogar). */
  snapshotForm: (form?: T) => void;
  /** Marca a sessão como expirada e tira snapshot do formulário. */
  handleAuthFailure: (form?: T) => void;
  /** Tira snapshot e redireciona ao login. */
  goToLogin: (form?: T) => void;
  /** Restaura o rascunho do sessionStorage (e limpa). Use uma vez no load. */
  restoreDraft: () => Partial<T> | null;
  /** Limpa o aviso de "rascunho restaurado". */
  clearDraftRestored: () => void;
  /** Wrapper de fetch que dispara handleAuthFailure em 401 automaticamente. */
  guardedFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  /** Reseta o estado de sessão expirada (útil após o usuário relogar). */
  resetSessionExpired: () => void;
}

/**
 * Trata expiração de sessão de forma consistente nas telas do cliente.
 *
 * - Em 401, mostra um banner de "sessão expirada" e (opcionalmente) salva o
 *   formulário em sessionStorage para que o usuário não perca o que digitou
 *   ao fazer login novamente.
 * - Restaura o rascunho automaticamente quando a tela é carregada de volta.
 */
export function useSessionGuard<T extends Record<string, unknown> = Record<string, unknown>>(
  opts: UseSessionGuardOptions<T> = {},
): SessionGuard<T> {
  const [, setLocation] = useLocation();
  const [sessionExpired, setSessionExpired] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  // Mantém o getForm sempre atualizado para evitar capturar uma versão antiga
  // do estado quando o 401 acontece em um effect que rodou só uma vez.
  const getFormRef = useRef(opts.getForm);
  useEffect(() => {
    getFormRef.current = opts.getForm;
  }, [opts.getForm]);

  const draftKey = opts.draftKey;

  const snapshotForm = useCallback(
    (form?: T) => {
      if (!draftKey) return;
      const data = form ?? getFormRef.current?.();
      if (!data) return;
      const hasData = Object.values(data).some(
        (v) => v !== "" && v != null && !(typeof v === "object" && v !== null && Object.keys(v).length === 0),
      );
      if (!hasData) return;
      try {
        sessionStorage.setItem(draftKey, JSON.stringify(data));
      } catch {
        /* sessionStorage indisponível — segue sem snapshot */
      }
    },
    [draftKey],
  );

  const handleAuthFailure = useCallback(
    (form?: T) => {
      snapshotForm(form);
      setSessionExpired(true);
    },
    [snapshotForm],
  );

  const goToLogin = useCallback(
    (form?: T) => {
      snapshotForm(form);
      setLocation("/login");
    },
    [snapshotForm, setLocation],
  );

  const restoreDraft = useCallback((): Partial<T> | null => {
    if (!draftKey) return null;
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (!saved) return null;
      sessionStorage.removeItem(draftKey);
      const draft = JSON.parse(saved);
      if (draft && typeof draft === "object") {
        setDraftRestored(true);
        return draft as Partial<T>;
      }
    } catch {
      /* ignore */
    }
    return null;
  }, [draftKey]);

  const clearDraftRestored = useCallback(() => setDraftRestored(false), []);
  const resetSessionExpired = useCallback(() => setSessionExpired(false), []);

  const guardedFetch = useCallback(
    async (input: RequestInfo, init?: RequestInit) => {
      const r = await fetch(input, { credentials: "include", ...init });
      if (r.status === 401) handleAuthFailure();
      return r;
    },
    [handleAuthFailure],
  );

  // Retorna um objeto memoizado — sua referência só muda quando o estado
  // realmente muda. Isso permite usar `guard` (ou qualquer campo dele) em
  // listas de dependências de useEffect sem disparar re-runs a cada render.
  return useMemo(
    () => ({
      sessionExpired,
      draftRestored,
      snapshotForm,
      handleAuthFailure,
      goToLogin,
      restoreDraft,
      clearDraftRestored,
      guardedFetch,
      resetSessionExpired,
    }),
    [
      sessionExpired,
      draftRestored,
      snapshotForm,
      handleAuthFailure,
      goToLogin,
      restoreDraft,
      clearDraftRestored,
      guardedFetch,
      resetSessionExpired,
    ],
  );
}
