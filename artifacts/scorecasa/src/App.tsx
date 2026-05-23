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
import { Processos } from "@/pages/Processos";
import { ProcessDetails } from "@/pages/ProcessDetails";
import { ScoreCasaConectado } from "@/pages/ScoreCasaConectado";
import { Correspondente } from "@/pages/Correspondente";
import { AdminTaxas } from "@/pages/AdminTaxas";
import { Termos } from "@/pages/Termos";
import { Privacidade } from "@/pages/Privacidade";
import { AppLayout } from "@/components/layout/AppLayout";
import { ClientPortal } from "@/pages/ClientPortal";
import { ClientRegister } from "@/pages/ClientRegister";
import { ClientMeusDados } from "@/pages/ClientMeusDados";
import { ClientSimulador } from "@/pages/ClientSimulador";
import { ClientImoveis } from "@/pages/ClientImoveis";
import { ClientHistoricoScore } from "@/pages/ClientHistoricoScore";
import { ClientPagamentos } from "@/pages/ClientPagamentos";
import { ClientDividas } from "@/pages/ClientDividas";
import RecuperarSenha from "@/pages/RecuperarSenha";
import RedefinirSenha from "@/pages/RedefinirSenha";
import InstallPWA from "@/components/InstallPWA";

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

function CorrespondentOnly({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: me, isLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 60_000 },
  });
  useEffect(() => {
    if (isLoading) return;
    if (!me) setLocation("/login");
    else if (me.role === "client") setLocation("/portal");
    else if ((me.role as string) !== "correspondent") setLocation("/dashboard");
  }, [isLoading, me, setLocation]);
  if (isLoading || !me || (me.role as string) !== "correspondent") return <FullscreenLoader />;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/login" component={Login} />
      <Route path="/recuperar-senha" component={RecuperarSenha} />
      <Route path="/redefinir-senha" component={RedefinirSenha} />
      <Route path="/cadastro" component={ClientRegister} />
      <Route path="/correspondente" component={Correspondente} />
      <Route path="/termos" component={Termos} />
      <Route path="/privacidade" component={Privacidade} />
      <Route path="/portal/meus-dados" component={ClientMeusDados} />
      <Route path="/portal/simulador" component={ClientSimulador} />
      <Route path="/portal/imoveis" component={ClientImoveis} />
      <Route path="/portal/score" component={ClientHistoricoScore} />
      <Route path="/portal/pagamentos" component={ClientPagamentos} />
      <Route path="/portal/dividas" component={ClientDividas} />
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

      <Route path="/processos/:id">
        {(params) => (
          <StaffOnly>
            <AppLayout>
              <ProcessDetails leadId={Number(params?.id)} />
            </AppLayout>
          </StaffOnly>
        )}
      </Route>

      <Route path="/processos">
        {() => (
          <StaffOnly>
            <AppLayout>
              <Processos />
            </AppLayout>
          </StaffOnly>
        )}
      </Route>

      <Route path="/admin/taxas">
        {() => (
          <StaffOnly>
            <AppLayout>
              <AdminTaxas />
            </AppLayout>
          </StaffOnly>
        )}
      </Route>

      <Route path="/conectado">
        {() => (
          <CorrespondentOnly>
            <AppLayout>
              <ScoreCasaConectado />
            </AppLayout>
          </CorrespondentOnly>
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
        <InstallPWA />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
