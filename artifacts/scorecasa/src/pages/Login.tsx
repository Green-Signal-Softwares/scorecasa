import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, Mail } from "lucide-react";
import { ScoreCasaLogo, ScoreCasaIcon } from "@/components/ScoreCasaLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useRedirectIfAuthenticated } from "@/hooks/use-auth";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

type LoginForm = z.infer<typeof loginSchema>;

export function Login() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const queryClient = useQueryClient();
  const { isLoading: checkingAuth } = useRedirectIfAuthenticated();
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (data: LoginForm) => {
    login.mutate(
      { data },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries();
          const role = (data as any)?.user?.role;
          setLocation(role === "client" ? "/portal" : "/dashboard");
        },
        onError: () => {
          form.setError("password", { message: "Email ou senha inválidos" });
        },
      }
    );
  };

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

  return (
    <div className="min-h-screen flex" style={{ background: "#F2F4F7" }}>

      {/* ── Left: Brand panel ── */}
      <div
        className="hidden lg:flex flex-col w-[52%] flex-shrink-0 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0D1B8C 0%, #07113A 100%)" }}
      >
        {/* Top logo */}
        <div className="relative z-10 px-12 pt-10">
          <ScoreCasaLogo variant="light" size="md" />
        </div>

        {/* Center content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-12 pb-16">
          {/* Big icon */}
          <div className="mb-10">
            <ScoreCasaIcon size={92} />
          </div>

          <h1
            className="text-5xl font-bold leading-tight mb-5"
            style={{ fontFamily: "Poppins, sans-serif", color: "#FFFFFF" }}
          >
            Inteligência para<br />
            <span style={{ color: "#10A65A" }}>aprovar mais.</span>
          </h1>

          <p
            className="text-lg leading-relaxed max-w-sm"
            style={{ color: "rgba(255,255,255,0.65)", fontFamily: "Poppins, sans-serif", fontWeight: 400 }}
          >
            Análise preditiva de crédito imobiliário com IA para corretores e correspondentes bancários.
          </p>

          {/* Feature pills */}
          <div className="mt-10 flex flex-wrap gap-3">
            {[
              "Score proprietário com IA",
              "Open Finance integrado",
              "Múltiplos bancos",
              "Ranking de leads",
            ].map((feat) => (
              <span
                key={feat}
                className="text-xs px-3 py-1.5 rounded-full font-medium"
                style={{
                  background: "rgba(16,166,90,0.18)",
                  color: "#10A65A",
                  border: "1px solid rgba(16,166,90,0.3)",
                  fontFamily: "Poppins, sans-serif",
                }}
              >
                {feat}
              </span>
            ))}
          </div>
        </div>

        {/* Green wave bottom — matches brand pack icon style */}
        <div className="absolute bottom-0 left-0 right-0 z-0">
          <svg viewBox="0 0 600 120" preserveAspectRatio="none" className="w-full" style={{ height: 120 }}>
            <path d="M0 60 Q150 20 300 60 Q450 100 600 60 L600 120 L0 120 Z" fill="#10A65A" opacity="0.22" />
            <path d="M0 80 Q150 45 300 80 Q450 115 600 80 L600 120 L0 120 Z" fill="#10A65A" opacity="0.32" />
          </svg>
        </div>

        {/* Footer copyright */}
        <div
          className="relative z-10 px-12 pb-5 text-xs"
          style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Poppins, sans-serif" }}
        >
          © {new Date().getFullYear()} ScoreCasa. Todos os direitos reservados.
        </div>
      </div>

      {/* ── Right: Login form ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <ScoreCasaLogo variant="dark" size="md" />
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            {/* Header */}
            <div className="mb-8">
              <h2
                className="text-2xl font-bold mb-1"
                style={{ color: "#07113A", fontFamily: "Poppins, sans-serif" }}
              >
                Acessar plataforma
              </h2>
              <p className="text-sm" style={{ color: "#6B7280", fontFamily: "Poppins, sans-serif" }}>
                Entre com suas credenciais para continuar
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel
                        className="text-sm font-semibold"
                        style={{ color: "#07113A", fontFamily: "Poppins, sans-serif" }}
                      >
                        Email
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#6B7280" }} />
                          <Input
                            {...field}
                            type="email"
                            placeholder="seu@email.com"
                            className="pl-10"
                            data-testid="input-email"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel
                        className="text-sm font-semibold"
                        style={{ color: "#07113A", fontFamily: "Poppins, sans-serif" }}
                      >
                        Senha
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#6B7280" }} />
                          <Input
                            {...field}
                            type="password"
                            placeholder="••••••••"
                            className="pl-10"
                            data-testid="input-password"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full font-semibold py-2.5 rounded-xl text-white transition-all hover:opacity-90"
                  style={{ background: "#0D1B8C", fontFamily: "Poppins, sans-serif" }}
                  disabled={login.isPending}
                  data-testid="button-submit"
                >
                  {login.isPending ? "Entrando..." : "Entrar na plataforma"}
                </Button>
              </form>
            </Form>

            <div
              className="mt-6 pt-6 space-y-3 text-center"
              style={{ borderTop: "1px solid #F2F4F7" }}
            >
              <p className="text-sm" style={{ color: "#6B7280", fontFamily: "Poppins, sans-serif" }}>
                É cliente e quer analisar seu crédito?{" "}
                <a
                  href="/cadastro"
                  className="font-semibold hover:underline"
                  style={{ color: "#0D1B8C" }}
                >
                  Cadastre-se grátis
                </a>
              </p>
              <p className="text-xs" style={{ color: "#9CA3AF", fontFamily: "Poppins, sans-serif" }}>
                Acesso demo:{" "}
                <span className="font-mono" style={{ color: "#6B7280" }}>admin@scorecasa.com.br</span>
                {" / "}
                <span className="font-mono" style={{ color: "#6B7280" }}>admin123</span>
              </p>
              <div className="flex items-center justify-center gap-3 pt-1">
                <a
                  href="/termos"
                  className="text-xs hover:underline transition-colors"
                  style={{ color: "#9CA3AF" }}
                >
                  Termos de Uso
                </a>
                <span style={{ color: "#D1D5DB" }}>·</span>
                <a
                  href="/privacidade"
                  className="text-xs hover:underline transition-colors"
                  style={{ color: "#9CA3AF" }}
                >
                  Privacidade
                </a>
                <span style={{ color: "#D1D5DB" }}>·</span>
                <a
                  href="mailto:contato@scorecasa.com.br"
                  className="text-xs hover:underline transition-colors"
                  style={{ color: "#9CA3AF" }}
                >
                  Contato
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
