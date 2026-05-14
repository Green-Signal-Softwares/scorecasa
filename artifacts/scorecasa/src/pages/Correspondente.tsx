import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScoreCasaIcon, ScoreCasaWordmark } from "@/components/ScoreCasaLogo";
import {
  Workflow, Bell, Building2, ShieldCheck, FileCheck2, Users,
  ArrowRight, Plug, CheckCircle2, BarChart3, Sparkles,
} from "lucide-react";

const NAVY = "#07113A";
const BLUE = "#0D1B8C";
const GREEN = "#10A65A";

const HERO_BULLETS = [
  { icon: Workflow,    label: "Esteira de processos com fluxo de aprovação" },
  { icon: ShieldCheck, label: "Controle de acessos e produtividade" },
  { icon: Building2,   label: "Integração com a Caixa e bancos privados" },
];

const FEATURE_BULLETS = [
  {
    icon: BarChart3,
    title: "Telas pensadas na rotina do Corban",
    desc: "Dashboards, kanbans e checklists feitos para o dia a dia do correspondente bancário.",
  },
  {
    icon: Plug,
    title: "Integração com a Caixa e bancos privados",
    desc: "Espelhe dados entre o ScoreCasa e os portais (Caixa Aqui, Itaú, Bradesco, Santander, BB) com a extensão ScoreCasa Conectado.",
  },
  {
    icon: FileCheck2,
    title: "Checagem de documentação detalhada",
    desc: "Cada etapa da esteira tem sua própria checklist com upload, aprovação e histórico — sem planilha à parte.",
  },
];

const STAGES = ["Aprovação", "Engenharia", "Conformidade", "Contrato", "Concluído"];

export function Correspondente() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#FFFFFF" }}>
      {/* Top bar */}
      <header className="border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <ScoreCasaIcon size={32} />
            <ScoreCasaWordmark variant="dark" size="sm" />
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm" style={{ color: NAVY }}>Entrar</Button>
            </Link>
            <Link href="/cadastro">
              <Button size="sm" style={{ background: BLUE, color: "white" }}>
                Criar conta
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)`,
        }}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle at 20% 20%, rgba(16,166,90,0.4), transparent 40%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.15), transparent 50%)",
          }}
        />
        <div className="relative max-w-6xl mx-auto px-5 py-20 lg:py-28 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="text-white">
            <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: "rgba(16,166,90,0.18)", color: "#86EFAC", border: "1px solid rgba(16,166,90,0.4)" }}
            >
              <Sparkles className="w-3 h-3" /> Para Correspondentes Bancários
            </span>
            <h1 className="mt-5 text-4xl lg:text-5xl font-bold leading-tight tracking-tight">
              Aprovações de crédito<br />
              <span style={{ color: "#86EFAC" }}>de forma rápida</span>
            </h1>
            <p className="mt-5 text-lg text-blue-100/90 max-w-xl">
              Gerencie aprovações de crédito, receba notificações de processos em andamento em tempo real e conte com uma integração direta com todos os bancos.
            </p>

            <ul className="mt-7 space-y-3">
              {HERO_BULLETS.map((b) => (
                <li key={b.label} className="flex items-start gap-3 text-blue-50">
                  <span
                    className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(16,166,90,0.18)", color: "#86EFAC" }}
                  >
                    <b.icon className="w-4 h-4" />
                  </span>
                  <span className="text-sm pt-1">{b.label}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/cadastro">
                <Button size="lg" style={{ background: GREEN, color: "white" }}
                  className="font-semibold shadow-lg hover:opacity-90"
                  data-testid="cta-cadastro">
                  Começar agora <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline"
                  className="font-semibold border-white/30 text-white hover:bg-white/10 hover:text-white">
                  Já sou correspondente
                </Button>
              </Link>
            </div>
          </div>

          {/* Mockup card */}
          <div className="hidden lg:block">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl blur-2xl opacity-40"
                style={{ background: GREEN }} />
              <Card className="relative p-5 shadow-2xl rotate-1">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Processos ativos</div>
                    <div className="text-2xl font-bold" style={{ color: NAVY }}>27</div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full"
                    style={{ background: "#F0FDF4", color: GREEN }}>
                    +12% esta semana
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-2 mb-3">
                  {STAGES.map((s, i) => (
                    <div key={s} className="text-center">
                      <div
                        className="h-1.5 rounded-full mb-1.5"
                        style={{
                          background: i < 3 ? GREEN : "#E2E8F0",
                          opacity: i < 3 ? 1 : 0.6,
                        }}
                      />
                      <div className="text-[9px] font-medium" style={{ color: NAVY }}>{s}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {[
                    { name: "Juliana F. Santos", stage: "Engenharia", color: "#D97706" },
                    { name: "Pedro H. Almeida",  stage: "Aprovação",  color: BLUE },
                    { name: "Camila N. Pereira", stage: "Contrato",   color: GREEN },
                  ].map((l) => (
                    <div key={l.name} className="flex items-center justify-between p-2 rounded-md bg-slate-50">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                          {l.name.split(" ").map(n => n[0]).slice(0,2).join("")}
                        </div>
                        <span className="text-xs font-medium" style={{ color: NAVY }}>{l.name}</span>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: `${l.color}15`, color: l.color }}>
                        {l.stage}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES — Fluxo de aprovações detalhadas */}
      <section className="py-20 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: GREEN }}>
              Fluxo de aprovações detalhadas
            </span>
            <h2 className="mt-2 text-3xl lg:text-4xl font-bold" style={{ color: NAVY }}>
              Sua gestão mais eficiente e inteligente
            </h2>
            <p className="mt-4 text-base text-slate-600">
              Com o ScoreCasa perfil correspondente, você ganha agilidade nos financiamentos do seu negócio com um fluxo desenhado para o Corban moderno.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {FEATURE_BULLETS.map((f) => (
              <Card key={f.title} className="p-6 hover:shadow-lg transition-shadow"
                data-testid={`feature-${f.title}`}>
                <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: "#EEF2FF", color: BLUE }}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-base mb-2" style={{ color: NAVY }}>{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* STRIP: notificações em tempo real */}
      <section className="px-5 pb-20">
        <div className="max-w-6xl mx-auto">
          <Card className="p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center"
            style={{ background: NAVY, color: "white", border: "none" }}>
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(16,166,90,0.18)", color: "#86EFAC" }}>
                  <Bell className="w-5 h-5" />
                </div>
                <h3 className="text-xl lg:text-2xl font-bold">Notificações em tempo real</h3>
              </div>
              <p className="text-blue-100/90 max-w-2xl">
                Cada movimento na esteira (novo documento enviado, mudança de etapa, observação do analista) chega na sua caixa de notificações no instante em que acontece.
              </p>
            </div>
            <div className="space-y-2">
              {[
                { icon: CheckCircle2, text: "Lead aprovado por Caixa", time: "agora" },
                { icon: Users, text: "Novo doc anexado em Engenharia", time: "2 min" },
                { icon: Plug, text: "Espelhamento concluído via Conectado", time: "5 min" },
              ].map((n) => (
                <div key={n.text} className="flex items-center gap-3 p-3 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.06)" }}>
                  <n.icon className="w-4 h-4" style={{ color: "#86EFAC" }} />
                  <span className="text-xs flex-1">{n.text}</span>
                  <span className="text-[10px] text-blue-200/60">{n.time}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-5 pb-24">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold" style={{ color: NAVY }}>
            Pronto para acelerar suas aprovações?
          </h2>
          <p className="mt-3 text-base text-slate-600 max-w-xl mx-auto">
            Comece hoje a usar o ScoreCasa no perfil Correspondente e leve sua operação para o próximo nível.
          </p>
          <div className="mt-7 flex justify-center gap-3 flex-wrap">
            <Link href="/cadastro">
              <Button size="lg" style={{ background: BLUE, color: "white" }} className="font-semibold">
                Criar minha conta <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" style={{ borderColor: BLUE, color: BLUE }}>
                Entrar
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-6 px-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ScoreCasaIcon size={20} />
            <span>© {new Date().getFullYear()} ScoreCasa</span>
          </div>
          <div className="flex gap-4">
            <Link href="/termos" className="hover:underline">Termos</Link>
            <Link href="/privacidade" className="hover:underline">Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
