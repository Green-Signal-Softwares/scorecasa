import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect, type ReactNode } from "react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import NotFound from "@/pages/not-found";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { Leads } from "@/pages/Leads";
import { LeadDetails } from "@/pages/LeadDetails";
import { Brokers } from "@/pages/Brokers";
import { Ranking } from "@/pages/Ranking";
import { Imoveis } from "@/pages/Imoveis";
import { Financeiro } from "@/pages/Financeiro";
import { Historico } from "@/pages/Historico";
import { Avaliacoes } from "@/pages/Avaliacoes";
import { Termos } from "@/pages/Termos";
import { Privacidade } from "@/pages/Privacidade";
import { AppLayout } from "@/components/layout/AppLayout";
import { ClientPortal } from "@/pages/ClientPortal";
import { ClientRegister } from "@/pages/ClientRegister";
import { ClientMeusDados } from "@/pages/ClientMeusDados";

const queryClient = new QueryClient();

function FullscreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#07113A" }}>
      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );
}

function StaffOnly({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: me, isLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 60_000 },
  });
  useEffect(() => {
    if (isLoading) return;
    if (!me) setLocation("/login");
    else if (me.role === "client") setLocation("/portal");
  }, [isLoading, me, setLocation]);
  if (isLoading || !me || me.role === "client") return <FullscreenLoader />;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/login" component={Login} />
      <Route path="/cadastro" component={ClientRegister} />
      <Route path="/termos" component={Termos} />
      <Route path="/privacidade" component={Privacidade} />
      <Route path="/portal/meus-dados" component={ClientMeusDados} />
      <Route path="/portal" component={ClientPortal} />

      <Route path="/leads/:id">
        {(params) => (
          <StaffOnly>
            <AppLayout>
              <LeadDetails id={Number(params?.id)} />
            </AppLayout>
          </StaffOnly>
        )}
      </Route>

      <Route path="/leads">
        {() => (
          <StaffOnly>
            <AppLayout>
              <Leads />
            </AppLayout>
          </StaffOnly>
        )}
      </Route>

      <Route path="/dashboard">
        {() => (
          <StaffOnly>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </StaffOnly>
        )}
      </Route>

      <Route path="/brokers">
        {() => (
          <StaffOnly>
            <AppLayout>
              <Brokers />
            </AppLayout>
          </StaffOnly>
        )}
      </Route>

      <Route path="/ranking">
        {() => (
          <StaffOnly>
            <AppLayout>
              <Ranking />
            </AppLayout>
          </StaffOnly>
        )}
      </Route>

      <Route path="/imoveis">
        {() => (
          <StaffOnly>
            <AppLayout>
              <Imoveis />
            </AppLayout>
          </StaffOnly>
        )}
      </Route>

      <Route path="/financeiro">
        {() => (
          <StaffOnly>
            <AppLayout>
              <Financeiro />
            </AppLayout>
          </StaffOnly>
        )}
      </Route>

      <Route path="/historico">
        {() => (
          <StaffOnly>
            <AppLayout>
              <Historico />
            </AppLayout>
          </StaffOnly>
        )}
      </Route>

      <Route path="/avaliacoes">
        {() => (
          <StaffOnly>
            <AppLayout>
              <Avaliacoes />
            </AppLayout>
          </StaffOnly>
        )}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
