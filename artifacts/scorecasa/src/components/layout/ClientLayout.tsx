import { LogOut, User, Home, Database, Bell, Menu, X } from "lucide-react";
import { ScoreCasaIcon, ScoreCasaWordmark } from "@/components/ScoreCasaLogo";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useState } from "react";

interface ClientLayoutProps {
  children: React.ReactNode;
  userName?: string;
  activePage?: "home" | "meus-dados" | "notificacoes";
}

export function ClientLayout({ children, userName, activePage }: ClientLayoutProps) {
  const logout = useLogout();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [mobileMenu, setMobileMenu] = useState(false);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/login");
      },
    });
  };

  const navLinks = [
    { key: "home",         label: "Home",       href: "/portal",           icon: Home },
    { key: "meus-dados",   label: "Meus dados", href: "/portal/meus-dados",icon: Database },
    { key: "notificacoes", label: "Notificações",href: "/portal",           icon: Bell },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#F4F6FB" }}>
      {/* Top nav */}
      <header className="sticky top-0 z-20 border-b shadow-sm" style={{ background: "#6B21A8", borderColor: "#581C87" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <ScoreCasaIcon size={30} />
            <ScoreCasaWordmark variant="light" size="sm" />
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link key={link.key} href={link.href}>
                <button
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activePage === link.key
                      ? "bg-white/20 text-white"
                      : "text-purple-200 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <link.icon className="w-3.5 h-3.5" />
                  {link.label}
                </button>
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {userName && (
              <div className="hidden sm:flex items-center gap-2 text-purple-200 text-sm">
                <User className="w-4 h-4" />
                <span className="hidden lg:inline">{userName}</span>
              </div>
            )}
            <button
              onClick={handleLogout}
              data-testid="button-logout"
              className="flex items-center gap-1.5 text-purple-200 hover:text-white text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
            {/* Mobile menu button */}
            <button
              className="md:hidden text-purple-200 hover:text-white"
              onClick={() => setMobileMenu((v) => !v)}
            >
              {mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenu && (
          <div className="md:hidden border-t px-4 py-2 space-y-1" style={{ background: "#581C87", borderColor: "#7E22CE" }}>
            {navLinks.map((link) => (
              <Link key={link.key} href={link.href}>
                <button
                  onClick={() => setMobileMenu(false)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                    activePage === link.key ? "bg-white/20 text-white" : "text-purple-200 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </button>
              </Link>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>

      <footer className="text-center text-xs text-gray-400 pb-6 pt-2">
        © 2026 ScoreCasa · Inteligência de Crédito Imobiliário
      </footer>
    </div>
  );
}
