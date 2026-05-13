import { CheckCircle, LogOut, User } from "lucide-react";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface ClientLayoutProps {
  children: React.ReactNode;
  userName?: string;
}

export function ClientLayout({ children, userName }: ClientLayoutProps) {
  const logout = useLogout();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/login");
      },
    });
  };

  return (
    <div className="min-h-screen" style={{ background: "#F4F6FB" }}>
      {/* Top nav */}
      <header className="sticky top-0 z-10 border-b border-white/10 shadow-sm" style={{ background: "#07113A" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#10A65A" }}>
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-base tracking-tight">ScoreCasa</span>
          </div>

          <div className="flex items-center gap-3">
            {userName && (
              <div className="flex items-center gap-2 text-blue-200 text-sm">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">{userName}</span>
              </div>
            )}
            <button
              onClick={handleLogout}
              data-testid="button-logout"
              className="flex items-center gap-1.5 text-blue-200 hover:text-white text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
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
