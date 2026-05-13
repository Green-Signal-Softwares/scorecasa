import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Lock, Mail, TrendingUp, Shield, Zap } from "lucide-react";
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
        onSuccess: () => {
          queryClient.invalidateQueries();
          setLocation("/dashboard");
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
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#10A65A" }}>
            <CheckCircle className="w-6 h-6 text-white" />
          </div>
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#07113A" }}>
      {/* Left: Branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12" style={{ background: "#07113A" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "#10A65A" }}
          >
            <CheckCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-2xl tracking-tight">ScoreCasa</div>
            <div className="text-xs" style={{ color: "#10A65A" }}>Inteligência de Crédito Imobiliário</div>
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Inteligência para<br />
            <span style={{ color: "#10A65A" }}>aprovar mais.</span>
          </h1>
          <p className="text-blue-300 text-lg leading-relaxed mb-10">
            Transformamos dados em aprovações. Análise preditiva de crédito imobiliário para corretores e correspondentes bancários.
          </p>

          <div className="space-y-4">
            {[
              { icon: TrendingUp, text: "Score proprietário com IA preditiva" },
              { icon: Shield, text: "Integração Open Finance e múltiplos bancos" },
              { icon: Zap, text: "Análise em tempo real com ranking de leads" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(16,166,90,0.15)" }}
                >
                  <Icon className="w-4 h-4" style={{ color: "#10A65A" }} />
                </div>
                <span className="text-blue-200 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-blue-400 text-xs">
          &copy; {new Date().getFullYear()} ScoreCasa. Todos os direitos reservados.
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex-1 flex items-center justify-center p-6" style={{ background: "#F2F4F7" }}>
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden justify-center">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "#10A65A" }}
            >
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold" style={{ color: "#07113A" }}>ScoreCasa</span>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Acessar plataforma</h2>
              <p className="text-gray-500 text-sm">Entre com suas credenciais para continuar</p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 text-sm font-medium">Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                      <FormLabel className="text-gray-700 text-sm font-medium">Senha</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                  className="w-full text-white font-semibold py-2.5 rounded-lg transition-all"
                  style={{ background: "#0D1B8C" }}
                  disabled={login.isPending}
                  data-testid="button-submit"
                >
                  {login.isPending ? "Entrando..." : "Entrar na plataforma"}
                </Button>
              </form>
            </Form>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400">
                Acesso demo: <span className="font-mono text-gray-600">admin@scorecasa.com.br</span> / <span className="font-mono text-gray-600">admin123</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
