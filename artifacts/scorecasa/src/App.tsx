import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Switch, Route, Router as WouterRouter } from "wouter";
import NotFound from "@/pages/not-found";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { Leads } from "@/pages/Leads";
import { LeadDetails } from "@/pages/LeadDetails";
import { Brokers } from "@/pages/Brokers";
import { Ranking } from "@/pages/Ranking";
import { Imoveis } from "@/pages/Imoveis";
import { Financeiro } from "@/pages/Financeiro";
import { AppLayout } from "@/components/layout/AppLayout";
import { ClientPortal } from "@/pages/ClientPortal";
import { ClientRegister } from "@/pages/ClientRegister";
import { ClientMeusDados } from "@/pages/ClientMeusDados";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/login" component={Login} />
      <Route path="/cadastro" component={ClientRegister} />
      <Route path="/portal/meus-dados" component={ClientMeusDados} />
      <Route path="/portal" component={ClientPortal} />

      <Route path="/leads/:id">
        {(params) => (
          <AppLayout>
            <LeadDetails id={Number(params?.id)} />
          </AppLayout>
        )}
      </Route>

      <Route path="/leads">
        {() => (
          <AppLayout>
            <Leads />
          </AppLayout>
        )}
      </Route>

      <Route path="/dashboard">
        {() => (
          <AppLayout>
            <Dashboard />
          </AppLayout>
        )}
      </Route>

      <Route path="/brokers">
        {() => (
          <AppLayout>
            <Brokers />
          </AppLayout>
        )}
      </Route>

      <Route path="/ranking">
        {() => (
          <AppLayout>
            <Ranking />
          </AppLayout>
        )}
      </Route>

      <Route path="/imoveis">
        {() => (
          <AppLayout>
            <Imoveis />
          </AppLayout>
        )}
      </Route>

      <Route path="/financeiro">
        {() => (
          <AppLayout>
            <Financeiro />
          </AppLayout>
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
