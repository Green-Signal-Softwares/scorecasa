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
import { AppLayout } from "@/components/layout/AppLayout";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/:rest*">
        {() => (
          <AppLayout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/leads/:id">
                {(params) => <LeadDetails key={params?.id} />}
              </Route>
              <Route path="/leads" component={Leads} />
              <Route path="/brokers" component={Brokers} />
              <Route path="/ranking" component={Ranking} />
              <Route component={NotFound} />
            </Switch>
          </AppLayout>
        )}
      </Route>
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
