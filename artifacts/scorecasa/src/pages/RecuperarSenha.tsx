import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Mail, CheckCircle2, Copy, ExternalLink, Loader2 } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const schema = z.object({
  identifier: z.string().min(1, "Informe seu e-mail ou CPF").refine((v) => {
    const t = v.trim();
    const d = t.replace(/\D/g, "");
    if (d.length === 11 && /^\d+$/.test(d)) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
  }, "Informe um e-mail válido ou CPF com 11 dígitos"),
});
type FormData = z.infer<typeof schema>;

function formatIdentifier(raw: string): string {
  const t = raw.trim();
  const d = t.replace(/\D/g, "");
  if (/^[\d.\-\s]*$/.test(t) && d.length > 0 && d.length <= 11) {
    const x = d.slice(0, 11);
    if (x.length <= 3) return x;
    if (x.length <= 6) return `${x.slice(0, 3)}.${x.slice(3)}`;
    if (x.length <= 9) return `${x.slice(0, 3)}.${x.slice(3, 6)}.${x.slice(6)}`;
    return `${x.slice(0, 3)}.${x.slice(3, 6)}.${x.slice(6, 9)}-${x.slice(9)}`;
  }
  return t;
}

export default function RecuperarSenha() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: "" },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const t = data.identifier.trim();
      const d = t.replace(/\D/g, "");
      const identifier = d.length === 11 ? d : t.toLowerCase();
      const resp = await fetch(`${BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        toast({ title: "Não foi possível gerar o link", description: json?.error ?? "Tente novamente." });
        return;
      }
      setResetUrl(typeof json?.resetUrl === "string" ? json.resetUrl : null);
      setSubmitted(true);
    } catch {
      toast({ title: "Erro de conexão", description: "Tente novamente em instantes." });
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!resetUrl) return;
    try {
      await navigator.clipboard.writeText(resetUrl);
      toast({ title: "Link copiado", description: "Cole no navegador para redefinir a senha." });
    } catch {
      toast({ title: "Não consegui copiar", description: "Copie manualmente do campo abaixo." });
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

        {submitted ? (
          <div className="py-2" data-testid="success-message">
            <div className="text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(16, 166, 90, 0.12)" }}
              >
                <CheckCircle2 className="w-8 h-8" style={{ color: "#10A65A" }} />
              </div>
              <h1 className="text-2xl font-bold mb-2" style={{ color: "#07113A", fontFamily: "Poppins, sans-serif" }}>
                Link de redefinição gerado
              </h1>
              <p className="text-sm text-gray-600 mb-6">
                Se a conta existir, geramos um link de redefinição válido por 1 hora.
              </p>
            </div>

            {resetUrl ? (
              <div
                className="rounded-xl border p-4 mb-4"
                style={{ borderColor: "#FACC15", background: "#FEFCE8" }}
              >
                <p className="text-xs font-semibold mb-2" style={{ color: "#854D0E" }}>
                  Envio de e-mail ainda não está conectado
                </p>
                <p className="text-xs mb-3" style={{ color: "#713F12" }}>
                  Por enquanto, copie o link abaixo e abra no navegador para criar uma nova senha.
                </p>
                <div className="bg-white border border-gray-200 rounded-lg p-2 text-xs break-all font-mono text-gray-700 mb-3" data-testid="text-reset-url">
                  {resetUrl}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={copyLink}
                    className="flex-1 h-10 rounded-lg text-white text-sm gap-2"
                    style={{ background: "#0D1B8C" }}
                    data-testid="button-copy-link"
                  >
                    <Copy className="w-4 h-4" /> Copiar
                  </Button>
                  <a href={resetUrl} className="flex-1">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-10 rounded-lg text-sm gap-2"
                      data-testid="button-open-link"
                    >
                      <ExternalLink className="w-4 h-4" /> Abrir
                    </Button>
                  </a>
                </div>
              </div>
            ) : null}

            <Link href="/login">
              <a>
                <Button
                  variant="outline"
                  className="w-full h-12 font-semibold rounded-xl text-sm"
                  data-testid="button-back-to-login"
                >
                  Voltar para o login
                </Button>
              </a>
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-2" style={{ color: "#07113A", fontFamily: "Poppins, sans-serif" }}>
              Esqueci minha senha
            </h1>
            <p className="text-sm text-gray-600 mb-6">
              Informe seu e-mail ou CPF cadastrado para gerar um link de redefinição.
            </p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="identifier"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
                          <Input
                            {...field}
                            type="text"
                            inputMode="email"
                            autoComplete="username"
                            placeholder="E-mail ou CPF"
                            className="pl-11 h-12 rounded-xl bg-gray-50 border-gray-200"
                            onChange={(e) => field.onChange(formatIdentifier(e.target.value))}
                            data-testid="input-identifier"
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
                  data-testid="button-submit-recover"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Gerar link de recuperação"}
                </Button>
              </form>
            </Form>

            <p className="text-xs text-gray-500 text-center mt-6">
              Lembrou sua senha?{" "}
              <Link href="/login">
                <a className="font-medium hover:underline" style={{ color: "#0D1B8C" }}>
                  Fazer login
                </a>
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
