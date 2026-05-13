import { useState } from "react";
import { useLocation, Link } from "wouter";
import { CheckCircle, Eye, EyeOff, ArrowRight, Building2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getGetMeQueryKey } from "@workspace/api-client-react";

function maskCPF(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function maskPhone(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function formatCurrency(value: string) {
  const n = value.replace(/\D/g, "");
  if (!n) return "";
  return (parseInt(n, 10) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseCurrency(value: string): number {
  return parseFloat(value.replace(/\D/g, "")) / 100;
}

export function ClientRegister() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: "",
    cpf: "",
    email: "",
    phone: "",
    password: "",
    income: "",
    propertyValue: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (key === "cpf") val = maskCPF(val);
    else if (key === "phone") val = maskPhone(val);
    else if (key === "income" || key === "propertyValue") val = formatCurrency(val);
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) errs.name = "Nome obrigatório (mínimo 2 caracteres)";
    const cpfDigits = form.cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11) errs.cpf = "CPF inválido";
    if (!form.email.includes("@")) errs.email = "Email inválido";
    const phoneDigits = form.phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) errs.phone = "Telefone inválido";
    if (form.password.length < 6) errs.password = "Senha mínima de 6 caracteres";
    if (parseCurrency(form.income) <= 0) errs.income = "Informe sua renda mensal";
    if (parseCurrency(form.propertyValue) <= 0) errs.propertyValue = "Informe o valor do imóvel";
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
      const resp = await fetch(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          cpf: form.cpf.replace(/\D/g, ""),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.replace(/\D/g, ""),
          password: form.password,
          income: parseCurrency(form.income),
          propertyValue: parseCurrency(form.propertyValue),
        }),
      });

      if (resp.status === 409) {
        setErrors({ email: "Este email já está cadastrado" });
        return;
      }
      if (!resp.ok) throw new Error("Erro ao cadastrar");

      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setLocation("/portal");
    } catch {
      toast({ title: "Erro ao criar conta", description: "Tente novamente." });
    } finally {
      setLoading(false);
    }
  };

  const Field = ({
    label, field, type = "text", placeholder, error,
  }: { label: string; field: keyof typeof form; type?: string; placeholder?: string; error?: string }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={field === "password" ? (showPassword ? "text" : "password") : type}
          value={form[field]}
          onChange={set(field)}
          placeholder={placeholder}
          className={`w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors ${
            error ? "border-red-400 bg-red-50" : "border-gray-200 bg-white focus:border-[#0D1B8C]"
          }`}
        />
        {field === "password" && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );

  return (
    <div className="min-h-screen flex" style={{ background: "#07113A" }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-2/5 flex-col justify-between p-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#10A65A" }}>
            <CheckCircle className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg">ScoreCasa</span>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Descubra suas<br />
            <span style={{ color: "#10A65A" }}>chances de aprovação</span><br />
            em segundos.
          </h1>
          <p className="text-blue-200 text-base leading-relaxed mb-8">
            Análise preditiva de crédito imobiliário baseada em renda, valor do imóvel e perfil financeiro.
          </p>
          <div className="space-y-3">
            {[
              "Score calculado por IA proprietária",
              "Verificação de elegibilidade MCMV e Caixa",
              "Recomendação personalizada do seu perfil",
              "Acompanhamento em tempo real",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-blue-100 text-sm">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#10A65A" }} />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-blue-300 text-xs">
          <Building2 className="w-4 h-4" />
          Inteligência de Crédito Imobiliário
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6" style={{ background: "#F4F6FB" }}>
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#10A65A" }}>
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg" style={{ color: "#07113A" }}>ScoreCasa</span>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-1" style={{ color: "#07113A" }}>Crie sua conta</h2>
            <p className="text-gray-500 text-sm mb-6">Preencha seus dados para calcular seu score de crédito</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Nome completo" field="name" placeholder="João da Silva" error={errors.name} />

              <div className="grid grid-cols-2 gap-3">
                <Field label="CPF" field="cpf" placeholder="000.000.000-00" error={errors.cpf} />
                <Field label="Telefone" field="phone" placeholder="(11) 99999-9999" error={errors.phone} />
              </div>

              <Field label="Email" field="email" type="email" placeholder="seu@email.com" error={errors.email} />
              <Field label="Senha" field="password" placeholder="Mínimo 6 caracteres" error={errors.password} />

              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Dados financeiros</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Renda mensal" field="income" placeholder="R$ 0,00" error={errors.income} />
                  <Field label="Valor do imóvel" field="propertyValue" placeholder="R$ 0,00" error={errors.propertyValue} />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-60"
                style={{ background: "#0D1B8C" }}
              >
                {loading ? "Calculando seu score..." : (
                  <>
                    Calcular meu score <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-4">
              Já tem conta?{" "}
              <Link href="/login">
                <span className="font-semibold cursor-pointer" style={{ color: "#0D1B8C" }}>Entrar</span>
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
