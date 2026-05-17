import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Lock, User as UserIcon, Eye, EyeOff, ArrowRight, ShieldCheck,
  TrendingUp, Landmark, Home, Brain, Star, CheckCircle2, Sparkles,
  Briefcase, Building2, Mail, IdCard, Hash,
} from "lucide-react";
import { ScoreCasaLogo, ScoreCasaIcon } from "@/components/ScoreCasaLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useRedirectIfAuthenticated } from "@/hooks/use-auth";

type ProfileTab = "client" | "broker" | "correspondent";

// Cliente: aceita e-mail OU CPF (11 dígitos, com ou sem máscara)
const clientSchema = z.object({
  email: z.string().min(1, "Informe seu e-mail ou CPF").refine((v) => {
    const trimmed = v.trim();
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length === 11 && /^\d+$/.test(digits)) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  }, "Informe um e-mail válido ou CPF com 11 dígitos"),
  password: z.string().min(1, "Senha obrigatória"),
});

const brokerSchema = z.object({
  cpf: z.string().refine((v) => v.replace(/\D/g, "").length === 11, "CPF inválido (11 dígitos)"),
  email: z.string().email("E-mail inválido"),
  creci: z.string().min(2, "Informe seu CRECI"),
  password: z.string().min(1, "Senha obrigatória"),
});

const correspondentSchema = z.object({
  cnpj: z.string().refine((v) => v.replace(/\D/g, "").length === 14, "CNPJ inválido (14 dígitos)"),
  email: z.string().email("E-mail inválido"),
  ccaCode: z.string().min(2, "Informe seu código CCA"),
  password: z.string().min(1, "Senha obrigatória"),
});

type ClientForm = z.infer<typeof clientSchema>;
type BrokerForm = z.infer<typeof brokerSchema>;
type CorrespondentForm = z.infer<typeof correspondentSchema>;

function maskCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function maskCNPJ(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatLoginIdentifier(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  // Se parece um CPF (apenas dígitos / pontuação típica), aplica máscara
  if (/^[\d.\-\s]*$/.test(trimmed) && digits.length > 0 && digits.length <= 11) {
    const d = digits.slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  return trimmed;
}

// ── Score Gauge (semicircular) ────────────────────────────────────────────────
function ScoreGauge({ score, max = 1000 }: { score: number; max?: number }) {
  const pct = Math.min(1, score / max);
  const r = 110;
  const cx = 130;
  const cy = 130;
  const start = -210;
  const end = 30;
  const arc = end - start;

  const polar = (a: number) => {
    const rad = (a * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const [sx, sy] = polar(start);
  const [ex, ey] = polar(end);
  const largeArc = arc > 180 ? 1 : 0;
  const trackPath = `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`;

  // active arc to current pct
  const [px, py] = polar(start + arc * pct);
  const activeLarge = arc * pct > 180 ? 1 : 0;
  const activePath = `M ${sx} ${sy} A ${r} ${r} 0 ${activeLarge} 1 ${px} ${py}`;

  return (
    <svg viewBox="0 0 260 200" className="w-full max-w-[260px]" style={{ filter: "drop-shadow(0 8px 24px rgba(13, 27, 140, 0.35))" }}>
      <defs>
        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10A65A" />
          <stop offset="55%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      {/* Track */}
      <path d={trackPath} stroke="rgba(255,255,255,0.10)" strokeWidth={18} fill="none" strokeLinecap="round" />
      {/* Active */}
      <path d={activePath} stroke="url(#gaugeGrad)" strokeWidth={18} fill="none" strokeLinecap="round" />
      {/* Center label */}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="44" fontWeight="800" fill="#FFFFFF" fontFamily="Poppins, sans-serif">
        {score}
      </text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.6)" fontFamily="Poppins, sans-serif" letterSpacing="2">
        SEU SCORE
      </text>
      <text x={cx} y={cy + 42} textAnchor="middle" fontSize="14" fontWeight="700" fill="#10A65A" fontFamily="Poppins, sans-serif">
        Bom
      </text>
    </svg>
  );
}

// ── Bank wordmark badge ───────────────────────────────────────────────────────
function BankMark({ name }: { name: string }) {
  return (
    <div
      className="px-3 py-1.5 rounded-md text-[11px] font-bold tracking-wide"
      style={{
        color: "rgba(255,255,255,0.65)",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.10)",
        fontFamily: "Poppins, sans-serif",
      }}
    >
      {name}
    </div>
  );
}

export function Login() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isLoading: checkingAuth } = useRedirectIfAuthenticated();
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [profileTab, setProfileTab] = useState<ProfileTab>("client");

  const clientForm = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    defaultValues: { email: "", password: "" },
  });
  const brokerForm = useForm<BrokerForm>({
    resolver: zodResolver(brokerSchema),
    defaultValues: { cpf: "", email: "", creci: "", password: "" },
  });
  const correspondentForm = useForm<CorrespondentForm>({
    resolver: zodResolver(correspondentSchema),
    defaultValues: { cnpj: "", email: "", ccaCode: "", password: "" },
  });

  const handleSuccess = (data: unknown) => {
    queryClient.invalidateQueries();
    const role = (data as { user?: { role?: string } })?.user?.role;
    setLocation(role === "client" ? "/portal" : "/dashboard");
  };

  const onClientSubmit = (data: ClientForm) => {
    const trimmed = data.email.trim();
    const digits = trimmed.replace(/\D/g, "");
    const looksLikeCpf = /^[\d.\-\s]+$/.test(trimmed) && digits.length === 11;
    const normalized = looksLikeCpf ? digits : trimmed.toLowerCase();
    login.mutate(
      { data: { email: normalized, password: data.password, profile: "client" } },
      {
        onSuccess: handleSuccess,
        onError: () => clientForm.setError("password", { message: "Credenciais inválidas" }),
      },
    );
  };

  const onBrokerSubmit = (data: BrokerForm) => {
    login.mutate(
      {
        data: {
          email: data.email.trim().toLowerCase(),
          password: data.password,
          profile: "broker",
          cpf: data.cpf.replace(/\D/g, ""),
          creci: data.creci.trim(),
        },
      },
      {
        onSuccess: handleSuccess,
        onError: () =>
          brokerForm.setError("password", {
            message: "Credenciais inválidas. Verifique CPF, e-mail, CRECI e senha.",
          }),
      },
    );
  };

  const onCorrespondentSubmit = (data: CorrespondentForm) => {
    login.mutate(
      {
        data: {
          email: data.email.trim().toLowerCase(),
          password: data.password,
          profile: "correspondent",
          cnpj: data.cnpj.replace(/\D/g, ""),
          ccaCode: data.ccaCode.trim(),
        },
      },
      {
        onSuccess: handleSuccess,
        onError: () =>
          correspondentForm.setError("password", {
            message: "Credenciais inválidas. Verifique CNPJ, e-mail, código CCA e senha.",
          }),
      },
    );
  };

  const ssoSoon = (provider: string) =>
    toast({ title: `Login com ${provider}`, description: "Em breve disponível." });

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07113A" }}>
        <div className="flex flex-col items-center gap-4">
          <ScoreCasaIcon size={52} />
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const features = [
    { icon: Brain, title: "Análise Inteligente", desc: "IA que entende seu perfil" },
    { icon: Landmark, title: "Maior Chance de Aprovação", desc: "Planejamento personalizado" },
    { icon: ShieldCheck, title: "Open Finance Seguro", desc: "Seus dados protegidos e conectados" },
    { icon: Home, title: "Imóveis Ideais para Você", desc: "Encontre imóveis compatíveis" },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: "#F2F4F7", fontFamily: "Poppins, sans-serif" }}>
      {/* ── Left: Brand panel ── */}
      <div
        className="hidden lg:flex flex-col w-[58%] flex-shrink-0 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0D1B8C 0%, #07113A 60%, #050B25 100%)" }}
      >
        {/* Decorative blurs */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full" style={{ background: "rgba(13,27,140,0.55)", filter: "blur(120px)" }} />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] rounded-full" style={{ background: "rgba(16,166,90,0.18)", filter: "blur(140px)" }} />

        {/* Top — logo */}
        <div className="relative z-10 px-12 pt-10">
          <ScoreCasaLogo variant="light" size="lg" />
          <p className="text-xs mt-1 ml-1" style={{ color: "rgba(255,255,255,0.55)" }}>
            Inteligência para aprovar mais.
          </p>
        </div>

        {/* Center */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-12 py-8">
          {/* Pill badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-wider w-fit mb-5"
            style={{ background: "rgba(13,27,140,0.45)", border: "1px solid rgba(59,130,246,0.35)", color: "#A5B4FC" }}
          >
            <Sparkles className="w-3 h-3" />
            Plataforma de Inteligência Imobiliária
          </div>

          {/* Headline */}
          <h1 className="text-4xl xl:text-5xl font-bold leading-[1.1] mb-4 text-white">
            A inteligência que<br />
            transforma intenção<br />
            em <span style={{ color: "#10A65A" }}>aprovação.</span>
          </h1>

          <p className="text-sm xl:text-base leading-relaxed max-w-md mb-8" style={{ color: "rgba(255,255,255,0.65)" }}>
            Análise inteligente de crédito, previsão de aprovação,
            conexão bancária via Open Finance e os melhores
            imóveis para o seu perfil.
          </p>

          {/* Score visual */}
          <div className="flex items-center gap-6 mb-8">
            <div className="flex-shrink-0">
              <ScoreGauge score={682} />
            </div>
            <div className="space-y-2.5">
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: "rgba(16,166,90,0.12)", border: "1px solid rgba(16,166,90,0.30)" }}
              >
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#10A65A" }} />
                <div className="text-[11px]">
                  <div style={{ color: "rgba(255,255,255,0.7)" }}>Chance de aprovação</div>
                  <div className="font-bold text-white text-sm">78% <span style={{ color: "#10A65A" }}>Alta</span></div>
                </div>
              </div>
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: "rgba(34,211,238,0.10)", border: "1px solid rgba(34,211,238,0.25)" }}
              >
                <TrendingUp className="w-4 h-4 flex-shrink-0" style={{ color: "#22D3EE" }} />
                <div className="text-[11px]">
                  <div style={{ color: "rgba(255,255,255,0.7)" }}>Evolução do score</div>
                  <div className="font-bold text-white text-sm">+124 pontos <span style={{ color: "rgba(255,255,255,0.5)" }} className="font-normal">/ 60 dias</span></div>
                </div>
              </div>
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
              >
                <ShieldCheck className="w-4 h-4 flex-shrink-0" style={{ color: "#A5B4FC" }} />
                <div className="text-[11px]">
                  <div style={{ color: "rgba(255,255,255,0.7)" }}>Dados 100% seguros</div>
                  <div className="font-semibold text-white text-xs">LGPD Compliant</div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-4 gap-3 max-w-2xl mb-8">
            {features.map((f) => (
              <div
                key={f.title}
                className="p-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center mb-2"
                  style={{ background: "rgba(16,166,90,0.18)", color: "#10A65A" }}
                >
                  <f.icon className="w-4 h-4" />
                </div>
                <div className="text-[11px] font-bold text-white leading-tight mb-1">{f.title}</div>
                <div className="text-[10px] leading-snug" style={{ color: "rgba(255,255,255,0.5)" }}>{f.desc}</div>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div
            className="flex items-center gap-4 p-4 rounded-xl max-w-xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex -space-x-2 flex-shrink-0">
              {["#F87171", "#FBBF24", "#34D399", "#60A5FA"].map((c, i) => (
                <div
                  key={i}
                  className="w-9 h-9 rounded-full border-2 flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: c, borderColor: "#07113A" }}
                >
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white leading-snug">
                Mais de 35.000 pessoas já estão mais próximas da conquista da casa própria.
              </div>
              <div className="flex items-center gap-0.5 mt-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="w-3 h-3 fill-current" style={{ color: "#FBBF24" }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom — bank logos */}
        <div className="relative z-10 px-12 pb-8">
          <div className="text-[10px] uppercase tracking-widest text-center mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
            Conectado com os principais bancos
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {["CAIXA", "Itaú", "Bradesco", "Santander", "Banco do Brasil", "SICOOB"].map((b) => (
              <BankMark key={b} name={b} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: Login form ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <ScoreCasaLogo variant="dark" size="md" />
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            {/* Card logo */}
            <div className="flex flex-col items-center mb-6">
              <ScoreCasaLogo variant="dark" size="lg" />
              <p className="text-[11px] mt-1" style={{ color: "#94A3B8" }}>
                Inteligência para aprovar mais.
              </p>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-xl font-bold mb-1" style={{ color: "#07113A" }}>
                Bem-vindo de volta!
              </h2>
              <p className="text-sm" style={{ color: "#6B7280" }}>
                Faça login para acessar sua conta
              </p>
            </div>

            {/* Profile tabs */}
            <div
              className="grid grid-cols-3 gap-1 p-1 rounded-xl mb-5"
              style={{ background: "#F1F5F9" }}
              role="tablist"
              aria-label="Tipo de acesso"
            >
              {([
                { id: "client" as const, label: "Cliente", icon: UserIcon, testid: "tab-client" },
                { id: "broker" as const, label: "Corretor", icon: Briefcase, testid: "tab-broker" },
                { id: "correspondent" as const, label: "Correspondente", icon: Building2, testid: "tab-correspondent" },
              ]).map((t) => {
                const active = profileTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setProfileTab(t.id)}
                    className="flex items-center justify-center gap-1.5 h-10 rounded-lg text-[12px] font-semibold transition-all"
                    style={{
                      background: active ? "#FFFFFF" : "transparent",
                      color: active ? "#0D1B8C" : "#64748B",
                      boxShadow: active ? "0 1px 3px rgba(13,27,140,0.12)" : "none",
                    }}
                    data-testid={t.testid}
                  >
                    <t.icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {profileTab === "client" && (
              <Form {...clientForm}>
                <form onSubmit={clientForm.handleSubmit(onClientSubmit)} className="space-y-4">
                  <FormField
                    control={clientForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
                            <Input
                              {...field}
                              type="text"
                              inputMode="email"
                              autoComplete="username"
                              placeholder="E-mail ou CPF"
                              className="pl-11 h-12 rounded-xl bg-gray-50 border-gray-200"
                              onChange={(e) => field.onChange(formatLoginIdentifier(e.target.value))}
                              data-testid="input-email"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={clientForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
                            <Input
                              {...field}
                              type={showPassword ? "text" : "password"}
                              placeholder="Senha"
                              className="pl-11 pr-11 h-12 rounded-xl bg-gray-50 border-gray-200"
                              data-testid="input-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((v) => !v)}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-gray-200 transition-colors"
                              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                              data-testid="button-toggle-password"
                            >
                              {showPassword ? (
                                <EyeOff className="w-4 h-4" style={{ color: "#9CA3AF" }} />
                              ) : (
                                <Eye className="w-4 h-4" style={{ color: "#9CA3AF" }} />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 cursor-pointer select-none" style={{ color: "#475569" }}>
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300"
                        style={{ accentColor: "#0D1B8C" }}
                        data-testid="checkbox-remember"
                      />
                      Lembrar meu acesso
                    </label>
                    <a href="/recuperar-senha" className="font-medium hover:underline" style={{ color: "#0D1B8C" }} data-testid="link-forgot-password">
                      Esqueci minha senha
                    </a>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-12 font-semibold rounded-xl text-white text-sm transition-all hover:opacity-90"
                    style={{ background: "#0D1B8C" }}
                    disabled={login.isPending}
                    data-testid="button-submit"
                  >
                    {login.isPending ? "Entrando..." : "Entrar na plataforma"}
                  </Button>
                </form>
              </Form>
            )}

            {profileTab === "broker" && (
              <Form {...brokerForm}>
                <form onSubmit={brokerForm.handleSubmit(onBrokerSubmit)} className="space-y-4">
                  <FormField
                    control={brokerForm.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <IdCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
                            <Input
                              {...field}
                              inputMode="numeric"
                              placeholder="CPF"
                              className="pl-11 h-12 rounded-xl bg-gray-50 border-gray-200"
                              onChange={(e) => field.onChange(maskCPF(e.target.value))}
                              data-testid="input-broker-cpf"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={brokerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
                            <Input
                              {...field}
                              type="email"
                              autoComplete="email"
                              placeholder="E-mail"
                              className="pl-11 h-12 rounded-xl bg-gray-50 border-gray-200"
                              data-testid="input-broker-email"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={brokerForm.control}
                    name="creci"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
                            <Input
                              {...field}
                              placeholder="CRECI"
                              className="pl-11 h-12 rounded-xl bg-gray-50 border-gray-200"
                              data-testid="input-broker-creci"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={brokerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
                            <Input
                              {...field}
                              type={showPassword ? "text" : "password"}
                              placeholder="Senha"
                              className="pl-11 pr-11 h-12 rounded-xl bg-gray-50 border-gray-200"
                              data-testid="input-broker-password"
                            />
                            <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-gray-200 transition-colors" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                              {showPassword ? <EyeOff className="w-4 h-4" style={{ color: "#9CA3AF" }} /> : <Eye className="w-4 h-4" style={{ color: "#9CA3AF" }} />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full h-12 font-semibold rounded-xl text-white text-sm transition-all hover:opacity-90"
                    style={{ background: "#0D1B8C" }}
                    disabled={login.isPending}
                    data-testid="button-submit-broker"
                  >
                    {login.isPending ? "Entrando..." : "Entrar como corretor"}
                  </Button>
                </form>
              </Form>
            )}

            {profileTab === "correspondent" && (
              <Form {...correspondentForm}>
                <form onSubmit={correspondentForm.handleSubmit(onCorrespondentSubmit)} className="space-y-4">
                  <FormField
                    control={correspondentForm.control}
                    name="cnpj"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
                            <Input
                              {...field}
                              inputMode="numeric"
                              placeholder="CNPJ"
                              className="pl-11 h-12 rounded-xl bg-gray-50 border-gray-200"
                              onChange={(e) => field.onChange(maskCNPJ(e.target.value))}
                              data-testid="input-corr-cnpj"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={correspondentForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
                            <Input
                              {...field}
                              type="email"
                              autoComplete="email"
                              placeholder="E-mail"
                              className="pl-11 h-12 rounded-xl bg-gray-50 border-gray-200"
                              data-testid="input-corr-email"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={correspondentForm.control}
                    name="ccaCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
                            <Input
                              {...field}
                              placeholder="Código CCA (Correspondente Caixa)"
                              className="pl-11 h-12 rounded-xl bg-gray-50 border-gray-200"
                              data-testid="input-corr-cca"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={correspondentForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
                            <Input
                              {...field}
                              type={showPassword ? "text" : "password"}
                              placeholder="Senha"
                              className="pl-11 pr-11 h-12 rounded-xl bg-gray-50 border-gray-200"
                              data-testid="input-corr-password"
                            />
                            <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-gray-200 transition-colors" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                              {showPassword ? <EyeOff className="w-4 h-4" style={{ color: "#9CA3AF" }} /> : <Eye className="w-4 h-4" style={{ color: "#9CA3AF" }} />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full h-12 font-semibold rounded-xl text-white text-sm transition-all hover:opacity-90"
                    style={{ background: "#0D1B8C" }}
                    disabled={login.isPending}
                    data-testid="button-submit-correspondent"
                  >
                    {login.isPending ? "Entrando..." : "Entrar como correspondente"}
                  </Button>
                </form>
              </Form>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs" style={{ color: "#94A3B8" }}>ou continue com</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* SSO */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => ssoSoon("Google")}
                className="flex items-center justify-center gap-2 h-11 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-sm font-medium"
                style={{ color: "#374151" }}
                data-testid="button-sso-google"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
                  <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.5 7.4 24 12 24z" />
                  <path fill="#FBBC05" d="M5.4 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.6.4-2.4V6.6H1.4C.5 8.2 0 10 0 12s.5 3.8 1.4 5.4l4-3z" />
                  <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.7l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.5 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
                </svg>
                Google
              </button>
              <button
                type="button"
                onClick={() => ssoSoon("Apple")}
                className="flex items-center justify-center gap-2 h-11 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-sm font-medium"
                style={{ color: "#374151" }}
                data-testid="button-sso-apple"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M17.05 12.04c-.03-3.16 2.58-4.68 2.7-4.75-1.47-2.15-3.76-2.45-4.58-2.48-1.95-.2-3.81 1.15-4.8 1.15-.99 0-2.52-1.12-4.14-1.09-2.13.03-4.1 1.24-5.19 3.13-2.21 3.83-.57 9.5 1.59 12.61 1.05 1.52 2.31 3.23 3.96 3.17 1.59-.06 2.19-1.03 4.12-1.03 1.92 0 2.46 1.03 4.14 1 1.71-.03 2.79-1.55 3.84-3.07 1.21-1.76 1.7-3.47 1.73-3.56-.04-.02-3.32-1.27-3.36-5.04zM13.94 2.79c.88-1.07 1.47-2.55 1.31-4.04-1.27.05-2.81.85-3.71 1.91-.81.94-1.51 2.45-1.32 3.91 1.41.11 2.85-.71 3.72-1.78z" />
                </svg>
                Apple
              </button>
            </div>

            {/* Sign up */}
            <div className="text-center mt-6 pt-5" style={{ borderTop: "1px solid #F1F5F9" }}>
              <p className="text-sm" style={{ color: "#64748B" }}>
                Ainda não tem uma conta?
              </p>
              <a
                href="/cadastro"
                className="inline-flex items-center gap-1.5 mt-1 text-sm font-bold hover:underline"
                style={{ color: "#0D1B8C" }}
                data-testid="link-register"
              >
                Criar minha conta
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Security note */}
          <div
            className="mt-4 flex items-start gap-3 p-3.5 rounded-xl"
            style={{ background: "#FFFFFF", border: "1px solid #E2E8F0" }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "#EEF2FF", color: "#0D1B8C" }}
            >
              <Lock className="w-4 h-4" />
            </div>
            <div className="text-[11px] leading-relaxed" style={{ color: "#64748B" }}>
              <div className="font-bold mb-0.5" style={{ color: "#07113A" }}>Seus dados estão protegidos</div>
              Utilizamos criptografia e seguimos a LGPD para garantir sua privacidade.
            </div>
          </div>

          {/* Footer links + demo */}
          <div className="text-center mt-5 space-y-2">
            <p className="text-[10px]" style={{ color: "#94A3B8" }}>
              Acesso demo:{" "}
              <span className="font-mono" style={{ color: "#64748B" }}>admin@scorecasa.com.br</span>
              {" / "}
              <span className="font-mono" style={{ color: "#64748B" }}>admin123</span>
            </p>
            <div className="flex items-center justify-center gap-3">
              <a href="/termos" className="text-[10px] hover:underline" style={{ color: "#94A3B8" }}>Termos de Uso</a>
              <span style={{ color: "#CBD5E1" }}>·</span>
              <a href="/privacidade" className="text-[10px] hover:underline" style={{ color: "#94A3B8" }}>Privacidade</a>
              <span style={{ color: "#CBD5E1" }}>·</span>
              <a href="mailto:contato@scorecasa.com.br" className="text-[10px] hover:underline" style={{ color: "#94A3B8" }}>Contato</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
