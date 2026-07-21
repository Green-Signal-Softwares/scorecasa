import { useState } from "react";
import { useLocation } from "wouter";
import { useRegister, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, User, Phone, Mail, Lock,
  TrendingUp, ShieldCheck, Check, Info, Landmark, Eye, EyeOff
} from "lucide-react";

// Helper masks
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
  const digits = value.replace(/\D/g, "");
  if (!digits) return 0;
  const n = parseInt(digits, 10) / 100;
  return Number.isFinite(n) ? n : 0;
}

export function RegisterMobile() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const registerMutation = useRegister();

  const [step, setStep] = useState<1 | 2>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [income, setIncome] = useState("");
  const [propertyValue, setPropertyValue] = useState("");

  // Validation States
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateStep1 = () => {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 3) {
      errs.name = "Nome completo deve ter pelo menos 3 caracteres";
    }
    const cpfDigits = cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11) {
      errs.cpf = "CPF inválido (deve conter 11 dígitos)";
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = "E-mail inválido";
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      errs.phone = "Telefone inválido";
    }
    if (password.length < 6) {
      errs.password = "A senha deve ter pelo menos 6 caracteres";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs: Record<string, string> = {};
    const parsedIncome = parseCurrency(income);
    const parsedPropertyValue = parseCurrency(propertyValue);

    if (parsedIncome <= 0) {
      errs.income = "Informe sua renda mensal";
    }
    if (parsedPropertyValue <= 0) {
      errs.propertyValue = "Informe o valor do imóvel estimado";
    }
    if (!acceptedTerms) {
      errs.terms = "Você deve aceitar os termos para continuar";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    setError(null);
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateStep2()) return;

    registerMutation.mutate(
      {
        data: {
          role: "client",
          plan: "free",
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.replace(/\D/g, ""),
          password: password,
          cpf: cpf.replace(/\D/g, ""),
          income: parseCurrency(income),
          propertyValue: parseCurrency(propertyValue),
        },
      },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setLocation("/portal/score");
        },
        onError: (err: any) => {
          if (err?.status === 409) {
            setError("Este e-mail ou CPF já possui cadastro.");
          } else {
            setError("Ocorreu um erro ao criar a conta. Tente novamente.");
          }
        },
      }
    );
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "linear-gradient(180deg, #07113A 0%, #0A1650 35%, #F2F4F7 35%)",
        fontFamily: "Poppins, sans-serif",
      }}
    >
      {/* ── Header ── */}
      <div className="relative flex flex-col items-center pt-8 pb-6 px-6">
        <button
          type="button"
          onClick={() => {
            if (step === 2) {
              setStep(1);
            } else {
              setLocation("/login");
            }
          }}
          className="absolute left-6 top-8 text-white/80 active:text-white p-1"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        {/* Wordmark */}
        <div className="mb-4 mt-2">
          <span style={{ fontWeight: 800, fontSize: 24, letterSpacing: "-0.02em" }}>
            <span style={{ color: "#FFFFFF" }}>score</span>
            <span style={{ color: "#10A65A" }}>casa</span>
            <sup style={{ fontSize: "0.38em", color: "rgba(255,255,255,0.5)", verticalAlign: "super", marginLeft: 1 }}>®</sup>
          </span>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-3 mt-1">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step >= 1 ? "bg-[#10A65A] text-white" : "bg-white/10 text-white/50"
            }`}
          >
            {step > 1 ? <Check className="w-3.5 h-3.5" /> : "1"}
          </div>
          <div className="w-8 h-0.5 bg-white/20" />
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step >= 2 ? "bg-[#10A65A] text-white" : "bg-white/10 text-white/50"
            }`}
          >
            2
          </div>
        </div>
      </div>

      {/* ── Form Card ── */}
      <div className="flex-1 flex flex-col px-5 pb-8" style={{ background: "#F2F4F7" }}>
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100 flex-1 flex flex-col justify-between">
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-xl font-bold" style={{ color: "#07113A" }}>
                {step === 1 ? "Crie sua conta de Cliente" : "Dados de Crédito"}
              </h1>
              <p className="text-sm mt-1" style={{ color: "#64748B" }}>
                {step === 1
                  ? "Preencha seus dados de identificação"
                  : "Estes valores são usados para o cálculo inicial do score"}
              </p>
            </div>

            {error && (
              <div
                className="mb-4 p-3.5 rounded-xl border flex items-start gap-2.5 text-xs font-medium animate-shake"
                style={{
                  background: "#FEF2F2",
                  borderColor: "#FEE2E2",
                  color: "#EF4444",
                }}
              >
                <Info className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {step === 1 ? (
              /* ── Step 1 Form ── */
              <div className="space-y-4">
                {/* Nome */}
                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide" style={{ color: "#07113A" }}>
                    Nome Completo
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3.5 w-4 h-4" style={{ color: "#94A3B8" }} />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, name: "" }));
                      }}
                      placeholder="Ex: João da Silva"
                      className="w-full h-11 pl-10 pr-4 rounded-xl border text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-opacity-40"
                      style={{
                        borderColor: fieldErrors.name ? "#EF4444" : "#CBD5E1",
                        boxShadow: fieldErrors.name ? "0 0 0 2px rgba(239, 68, 68, 0.1)" : undefined,
                      }}
                    />
                  </div>
                  {fieldErrors.name && (
                    <span className="text-[10px] font-bold mt-1 block" style={{ color: "#EF4444" }}>
                      {fieldErrors.name}
                    </span>
                  )}
                </div>

                {/* CPF */}
                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide" style={{ color: "#07113A" }}>
                    CPF
                  </label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-3.5 w-4 h-4" style={{ color: "#94A3B8" }} />
                    <input
                      type="tel"
                      value={cpf}
                      onChange={(e) => {
                        setCpf(maskCPF(e.target.value));
                        setFieldErrors((prev) => ({ ...prev, cpf: "" }));
                      }}
                      placeholder="000.000.000-00"
                      className="w-full h-11 pl-10 pr-4 rounded-xl border text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-opacity-40"
                      style={{
                        borderColor: fieldErrors.cpf ? "#EF4444" : "#CBD5E1",
                        boxShadow: fieldErrors.cpf ? "0 0 0 2px rgba(239, 68, 68, 0.1)" : undefined,
                      }}
                    />
                  </div>
                  {fieldErrors.cpf && (
                    <span className="text-[10px] font-bold mt-1 block" style={{ color: "#EF4444" }}>
                      {fieldErrors.cpf}
                    </span>
                  )}
                </div>

                {/* E-mail */}
                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide" style={{ color: "#07113A" }}>
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 w-4 h-4" style={{ color: "#94A3B8" }} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, email: "" }));
                      }}
                      placeholder="exemplo@email.com"
                      className="w-full h-11 pl-10 pr-4 rounded-xl border text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-opacity-40"
                      style={{
                        borderColor: fieldErrors.email ? "#EF4444" : "#CBD5E1",
                        boxShadow: fieldErrors.email ? "0 0 0 2px rgba(239, 68, 68, 0.1)" : undefined,
                      }}
                    />
                  </div>
                  {fieldErrors.email && (
                    <span className="text-[10px] font-bold mt-1 block" style={{ color: "#EF4444" }}>
                      {fieldErrors.email}
                    </span>
                  )}
                </div>

                {/* Telefone */}
                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide" style={{ color: "#07113A" }}>
                    Celular
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3.5 w-4 h-4" style={{ color: "#94A3B8" }} />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(maskPhone(e.target.value));
                        setFieldErrors((prev) => ({ ...prev, phone: "" }));
                      }}
                      placeholder="(11) 99999-9999"
                      className="w-full h-11 pl-10 pr-4 rounded-xl border text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-opacity-40"
                      style={{
                        borderColor: fieldErrors.phone ? "#EF4444" : "#CBD5E1",
                        boxShadow: fieldErrors.phone ? "0 0 0 2px rgba(239, 68, 68, 0.1)" : undefined,
                      }}
                    />
                  </div>
                  {fieldErrors.phone && (
                    <span className="text-[10px] font-bold mt-1 block" style={{ color: "#EF4444" }}>
                      {fieldErrors.phone}
                    </span>
                  )}
                </div>

                {/* Senha */}
                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide" style={{ color: "#07113A" }}>
                    Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 w-4 h-4" style={{ color: "#94A3B8" }} />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, password: "" }));
                      }}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full h-11 pl-10 pr-10 rounded-xl border text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-opacity-40"
                      style={{
                        borderColor: fieldErrors.password ? "#EF4444" : "#CBD5E1",
                        boxShadow: fieldErrors.password ? "0 0 0 2px rgba(239, 68, 68, 0.1)" : undefined,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <span className="text-[10px] font-bold mt-1 block" style={{ color: "#EF4444" }}>
                      {fieldErrors.password}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              /* ── Step 2 Form ── */
              <div className="space-y-4">
                {/* Renda Mensal */}
                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide" style={{ color: "#07113A" }}>
                    Renda Mensal Comprovada
                  </label>
                  <div className="relative">
                    <Landmark className="absolute left-3 top-3.5 w-4 h-4" style={{ color: "#94A3B8" }} />
                    <input
                      type="tel"
                      value={income}
                      onChange={(e) => {
                        setIncome(formatCurrency(e.target.value));
                        setFieldErrors((prev) => ({ ...prev, income: "" }));
                      }}
                      placeholder="R$ 0,00"
                      className="w-full h-11 pl-10 pr-4 rounded-xl border text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-opacity-40"
                      style={{
                        borderColor: fieldErrors.income ? "#EF4444" : "#CBD5E1",
                        boxShadow: fieldErrors.income ? "0 0 0 2px rgba(239, 68, 68, 0.1)" : undefined,
                      }}
                    />
                  </div>
                  {fieldErrors.income && (
                    <span className="text-[10px] font-bold mt-1 block" style={{ color: "#EF4444" }}>
                      {fieldErrors.income}
                    </span>
                  )}
                </div>

                {/* Valor do Imóvel */}
                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide" style={{ color: "#07113A" }}>
                    Valor do Imóvel Desejado
                  </label>
                  <div className="relative">
                    <TrendingUp className="absolute left-3 top-3.5 w-4 h-4" style={{ color: "#94A3B8" }} />
                    <input
                      type="tel"
                      value={propertyValue}
                      onChange={(e) => {
                        setPropertyValue(formatCurrency(e.target.value));
                        setFieldErrors((prev) => ({ ...prev, propertyValue: "" }));
                      }}
                      placeholder="R$ 0,00"
                      className="w-full h-11 pl-10 pr-4 rounded-xl border text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-opacity-40"
                      style={{
                        borderColor: fieldErrors.propertyValue ? "#EF4444" : "#CBD5E1",
                        boxShadow: fieldErrors.propertyValue ? "0 0 0 2px rgba(239, 68, 68, 0.1)" : undefined,
                      }}
                    />
                  </div>
                  {fieldErrors.propertyValue && (
                    <span className="text-[10px] font-bold mt-1 block" style={{ color: "#EF4444" }}>
                      {fieldErrors.propertyValue}
                    </span>
                  )}
                </div>

                {/* Termos */}
                <div className="pt-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => {
                        setAcceptedTerms(e.target.checked);
                        setFieldErrors((prev) => ({ ...prev, terms: "" }));
                      }}
                      className="mt-0.5 rounded border-gray-300 text-[#10A65A] focus:ring-[#10A65A]"
                    />
                    <span className="text-xs leading-relaxed" style={{ color: "#64748B" }}>
                      Li e concordo com os{" "}
                      <span className="font-bold underline" style={{ color: "#0D1B8C" }}>Termos de Uso</span> e a{" "}
                      <span className="font-bold underline" style={{ color: "#0D1B8C" }}>Política de Privacidade</span>.
                    </span>
                  </label>
                  {fieldErrors.terms && (
                    <span className="text-[10px] font-bold mt-1 block" style={{ color: "#EF4444" }}>
                      {fieldErrors.terms}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-8">
            {step === 1 ? (
              <button
                type="button"
                onClick={handleNext}
                className="w-full h-12 rounded-xl text-white font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-md hover:shadow-lg"
                style={{ background: "#0D1B8C" }}
              >
                Continuar
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={registerMutation.isPending}
                className="w-full h-12 rounded-xl text-white font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-md hover:shadow-lg disabled:opacity-50"
                style={{ background: "#10A65A" }}
              >
                {registerMutation.isPending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  <>
                    Finalizar Cadastro
                    <Check className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
