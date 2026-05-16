import { useLocation, Link } from "wouter";
import { LogOut, LayoutDashboard, Users, Menu, X, Calculator, Building2, LineChart } from "lucide-react";
import { useState } from "react";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { NotificationBell } from "./NotificationBell";
import { ScoreCasaIcon, ScoreCasaWordmark } from "@/components/ScoreCasaLogo";

interface ClientLayoutProps {
  children: React.ReactNode;
  userName?: string;
  activePage?: "dashboard" | "score" | "simulador" | "imoveis" | "meus-dados";
}

const NAV_ITEMS: Array<{
  key: NonNullable<ClientLayoutProps["activePage"]>;
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { key: "dashboard",  href: "/portal",            label: "Resumo",         icon: LayoutDashboard },
  { key: "score",      href: "/portal/score",      label: "Histórico Score", icon: LineChart },
  { key: "simulador",  href: "/portal/simulador",  label: "Simulador",       icon: Calculator },
  { key: "imoveis",    href: "/portal/imoveis",    label: "Imóveis",         icon: Building2 },
  { key: "meus-dados", href: "/portal/meus-dados", label: "Meus dados",      icon: Users },
];

export function ClientLayout({ children, userName, activePage }: ClientLayoutProps) {
  const [, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const logout = useLogout();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    setMobileOpen(false);
    logout.mutate(undefined, {
      onSettled: () => {
        queryClient.clear();
        setLocation("/login");
      },
    });
  };

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="px-4 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScoreCasaIcon size={32} />
            <ScoreCasaWordmark variant="light" size="sm" />
          </div>
          <NotificationBell />
        </div>
      </div>

      {/* Role badge */}
      <div className="px-4 pb-4">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: "rgba(255,255,255,0.07)" }}
        >
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: "#10A65A" }}
          />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white/90 truncate">
              {userName || "Cliente"}
            </div>
            <div className="text-[10px] font-medium" style={{ color: "#10A65A" }}>
              Perfil Individual
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.key;
          return (
            <Link key={item.key} href={item.href}>
              <div
                onClick={() => setMobileOpen(false)}
                data-testid={`nav-${item.key}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 ${
                  isActive
                    ? "text-white font-semibold"
                    : "text-blue-200/80 hover:text-white hover:bg-white/8"
                }`}
                style={isActive ? { background: "#0D1B8C", boxShadow: "0 1px 4px rgba(13,27,140,.4)" } : {}}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">{item.label}</span>
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#10A65A]" />}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-5">
        <div className="border-t border-white/8 pt-3">
          <button
            onClick={handleLogout}
            data-testid="button-logout"
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-blue-200/70 hover:text-white hover:bg-white/8 transition-all duration-150 text-sm"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#F4F6FB" }}>
      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex lg:flex-col w-56 flex-shrink-0"
        style={{ background: "#07113A" }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside
            className="absolute left-0 top-0 bottom-0 w-56 flex flex-col"
            style={{ background: "#07113A" }}
          >
            <button
              className="absolute top-4 right-4 text-white/60 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setMobileOpen(true)} className="p-1 text-muted-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <ScoreCasaIcon size={26} />
            <ScoreCasaWordmark variant="dark" size="sm" />
          </div>
          <div className="ml-auto">
            <span
              className="text-[10px] font-semibold px-2 py-1 rounded-full"
              style={{ background: "#F0FDF4", color: "#10A65A" }}
            >
              Perfil Individual
            </span>
          </div>
        </div>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="max-w-5xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
