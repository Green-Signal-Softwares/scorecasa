import { Link } from "wouter";
import { ArrowLeft, Shield, FileText, Scale, Lock, AlertTriangle, Users, Globe } from "lucide-react";
import { ScoreCasaLogo } from "@/components/ScoreCasaLogo";

const LAST_UPDATE = "14 de maio de 2026";

function Section({ id, icon: Icon, title, children }: { id: string; icon: any; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#EEF2FF" }}>
          <Icon className="w-4 h-4" style={{ color: "#0D1B8C" }} />
        </div>
        <h2 className="text-xl font-bold" style={{ color: "#07113A" }}>{title}</h2>
      </div>
      <div className="text-gray-600 text-sm leading-relaxed space-y-3 pl-12">
        {children}
      </div>
    </section>
  );
}

export function Termos() {
  const sections = [
    { id: "aceitacao",      label: "1. Aceitação dos Termos" },
    { id: "servicos",       label: "2. Descrição dos Serviços" },
    { id: "cadastro",       label: "3. Cadastro e Conta" },
    { id: "uso",            label: "4. Uso Aceitável" },
    { id: "pagamentos",     label: "5. Pagamentos e Assinaturas" },
    { id: "propriedade",    label: "6. Propriedade Intelectual" },
    { id: "responsabilidade",label: "7. Limitação de Responsabilidade" },
    { id: "rescisao",       label: "8. Rescisão" },
    { id: "lei",            label: "9. Lei Aplicável" },
    { id: "contato",        label: "10. Contato" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#F4F6FB" }}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/login">
            <div className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0D1B8C] cursor-pointer transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </div>
          </Link>
          <ScoreCasaLogo variant="dark" size="sm" />
          <div className="text-xs text-gray-400">Atualizado em {LAST_UPDATE}</div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10 flex gap-10">
        {/* Sidebar index */}
        <aside className="hidden lg:block w-56 flex-shrink-0">
          <div className="sticky top-28">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Índice</div>
            <nav className="space-y-1">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block text-xs text-gray-500 hover:text-[#0D1B8C] py-1 leading-snug transition-colors"
                >
                  {s.label}
                </a>
              ))}
            </nav>
            <div className="mt-6 pt-5 border-t border-gray-200">
              <Link href="/privacidade">
                <div className="text-xs font-semibold cursor-pointer hover:underline" style={{ color: "#0D1B8C" }}>
                  Política de Privacidade →
                </div>
              </Link>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 space-y-10">
          {/* Hero */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "#EEF2FF" }}>
                <FileText className="w-6 h-6" style={{ color: "#0D1B8C" }} />
              </div>
              <div>
                <h1 className="text-3xl font-bold" style={{ color: "#07113A" }}>Termos de Uso</h1>
                <p className="text-gray-400 text-sm mt-1">Última atualização: {LAST_UPDATE}</p>
              </div>
            </div>
            <div className="p-4 rounded-xl text-sm leading-relaxed" style={{ background: "#EEF2FF", color: "#0D1B8C" }}>
              Leia atentamente este documento antes de utilizar a plataforma ScoreCasa. Ao se cadastrar, você concorda com todos os termos descritos abaixo.
            </div>
          </div>

          <Section id="aceitacao" icon={Scale} title="1. Aceitação dos Termos">
            <p>
              Ao acessar ou utilizar a plataforma ScoreCasa, você concorda em cumprir estes Termos de Uso e todas as leis e regulamentos aplicáveis. Se você não concordar com qualquer parte destes termos, não poderá utilizar nossos serviços.
            </p>
            <p>
              Estes termos aplicam-se a todos os usuários da plataforma, incluindo clientes, corretores de imóveis e correspondentes bancários.
            </p>
          </Section>

          <Section id="servicos" icon={Globe} title="2. Descrição dos Serviços">
            <p>
              A ScoreCasa é uma plataforma de inteligência de crédito imobiliário que oferece:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Análise preditiva de crédito imobiliário com uso de inteligência artificial</li>
              <li>GPS de Aprovação — simulação personalizada de chances de aprovação em múltiplos bancos</li>
              <li>Portal do cliente para acompanhamento do processo de financiamento</li>
              <li>Dashboard para corretores com gestão de leads e análise de portfólio</li>
              <li>Painel para correspondentes bancários com gestão de documentação e etapas do financiamento</li>
              <li>Marketplace de imóveis com dados completos de cada propriedade</li>
              <li>Sistema de avaliações entre clientes e profissionais</li>
            </ul>
            <p>
              As análises geradas pela plataforma têm caráter <strong>informativo e preditivo</strong>, não constituindo garantia de aprovação de crédito por qualquer instituição financeira.
            </p>
          </Section>

          <Section id="cadastro" icon={Users} title="3. Cadastro e Conta">
            <p>Para utilizar a plataforma, você deverá:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Ser maior de 18 anos ou ter capacidade civil plena</li>
              <li>Fornecer informações verídicas, precisas e completas no cadastro</li>
              <li>Manter seus dados atualizados</li>
              <li>Manter a confidencialidade de sua senha de acesso</li>
            </ul>
            <p>
              Você é responsável por todas as atividades realizadas em sua conta. Em caso de uso não autorizado, notifique imediatamente a ScoreCasa pelo e-mail <strong>seguranca@scorecasa.com.br</strong>.
            </p>
            <p>
              A ScoreCasa reserva-se o direito de suspender ou encerrar contas que violem estes termos ou que apresentem informações falsas.
            </p>
          </Section>

          <Section id="uso" icon={AlertTriangle} title="4. Uso Aceitável">
            <p>Ao utilizar a plataforma, você concorda em NÃO:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Fornecer dados financeiros falsos ou incompletos com a intenção de fraudar análises de crédito</li>
              <li>Utilizar a plataforma para fins ilegais ou que violem a legislação brasileira</li>
              <li>Tentar acessar sistemas ou dados de outros usuários sem autorização</li>
              <li>Realizar engenharia reversa, descompilação ou desobfuscação do software</li>
              <li>Transmitir vírus, malware ou código malicioso</li>
              <li>Sobrecarregar intencionalmente os servidores da plataforma</li>
              <li>Reproduzir, duplicar ou vender qualquer parte do serviço sem autorização expressa</li>
            </ul>
          </Section>

          <Section id="pagamentos" icon={Shield} title="5. Pagamentos e Assinaturas">
            <p>
              A ScoreCasa opera sob modelo de assinatura mensal. Os valores dos planos são:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Plano Individual:</strong> R$ 29,90/mês</li>
              <li><strong>Corretor até 50 leads:</strong> R$ 199,00/mês</li>
              <li><strong>Corretor até 200 leads:</strong> R$ 499,00/mês</li>
              <li><strong>Correspondente até 50 leads:</strong> R$ 299,00/mês</li>
              <li><strong>Correspondente até 200 leads:</strong> R$ 599,00/mês</li>
              <li><strong>Add-on Marketplace (até 10 imóveis):</strong> R$ 99,00/mês</li>
              <li><strong>Add-on Marketplace (até 50 imóveis):</strong> R$ 199,00/mês</li>
            </ul>
            <p>
              Os planos incluem um período de <strong>trial gratuito de 30 dias</strong>. Após este período, a cobrança mensal será iniciada automaticamente.
            </p>
            <p>
              O cancelamento pode ser solicitado a qualquer momento, com efeito ao final do período vigente. Não haverá reembolso por períodos parciais já cobrados.
            </p>
          </Section>

          <Section id="propriedade" icon={Lock} title="6. Propriedade Intelectual">
            <p>
              Todo o conteúdo da plataforma ScoreCasa — incluindo textos, gráficos, logos, ícones, imagens, clipes de áudio, downloads digitais e compilações de dados — é de propriedade exclusiva da ScoreCasa ou de seus fornecedores de conteúdo, protegido pelas leis de propriedade intelectual brasileiras e internacionais.
            </p>
            <p>
              Os algoritmos de análise de crédito, modelos preditivos e metodologia de scoring são propriedade intelectual da ScoreCasa e não podem ser reproduzidos ou utilizados sem autorização expressa por escrito.
            </p>
          </Section>

          <Section id="responsabilidade" icon={AlertTriangle} title="7. Limitação de Responsabilidade">
            <p>
              A ScoreCasa não se responsabiliza por:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Decisões de crédito tomadas por instituições financeiras com base nas análises da plataforma</li>
              <li>Perdas ou danos resultantes do uso ou impossibilidade de uso da plataforma</li>
              <li>Inexatidões em dados fornecidos por bureaus de crédito externos</li>
              <li>Interrupções temporárias de serviço por manutenção ou falhas técnicas</li>
              <li>Atos de terceiros, incluindo ataques cibernéticos de origem externa</li>
            </ul>
            <p>
              Em nenhuma circunstância a responsabilidade da ScoreCasa excederá o valor pago pelo usuário nos últimos 3 meses de assinatura.
            </p>
          </Section>

          <Section id="rescisao" icon={FileText} title="8. Rescisão">
            <p>
              A ScoreCasa pode encerrar ou suspender seu acesso imediatamente, sem aviso prévio, caso você viole estes Termos de Uso.
            </p>
            <p>
              Você pode encerrar sua conta a qualquer momento através das configurações da plataforma ou por solicitação via e-mail para <strong>contato@scorecasa.com.br</strong>.
            </p>
            <p>
              Após a rescisão, as obrigações legais e de pagamento que surgiram antes da data de encerramento permanecerão em vigor.
            </p>
          </Section>

          <Section id="lei" icon={Scale} title="9. Lei Aplicável e Foro">
            <p>
              Estes Termos serão regidos e interpretados de acordo com as leis da República Federativa do Brasil, em especial:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Lei nº 12.965/2014 — Marco Civil da Internet</li>
              <li>Lei nº 13.709/2018 — Lei Geral de Proteção de Dados (LGPD)</li>
              <li>Código de Defesa do Consumidor (Lei nº 8.078/1990)</li>
              <li>Lei nº 9.613/1998 — Prevenção à Lavagem de Dinheiro</li>
            </ul>
            <p>
              Fica eleito o foro da Comarca de São Paulo/SP para dirimir quaisquer controvérsias oriundas destes Termos.
            </p>
          </Section>

          <Section id="contato" icon={Users} title="10. Contato">
            <p>Para dúvidas, sugestões ou solicitações relacionadas a estes Termos de Uso:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>E-mail geral:</strong> contato@scorecasa.com.br</li>
              <li><strong>Privacidade e LGPD:</strong> privacidade@scorecasa.com.br</li>
              <li><strong>Segurança:</strong> seguranca@scorecasa.com.br</li>
              <li><strong>Endereço:</strong> Av. Paulista, 1.000 — São Paulo, SP — CEP 01310-100</li>
            </ul>
          </Section>

          {/* Footer */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
            <p className="text-xs text-gray-400 mb-3">
              Ao utilizar a plataforma ScoreCasa, você confirma que leu, compreendeu e concorda com estes Termos de Uso.
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/privacidade">
                <span className="text-xs font-semibold cursor-pointer hover:underline" style={{ color: "#0D1B8C" }}>
                  Política de Privacidade
                </span>
              </Link>
              <span className="text-gray-300">·</span>
              <Link href="/cadastro">
                <span className="text-xs font-semibold cursor-pointer hover:underline" style={{ color: "#10A65A" }}>
                  Criar conta
                </span>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
