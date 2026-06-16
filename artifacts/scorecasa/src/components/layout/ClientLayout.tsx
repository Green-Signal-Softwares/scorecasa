import { useLocation, Link } from "wouter";
import { LogOut, LayoutDashboard, Users, Menu, X, Calculator, Building2, LineChart, Wallet, Landmark, ChevronRight, SlidersHorizontal, Navigation, BarChart3 } from "lucide-react";
import { useState } from "react";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { NotificationBell } from "./NotificationBell";
import { ScoreCasaIcon, ScoreCasaWordmark } from "@/components/ScoreCasaLogo";

interface ClientLayoutProps {
  children: React.ReactNode;
  userName?: string;
  activePage?: "dashboard" | "score" | "pagamentos" | "dividas" | "simulador" | "imoveis" | "meus-dados";
}

const NAV_ITEMS: Array<{
  key: NonNullable<ClientLayoutProps["activePage"]>;
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { key: "dashboard", href: "/portal", label: "Meu Score", icon: LayoutDashboard },
  { key: "score", href: "/portal/score", label: "Histórico Score", icon: LineChart },
  { key: "pagamentos", href: "/portal/pagamentos", label: "Pagamentos", icon: Wallet },
  { key: "dividas", href: "/portal/dividas", label: "Minhas dívidas", icon: Landmark },
  { key: "simulador", href: "/portal/simulador", label: "Simulador", icon: Calculator },
  { key: "imoveis", href: "/portal/imoveis", label: "Imóveis", icon: Building2 },
  { key: "meus-dados", href: "/portal/meus-dados", label: "Meus dados", icon: Users },
];

export function ClientLayout({ children, userName, activePage }: ClientLayoutProps) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("client_sidebar_collapsed");
      return saved === "true";
    }
    return false;
  });
  const [meuScoreOpen, setMeuScoreOpen] = useState(true);

  const logout = useLogout();
  const queryClient = useQueryClient();

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("client_sidebar_collapsed", String(next));
      }
      return next;
    });
  };

  const handleLogout = () => {
    setMobileOpen(false);
    logout.mutate(undefined, {
      onSettled: () => {
        queryClient.clear();
        setLocation("/login");
      },
    });
  };

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => {
    const isCollapsed = collapsed && !isMobile;
    return (
      <>
        {/* Logo & Toggle Header */}
        <div className="px-4 py-5">
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={toggleCollapse}
                className="p-1.5 rounded-lg text-blue-200/80 hover:text-white hover:bg-white/8 transition-colors"
                title="Expandir menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <ScoreCasaIcon size={32} />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleCollapse}
                  className="hidden lg:block p-1 rounded-lg text-blue-200/80 hover:text-white hover:bg-white/8 transition-colors"
                  title="Recolher menu"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <ScoreCasaIcon size={32} />
                <ScoreCasaWordmark variant="light" size="sm" />
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className={`flex-1 space-y-0.5 ${isCollapsed ? "px-2" : "px-3"}`}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.key;

            if (item.key === "dashboard") {
              const isChildActive = (subHref: string) => {
                return location === subHref;
              };

              return (
                <div key={item.key} className="space-y-1">
                  {/* Parent Accordion Trigger */}
                  <div
                    onClick={() => {
                      if (isCollapsed) {
                        setCollapsed(false);
                      }
                      setMeuScoreOpen(!meuScoreOpen);
                      setLocation("/portal");
                    }}
                  className={`flex items-center rounded-lg cursor-pointer transition-all duration-150 justify-between border ${
                    isCollapsed ? "justify-center p-2.5" : "px-3 py-2.5"
                  } ${
                    isActive && !isCollapsed
                      ? "bg-white/5 border-white/5 text-white font-semibold"
                      : "border-transparent text-blue-200/80 hover:text-white hover:bg-white/8"
                  }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {!isCollapsed && <span className="text-sm">{item.label}</span>}
                    </div>
                    {!isCollapsed && (
                      <ChevronRight
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          meuScoreOpen ? "rotate-90" : ""
                        }`}
                      />
                    )}
                  </div>

                  {/* Submenu items */}
                  {meuScoreOpen && !isCollapsed && (
                    <div className="pl-6 space-y-1">
                      {[
                        { key: "resumo", label: "Resumo", icon: LayoutDashboard, href: "/portal" },
                        { key: "analise", label: "Análise", icon: SlidersHorizontal, href: "/portal/analise" },
                        { key: "gps", label: "GPS de Aprovação", icon: Navigation, href: "/portal/gps" },
                        { key: "comparativo", label: "Bancos", icon: BarChart3, href: "/portal/bancos" },
                      ].map((subItem) => {
                        const SubIcon = subItem.icon;
                        const isSubActive = isChildActive(subItem.href);
                        return (
                          <Link key={subItem.key} href={subItem.href}>
                            <div
                              onClick={() => setMobileOpen(false)}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 text-xs border ${
                              isSubActive
                                ? "bg-white/10 border-white/10 text-white font-semibold shadow-sm"
                                : "border-transparent text-blue-200/60 hover:text-white hover:bg-white/5 hover:border-white/5"
                            }`}
                            >
                              <SubIcon className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>{subItem.label}</span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link key={item.key} href={item.href}>
                <div
                  onClick={() => setMobileOpen(false)}
                  data-testid={`nav-${item.key}`}
                  title={isCollapsed ? item.label : undefined}
                  className={`flex items-center rounded-lg cursor-pointer transition-all duration-150 border ${
                    isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
                  } ${
                    isActive
                      ? "text-white font-semibold"
                      : "border-transparent text-blue-200/80 hover:text-white hover:bg-white/8 hover:border-white/5"
                  }`}
                  style={
                    isActive
                      ? {
                          background: "linear-gradient(135deg, #0D1B8C 0%, #08126B 100%)",
                          borderColor: "rgba(255, 255, 255, 0.12)",
                          boxShadow: "0 4px 12px rgba(13, 27, 140, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
                        }
                      : {}
                  }
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!isCollapsed && <span className="text-sm">{item.label}</span>}
                  {isActive && !isCollapsed && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#10A65A]" />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className={`pb-5 ${isCollapsed ? "px-2" : "px-3"} space-y-2`}>
          <div className="border-t border-white/8 pt-3">
            <button
              onClick={handleLogout}
              data-testid="button-logout"
              title={isCollapsed ? "Sair" : undefined}
              className={`flex items-center w-full rounded-lg text-blue-200/70 hover:text-white hover:bg-white/8 transition-all duration-150 text-sm ${
                isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
              }`}
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && "Sair"}
            </button>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#F4F6FB" }}>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex lg:flex-col flex-shrink-0 transition-all duration-300 ${
          collapsed ? "w-20" : "w-56"
        }`}
        style={{
          background: "linear-gradient(180deg, #07113A 0%, #030825 100%)",
          borderRight: "1px solid rgba(255, 255, 255, 0.08)"
        }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside
            className="absolute left-0 top-0 bottom-0 w-56 flex flex-col"
            style={{
              background: "linear-gradient(180deg, #07113A 0%, #030825 100%)",
              borderRight: "1px solid rgba(255, 255, 255, 0.08)"
            }}
          >
            <button
              className="absolute top-4 right-4 text-white/60 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent isMobile />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="p-1 text-muted-foreground">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <ScoreCasaIcon size={26} />
              <ScoreCasaWordmark variant="dark" size="sm" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="text-[10px] font-semibold px-2 py-1 rounded-full"
              style={{ background: "#F0FDF4", color: "#10A65A" }}
            >
              Individual
            </span>
            <NotificationBell />
          </div>
        </div>

        {/* Desktop Top Bar */}
        <header
          className="hidden lg:flex items-center justify-between px-6 py-4 border-b border-white/10 shadow-sm h-16"
          style={{ background: "linear-gradient(90deg, #07113A 0%, #040A28 100%)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">
              {activePage === "dashboard" ? "Meu Score" : NAV_ITEMS.find((n) => n.key === activePage)?.label}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#10A65A] shadow-[0_0_8px_#10A65A] animate-pulse" />
              <span className="text-sm font-semibold text-white">
                {userName || "Cliente"}
              </span>
              <span className="text-[10px] font-semibold text-[#10A65A] bg-[#10A65A]/10 border border-[#10A65A]/25 px-2.5 py-0.5 rounded-full">
                Perfil Individual
              </span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="max-w-[95%] w-[95%] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
