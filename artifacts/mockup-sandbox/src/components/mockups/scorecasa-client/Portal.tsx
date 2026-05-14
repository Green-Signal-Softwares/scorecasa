import { useState } from "react";
import {
  LogOut,
  LayoutDashboard,
  Users,
  Menu,
  X,
  Bell,
  Calculator,
} from "lucide-react";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "simulador", label: "Simulador", icon: Calculator },
  { key: "meus-dados", label: "Meus dados", icon: Users },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]["key"];

function Logo({ variant = "light" }: { variant?: "light" | "dark" }) {
  const fg = variant === "light" ? "#FFFFFF" : "#07113A";
  return (
    <div className="flex items-center gap-2">
      <img
        src="/__mockup/images/scorecasa-icon.png"
        alt="ScoreCasa"
        width={32}
        height={32}
        style={{ display: "block", objectFit: "contain" }}
      />
      <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1 }} className="text-lg">
        <span style={{ color: fg }}>score</span>
        <span style={{ color: "#10A65A" }}>casa</span>
      </span>
    </div>
  );
}

export function Portal() {
  const [activePage, setActivePage] = useState<NavKey>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);

  const userName = "Valeska Santana";

  const SidebarContent = () => (
    <>
      <div className="px-4 py-5">
        <div className="flex items-center justify-between">
          <Logo variant="light" />
          <button className="relative text-blue-200/80 hover:text-white">
            <Bell className="w-4 h-4" />
            <span
              className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
              style={{ background: "#10A65A" }}
            />
          </button>
        </div>
      </div>

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
              {userName}
            </div>
            <div className="text-[10px] font-medium" style={{ color: "#10A65A" }}>
              Perfil Individual
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.key;
          return (
            <div
              key={item.key}
              onClick={() => {
                setActivePage(item.key);
                setMobileOpen(false);
              }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 ${
                isActive
                  ? "text-white font-semibold"
                  : "text-blue-200/80 hover:text-white"
              }`}
              style={
                isActive
                  ? { background: "#0D1B8C", boxShadow: "0 1px 4px rgba(13,27,140,.4)" }
                  : {}
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{item.label}</span>
              {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#10A65A]" />}
            </div>
          );
        })}
      </nav>

      <div className="px-3 pb-5">
        <div className="border-t border-white/10 pt-3">
          <button className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-blue-200/70 hover:text-white transition-all duration-150 text-sm">
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "#F4F6FB", fontFamily: "Poppins, sans-serif" }}
    >
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex lg:flex-col w-56 flex-shrink-0"
        style={{ background: "#07113A" }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
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

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b bg-white">
          <button onClick={() => setMobileOpen(true)} className="p-1 text-gray-500">
            <Menu className="w-5 h-5" />
          </button>
          <Logo variant="dark" />
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
            {activePage === "dashboard" ? <DashboardContent name={userName} /> : <MeusDadosContent name={userName} />}
          </div>
        </main>
      </div>
    </div>
  );
}

function DashboardContent({ name }: { name: string }) {
  const score = 742;
  const ipa = 78;
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>
          Olá, {name.split(" ")[0]}.
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Bem-vindo à sua área. Aqui você poderá acompanhar suas informações e interações.
        </p>
      </div>

      {/* Score card */}
      <div className="rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6 bg-white">
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ background: "#07113A" }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
              SCORE DE PERFIL
            </p>
            <p className="text-white font-bold text-lg">Scorecasa Crédito</p>
          </div>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{
              background: "#10A65A22",
              color: "#10A65A",
              border: "1px solid #10A65A55",
            }}
          >
            ⚪ Estimativa
          </span>
        </div>

        <div className="p-6 text-center">
          <div className="inline-flex items-center justify-center w-40 h-40 rounded-full mb-4"
               style={{ background: "conic-gradient(#10A65A 0% 74%, #E5E7EB 74% 100%)" }}>
            <div className="w-32 h-32 rounded-full bg-white flex flex-col items-center justify-center">
              <div className="text-3xl font-black" style={{ color: "#10A65A" }}>{score}</div>
              <div className="text-[11px] text-gray-400">/ 1000</div>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 border border-green-100">
            <span className="text-xs font-semibold text-green-700">✓ Perfil favorável</span>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed mt-4 max-w-md mx-auto">
            Seu indicador sugere boa capacidade de negociação na busca por financiamento ou locação.
          </p>
        </div>
      </div>

      {/* IPA card */}
      <div className="rounded-2xl shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4" style={{ background: "#0D4A2C" }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-green-300">
            SIMULAÇÃO EDUCATIVA
          </p>
          <p className="text-white font-bold text-lg leading-tight">
            Índice de Potencial de Aprovação (IPA)
          </p>
        </div>
        <div className="bg-white p-5">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black" style={{ color: "#10A65A" }}>{ipa}</span>
            <span className="text-xl text-gray-400 font-light">/ 100</span>
          </div>
          <p className="font-semibold text-sm mt-1" style={{ color: "#10A65A" }}>Bom</p>
          <p className="text-xs text-gray-500">Alta probabilidade de aprovação</p>
          <div className="mt-4 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${ipa}%`, background: "linear-gradient(90deg,#EF4444,#F59E0B,#10A65A)" }} />
          </div>
        </div>
      </div>
    </>
  );
}

function MeusDadosContent({ name }: { name: string }) {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>
          Meus dados
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Atualize suas informações cadastrais.
        </p>
      </div>
      <div className="rounded-2xl shadow-sm border border-gray-100 bg-white p-6">
        <p className="text-sm text-gray-500">
          Formulário de dados do cliente <strong>{name}</strong>.
        </p>
      </div>
    </>
  );
}
