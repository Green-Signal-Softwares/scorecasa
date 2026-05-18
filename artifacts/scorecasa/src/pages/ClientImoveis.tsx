import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey, ApiError } from "@workspace/api-client-react";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { SessionExpiredBanner } from "@/components/SessionExpiredBanner";
import { useSessionGuard } from "@/hooks/use-session-guard";
import { Imoveis } from "@/pages/Imoveis";

export function ClientImoveis() {
  const [, setLocation] = useLocation();
  const { data: me, isLoading: loadingMe, error: meError } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 60_000 },
  });

  const guard = useSessionGuard();
  const meUnauthorized = meError instanceof ApiError && meError.status === 401;

  useEffect(() => {
    if (loadingMe) return;
    if (meUnauthorized) {
      guard.handleAuthFailure();
      return;
    }
    if (me && me.role !== "client") setLocation("/dashboard");
    if (!me && !meError) setLocation("/login");
  }, [loadingMe, me, meError, meUnauthorized, setLocation, guard]);

  if (guard.sessionExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#07113A" }}>
        <div className="max-w-md w-full">
          <SessionExpiredBanner
            expired
            description="Sua sessão expirou. Faça login novamente para continuar visualizando os imóveis."
            loginLabel="Fazer login"
            onLogin={() => guard.goToLogin()}
          />
        </div>
      </div>
    );
  }

  if (loadingMe || !me || me.role !== "client") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07113A" }}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ClientLayout userName={me.name} activePage="imoveis">
      <Imoveis />
    </ClientLayout>
  );
}
