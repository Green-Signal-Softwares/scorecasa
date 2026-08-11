import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, Link } from "wouter";
import { useLogin, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  Lock, User as UserIcon, Eye, EyeOff, ArrowRight,
  ShieldCheck, TrendingUp, Landmark, Brain, Home,
} from "lucide-react";

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  email: z.string().min(1, "Informe seu e-mail ou CPF").refine((v) => {
    const trimmed = v.trim();
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length === 11 && /^\d+$/.test(digits)) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  }, "Informe um e-mail válido ou CPF com 11 dígitos"),
  password: z.string().min(1, "Senha obrigatória"),
});
type FormValues = z.infer<typeof schema>;

// ── CPF formatter ─────────────────────────────────────────────────────────────
function formatIdentifier(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (/^[\d.\-\s]*$/.test(trimmed) && digits.length > 0 && digits.length <= 11) {
    const d = digits.slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  return trimmed;
}

// ── Score Gauge (decorativo na tela de login) ─────────────────────────────────
function LoginGauge() {
  const r = 80, cx = 100, cy = 100;
  const pct = 0.68; // 682/1000
  const startAngle = -210 * (Math.PI / 180);
  const arcSpan = 240 * (Math.PI / 180);

  const point = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number];
  const [sx, sy] = point(startAngle);
  const [ex, ey] = point(startAngle + arcSpan);
  const [px, py] = point(startAngle + arcSpan * pct);

  const trackPath = `M ${sx} ${sy} A ${r} ${r} 0 1 1 ${ex} ${ey}`;
  const activePath = `M ${sx} ${sy} A ${r} ${r} 0 0 1 ${px} ${py}`;

  return (
    <svg viewBox="0 0 200 140" className="w-44">
      <defs>
        <linearGradient id="mGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10A65A" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      <path d={trackPath} stroke="rgba(255,255,255,0.10)" strokeWidth="12" fill="none" strokeLinecap="round" />
      <path d={activePath} stroke="url(#mGrad)" strokeWidth="12" fill="none" strokeLinecap="round" />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="32" fontWeight="800" fill="#FFFFFF" fontFamily="Poppins,sans-serif">682</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.55)" fontFamily="Poppins,sans-serif" letterSpacing="1.5">SEU SCORE</text>
      <text x={cx} y={cy + 30} textAnchor="middle" fontSize="10" fontWeight="700" fill="#10A65A" fontFamily="Poppins,sans-serif">Bom</text>
    </svg>
  );
}

// ── Feature pill ──────────────────────────────────────────────────────────────
function FeaturePill({ icon: Icon, label }: { icon: typeof Brain; label: string }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium"
      style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.12)" }}
    >
      <Icon className="w-3.5 h-3.5" style={{ color: "#10A65A" }} />
      {label}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export function LoginMobile() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redireciona se já autenticado
  const { data: me, isLoading: checkingAuth } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 60_000 },
  });
  useEffect(() => {
    if (!checkingAuth && me?.role === "client") setLocation("/portal/score");
  }, [checkingAuth, me, setLocation]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (data: FormValues) => {
    setError(null);
    const trimmed = data.email.trim();
    const digits = trimmed.replace(/\D/g, "");
    const isCpf = /^[\d.\-\s]+$/.test(trimmed) && digits.length === 11;
    const normalized = isCpf ? digits : trimmed.toLowerCase();

    login.mutate(
      { data: { email: normalized, password: data.password, profile: "client" } },
      {
        onSuccess: (res) => {
          queryClient.invalidateQueries();
          const role = (res as { user?: { role?: string } })?.user?.role;
          if (role === "client") {
            setLocation("/portal/score");
          } else {
            setError("Este app é exclusivo para clientes ScoreCasa.");
          }
        },
        onError: () => setError("E-mail/CPF ou senha incorretos. Tente novamente."),
      },
    );
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07113A" }}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(180deg, #07113A 0%, #0A1650 55%, #F2F4F7 55%)", fontFamily: "Poppins, sans-serif" }}
    >
      {/* ── Hero superior (dark) ── */}
      <div className="relative flex flex-col items-center pt-14 pb-8 px-6 overflow-hidden">
        {/* Decorative blur */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full"
          style={{ background: "rgba(16,166,90,0.12)", filter: "blur(80px)", pointerEvents: "none" }} />

        {/* Wordmark */}
        <div className="relative z-10 mb-8">
          <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 800, fontSize: 28, letterSpacing: "-0.02em" }}>
            <span style={{ color: "#FFFFFF" }}>score</span>
            <span style={{ color: "#10A65A" }}>casa</span>
            <sup style={{ fontSize: "0.38em", color: "rgba(255,255,255,0.5)", verticalAlign: "super", marginLeft: 1 }}>®</sup>
          </span>
        </div>

        {/* Score gauge decorativo */}
        <div className="relative z-10 mb-4 animate-fade-up">
          <LoginGauge />
        </div>

        {/* Feature pills */}
        <div className="relative z-10 flex flex-wrap justify-center gap-2 animate-fade-up">
          <FeaturePill icon={Brain} label="IA de Crédito" />
          <FeaturePill icon={TrendingUp} label="Score em tempo real" />
          <FeaturePill icon={Landmark} label="Open Finance" />
          <FeaturePill icon={Home} label="Imóveis para você" />
        </div>
      </div>

      {/* ── Card de login (light) ── */}
      <div className="flex-1 flex flex-col px-5 pt-6 pb-8" style={{ background: "#F2F4F7" }}>
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold" style={{ color: "#07113A" }}>
              Bem-vindo de volta!
            </h1>
            <p className="text-sm mt-1" style={{ color: "#64748B" }}>
              Acesse sua conta ScoreCasa
            </p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* E-mail / CPF */}
            <div>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
                <input
                  {...form.register("email")}
                  type="text"
                  inputMode="email"
                  autoComplete="username"
                  placeholder="E-mail ou CPF"
                  className="w-full pl-11 pr-4 h-13 rounded-xl text-sm border outline-none transition-all"
                  style={{
                    height: 52,
                    background: "#F8FAFC",
                    borderColor: form.formState.errors.email ? "#EF4444" : "#E2E8F0",
                    color: "#07113A",
                    fontFamily: "Poppins, sans-serif",
                  }}
                  onChange={(e) => form.setValue("email", formatIdentifier(e.target.value))}
                  data-testid="input-email"
                />
              </div>
              {form.formState.errors.email && (
                <p className="text-xs mt-1.5 ml-1" style={{ color: "#EF4444" }}>
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            {/* Senha */}
            <div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
                <input
                  {...form.register("password")}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Senha"
                  className="w-full pl-11 pr-12 h-13 rounded-xl text-sm border outline-none transition-all"
                  style={{
                    height: 52,
                    background: "#F8FAFC",
                    borderColor: form.formState.errors.password ? "#EF4444" : "#E2E8F0",
                    color: "#07113A",
                    fontFamily: "Poppins, sans-serif",
                  }}
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  style={{ color: "#9CA3AF" }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-xs mt-1.5 ml-1" style={{ color: "#EF4444" }}>
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            {/* Forgot password */}
            <div className="flex justify-end">
              <a
                href="/recuperar-senha"
                className="text-xs font-medium"
                style={{ color: "#0D1B8C" }}
                data-testid="link-forgot-password"
              >
                Esqueci minha senha
              </a>
            </div>

            {/* Erro global */}
            {error && (
              <div
                className="rounded-xl px-4 py-3 text-sm text-center"
                style={{ background: "#FEE2E2", color: "#DC2626" }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={login.isPending}
              className="w-full flex items-center justify-center gap-2 font-semibold rounded-xl text-white text-sm transition-all active:scale-[0.97]"
              style={{
                height: 52,
                background: login.isPending
                  ? "rgba(13,27,140,0.6)"
                  : "linear-gradient(135deg, #0D1B8C 0%, #1A2FB0 100%)",
                boxShadow: "0 4px 20px rgba(13,27,140,0.30)",
              }}
              data-testid="button-submit"
            >
              {login.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar na plataforma
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divisor */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: "#E2E8F0" }} />
            <span className="text-xs" style={{ color: "#94A3B8" }}>ou</span>
            <div className="flex-1 h-px" style={{ background: "#E2E8F0" }} />
          </div>

          {/* Cadastro */}
          <div className="text-center">
            <p className="text-sm" style={{ color: "#64748B" }}>Ainda não tem uma conta?</p>
            <Link
              href="/cadastro"
              className="inline-flex items-center gap-1.5 mt-1.5 text-sm font-bold"
              style={{ color: "#0D1B8C" }}
              data-testid="link-register"
            >
              Criar minha conta
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Badge de segurança */}
        <div className="flex items-center justify-center gap-2 mt-5">
          <ShieldCheck className="w-4 h-4" style={{ color: "#10A65A" }} />
          <span className="text-xs" style={{ color: "#64748B" }}>
            Seus dados protegidos — LGPD Compliant
          </span>
        </div>

        {/* Links legais */}
        <div className="flex items-center justify-center gap-4 mt-4">
          <a href="/termos" className="text-[10px]" style={{ color: "#94A3B8" }}>Termos de Uso</a>
          <span style={{ color: "#CBD5E1" }}>·</span>
          <a href="/privacidade" className="text-[10px]" style={{ color: "#94A3B8" }}>Privacidade</a>
        </div>
      </div>
    </div>
  );
}
