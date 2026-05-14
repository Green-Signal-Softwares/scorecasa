import { useLocation, Link } from "wouter";
import { LayoutDashboard, Users, UserCheck, Trophy, LogOut, Menu, X, Building2, CreditCard, ClipboardList, Star } from "lucide-react";
import { useState } from "react";
import { useLogout, useGetMe, useGetMySubscription } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRequireBrokerAuth } from "@/hooks/use-auth";
import { NotificationBell } from "./NotificationBell";
import { ScoreCasaIcon, ScoreCasaWordmark } from "@/components/ScoreCasaLogo";

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  admin:         { label: "Administrador", color: "#0D1B8C", bg: "#EEF2FF" },
  broker:        { label: "Corretor",      color: "#10A65A", bg: "#F0FDF4" },
  correspondent: { label: "Correspondente",color: "#7C3AED", bg: "#F5F3FF" },
  analyst:       { label: "Analista",      color: "#D97706", bg: "#FFFBEB" },
  client:        { label: "Cliente",       color: "#6B7280", bg: "#F3F4F6" },
};

// Nav items per role
function getNavItems(role: string, marketplaceAddon: boolean) {
  const base = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/leads",     label: "Leads",     icon: Users },
  ];

  // Aba Imóveis: corretor só vê se tiver contratado o add-on de Vitrine.
  // Admin, analista, correspondente e cliente sempre veem (estes últimos só visualizam).
  const showImoveis = role === "broker" ? marketplaceAddon : true;
  if (showImoveis) {
    base.push({ href: "/imoveis", label: "Imóveis", icon: Building2 });
  }

  if (["admin", "analyst"].includes(role)) {
    base.push(
      { href: "/brokers", label: "Corretores", icon: UserCheck },
      { href: "/ranking", label: "Ranking",    icon: Trophy },
    );
  }

  if (["broker", "correspondent"].includes(role)) {
    base.push(
      { href: "/ranking",    label: "Ranking",    icon: Trophy },
      { href: "/historico",  label: "Histórico",  icon: ClipboardList },
      { href: "/avaliacoes", label: "Avaliações", icon: Star },
    );
  }

  if (role === "admin") {
    base.push(
      { href: "/historico",  label: "Histórico",  icon: ClipboardList },
    );
  }

  if (role === "client") {
    base.push({ href: "/avaliacoes", label: "Avaliações", icon: Star });
  }

  base.push({ href: "/financeiro", label: "Financeiro", icon: CreditCard });

  return base;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const logout = useLogout();
  const queryClient = useQueryClient();
  const { isLoading, isAuthenticated } = useRequireBrokerAuth();
  const { data: me } = useGetMe({});
  const role = (me as any)?.role ?? "analyst";
  const userName = (me as any)?.name ?? "";
  // 404 quando o usuário não tem assinatura — tratamos como sem add-on.
  const { data: sub } = useGetMySubscription({ query: { retry: false } } as any);
  const marketplaceAddon = !!(sub as any)?.marketplaceAddon;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "#07113A" }}>
        <div className="flex flex-col items-center gap-4">
          <ScoreCasaIcon size={44} />
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "#07113A" }}>
        <div className="flex flex-col items-center gap-4">
          <ScoreCasaIcon size={44} />
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/login");
      },
    });
  };

  const navItems = getNavItems(role, marketplaceAddon);
  const roleInfo = ROLE_LABELS[role] ?? ROLE_LABELS.analyst;

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
            style={{ background: roleInfo.color }}
          />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white/90 truncate">{userName}</div>
            <div className="text-[10px] font-medium" style={{ color: roleInfo.color }}>{roleInfo.label}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || (location === "/" && item.href === "/dashboard");
          return (
            <Link key={item.href} href={item.href}>
              <div
                onClick={() => setMobileOpen(false)}
                data-testid={`nav-${item.href.slice(1)}`}
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
    <div className="flex h-screen overflow-hidden bg-background">
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
              style={{ background: roleInfo.bg, color: roleInfo.color }}
            >
              {roleInfo.label}
            </span>
          </div>
        </div>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
