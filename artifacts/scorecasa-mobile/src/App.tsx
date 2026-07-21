import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect, type ReactNode } from "react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { LoginMobile } from "@/pages/LoginMobile";
import { RegisterMobile } from "@/pages/RegisterMobile";
import { MeuScore } from "@/pages/MeuScore";
import { MeusDados } from "@/pages/MeusDados";
import { ImoveisMobile } from "@/pages/ImoveisMobile";
import { PagamentosMobile } from "@/pages/PagamentosMobile";
import { SimuladorMobile } from "@/pages/SimuladorMobile";
import { MinhasDividasMobile } from "@/pages/MinhasDividasMobile";

// ── Loader de tela cheia ──────────────────────────────────────────────────────
function FullscreenLoader() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#07113A" }}
    >
      <div className="flex flex-col items-center gap-5">
        {/* Logo icon inline — sem dependência de assets externos */}
        <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
          <rect width="52" height="52" rx="14" fill="#0D1B8C" />
          <path d="M14 26c0-6.627 5.373-12 12-12s12 5.373 12 12-5.373 12-12 12" stroke="#10A65A" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="26" cy="26" r="4" fill="#FFFFFF" />
        </svg>
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    </div>
  );
}

// ── Guard: só clientes autenticados ──────────────────────────────────────────
function ClientOnly({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: me, isLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 60_000 },
  });

  useEffect(() => {
    if (isLoading) return;
    if (!me) {
      setLocation("/login");
      return;
    }
    if (me.role !== "client") {
      // Staff/corretor que acidentalmente abrir o app mobile → logout state
      setLocation("/login");
    }
  }, [isLoading, me, setLocation]);

  if (isLoading || !me || me.role !== "client") return <FullscreenLoader />;
  return <>{children}</>;
}

// ── Router ────────────────────────────────────────────────────────────────────
function Router() {
  return (
    <Switch>
      {/* Auth */}
      <Route path="/" component={LoginMobile} />
      <Route path="/login" component={LoginMobile} />
      <Route path="/cadastro" component={RegisterMobile} />

      {/* Portal do Cliente */}
      <Route path="/portal/score">
        {() => (
          <ClientOnly>
            <MeuScore />
          </ClientOnly>
        )}
      </Route>

      <Route path="/portal/imoveis">
        {() => (
          <ClientOnly>
            <ImoveisMobile />
          </ClientOnly>
        )}
      </Route>

      <Route path="/portal/pagamentos">
        {() => (
          <ClientOnly>
            <PagamentosMobile />
          </ClientOnly>
        )}
      </Route>

      <Route path="/portal/simulador">
        {() => (
          <ClientOnly>
            <SimuladorMobile />
          </ClientOnly>
        )}
      </Route>

      <Route path="/portal/dividas">
        {() => (
          <ClientOnly>
            <MinhasDividasMobile />
          </ClientOnly>
        )}
      </Route>

      <Route path="/portal/meus-dados">
        {() => (
          <ClientOnly>
            <MeusDados />
          </ClientOnly>
        )}
      </Route>

      {/* Fallback → login */}
      <Route>
        {() => {
          const [, setLocation] = useLocation();
          useEffect(() => setLocation("/login"), [setLocation]);
          return <FullscreenLoader />;
        }}
      </Route>
    </Switch>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <WouterRouter>
      <Router />
    </WouterRouter>
  );
}
