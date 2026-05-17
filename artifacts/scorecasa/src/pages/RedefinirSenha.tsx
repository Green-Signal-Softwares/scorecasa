import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Lock, CheckCircle2, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const schema = z
  .object({
    password: z.string().min(6, "Mínimo 6 caracteres"),
    confirm: z.string().min(6, "Mínimo 6 caracteres"),
  })
  .refine((d) => d.password === d.confirm, { message: "As senhas não coincidem", path: ["confirm"] });

type FormData = z.infer<typeof schema>;

export default function RedefinirSenha() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") ?? "";
  }, []);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  useEffect(() => {
    if (!token) {
      toast({ title: "Link inválido", description: "Solicite um novo link de redefinição." });
    }
  }, [token, toast]);

  const onSubmit = async (data: FormData) => {
    if (!token) return;
    setLoading(true);
    try {
      const resp = await fetch(`${BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: data.password }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        toast({ title: "Não foi possível redefinir", description: json?.error ?? "Tente novamente." });
        return;
      }
      setDone(true);
      setTimeout(() => setLocation("/login"), 1800);
    } catch {
      toast({ title: "Erro de conexão", description: "Tente novamente em instantes." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: "linear-gradient(135deg, #07113A 0%, #0D1B8C 100%)" }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <Link href="/login">
          <a
            className="inline-flex items-center gap-2 text-sm font-medium mb-6 hover:underline"
            style={{ color: "#0D1B8C" }}
            data-testid="link-back-login"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para o login
          </a>
        </Link>

        {done ? (
          <div className="text-center py-4" data-testid="success-reset">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(16, 166, 90, 0.12)" }}
            >
              <CheckCircle2 className="w-8 h-8" style={{ color: "#10A65A" }} />
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: "#07113A", fontFamily: "Poppins, sans-serif" }}>
              Senha redefinida!
            </h1>
            <p className="text-sm text-gray-600">Redirecionando para o login…</p>
          </div>
        ) : !token ? (
          <div className="text-center py-4" data-testid="invalid-token">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(220, 38, 38, 0.12)" }}
            >
              <AlertCircle className="w-8 h-8" style={{ color: "#DC2626" }} />
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: "#07113A", fontFamily: "Poppins, sans-serif" }}>
              Link inválido
            </h1>
            <p className="text-sm text-gray-600 mb-6">Solicite um novo link na tela de recuperação.</p>
            <Link href="/recuperar-senha">
              <a>
                <Button
                  className="w-full h-12 font-semibold rounded-xl text-white"
                  style={{ background: "#0D1B8C" }}
                  data-testid="button-request-new"
                >
                  Solicitar novo link
                </Button>
              </a>
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-2" style={{ color: "#07113A", fontFamily: "Poppins, sans-serif" }}>
              Criar nova senha
            </h1>
            <p className="text-sm text-gray-600 mb-6">Escolha uma senha de pelo menos 6 caracteres.</p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-gray-700">Nova senha</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
                          <Input
                            {...field}
                            type={showPwd ? "text" : "password"}
                            autoComplete="new-password"
                            placeholder="Mínimo 6 caracteres"
                            className="pl-11 pr-11 h-12 rounded-xl bg-gray-50 border-gray-200"
                            data-testid="input-new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPwd((s) => !s)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                          >
                            {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-gray-700">Confirmar senha</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
                          <Input
                            {...field}
                            type={showPwd ? "text" : "password"}
                            autoComplete="new-password"
                            placeholder="Repita a senha"
                            className="pl-11 h-12 rounded-xl bg-gray-50 border-gray-200"
                            data-testid="input-confirm-password"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 font-semibold rounded-xl text-white text-sm transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ background: "#0D1B8C" }}
                  data-testid="button-submit-reset"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Redefinir senha"}
                </Button>
              </form>
            </Form>
          </>
        )}
      </div>
    </div>
  );
}
