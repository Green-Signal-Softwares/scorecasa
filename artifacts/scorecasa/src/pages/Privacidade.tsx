import { Link } from "wouter";
import { ArrowLeft, Shield, Eye, Lock, Database, UserCheck, Bell, Trash2, Globe, FileText } from "lucide-react";
import { ScoreCasaLogo } from "@/components/ScoreCasaLogo";

const LAST_UPDATE = "14 de maio de 2026";

function Section({ id, icon: Icon, title, children }: { id: string; icon: any; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#F0FDF4" }}>
          <Icon className="w-4 h-4" style={{ color: "#10A65A" }} />
        </div>
        <h2 className="text-xl font-bold" style={{ color: "#07113A" }}>{title}</h2>
      </div>
      <div className="text-gray-600 text-sm leading-relaxed space-y-3 pl-12">
        {children}
      </div>
    </section>
  );
}

function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl text-sm leading-relaxed" style={{ background: "#F0FDF4", color: "#065F46", borderLeft: "3px solid #10A65A" }}>
      {children}
    </div>
  );
}

export function Privacidade() {
  const sections = [
    { id: "controlador",  label: "1. Quem é o Controlador" },
    { id: "coleta",       label: "2. Dados que Coletamos" },
    { id: "finalidade",   label: "3. Finalidade do Tratamento" },
    { id: "base",         label: "4. Base Legal (LGPD)" },
    { id: "compartilhamento", label: "5. Compartilhamento" },
    { id: "seguranca",    label: "6. Segurança dos Dados" },
    { id: "retencao",     label: "7. Retenção e Exclusão" },
    { id: "direitos",     label: "8. Seus Direitos" },
    { id: "cookies",      label: "9. Cookies" },
    { id: "menores",      label: "10. Menores de Idade" },
    { id: "alteracoes",   label: "11. Alterações nesta Política" },
    { id: "contato",      label: "12. Encarregado (DPO)" },
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
        {/* Sidebar */}
        <aside className="hidden lg:block w-56 flex-shrink-0">
          <div className="sticky top-28">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Índice</div>
            <nav className="space-y-1">
              {sections.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="block text-xs text-gray-500 hover:text-[#10A65A] py-1 leading-snug transition-colors">
                  {s.label}
                </a>
              ))}
            </nav>
            <div className="mt-6 pt-5 border-t border-gray-200">
              <Link href="/termos">
                <div className="text-xs font-semibold cursor-pointer hover:underline" style={{ color: "#0D1B8C" }}>
                  Termos de Uso →
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
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "#F0FDF4" }}>
                <Shield className="w-6 h-6" style={{ color: "#10A65A" }} />
              </div>
              <div>
                <h1 className="text-3xl font-bold" style={{ color: "#07113A" }}>Política de Privacidade</h1>
                <p className="text-gray-400 text-sm mt-1">Última atualização: {LAST_UPDATE} · Em conformidade com a LGPD</p>
              </div>
            </div>
            <Highlight>
              A ScoreCasa leva sua privacidade a sério. Esta política descreve como coletamos, utilizamos, armazenamos e protegemos seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
            </Highlight>
          </div>

          <Section id="controlador" icon={UserCheck} title="1. Quem é o Controlador dos Dados">
            <p>
              O <strong>controlador</strong> dos seus dados pessoais é a <strong>ScoreCasa Tecnologia Financeira Ltda.</strong>, empresa brasileira inscrita no CNPJ sob o nº XX.XXX.XXX/0001-XX, com sede na Av. Paulista, 1.000, São Paulo — SP, CEP 01310-100.
            </p>
            <p>
              Para qualquer questão relativa ao tratamento dos seus dados, entre em contato com nosso Encarregado de Dados (DPO) pelo e-mail <strong>privacidade@scorecasa.com.br</strong>.
            </p>
          </Section>

          <Section id="coleta" icon={Database} title="2. Dados que Coletamos">
            <p><strong>Dados fornecidos diretamente por você:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Nome completo e CPF (para identificação e análise de crédito)</li>
              <li>E-mail e telefone (para comunicações e notificações)</li>
              <li>Renda mensal e valor do imóvel pretendido (para cálculo de score)</li>
              <li>Senha (armazenada com hash seguro — nunca em texto claro)</li>
              <li>Histórico de consultas de crédito realizadas na plataforma</li>
            </ul>
            <p><strong>Dados coletados automaticamente:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Endereço IP e localização aproximada</li>
              <li>Tipo de dispositivo, navegador e sistema operacional</li>
              <li>Páginas acessadas, tempo de navegação e cliques (dados de uso)</li>
              <li>Cookies e tecnologias similares (veja seção 9)</li>
            </ul>
            <p><strong>Dados de terceiros (bureaus de crédito):</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Score de crédito de bureaus como Serasa e SPC (mediante seu consentimento expresso)</li>
              <li>Dados de inadimplência e histórico financeiro disponíveis publicamente</li>
            </ul>
          </Section>

          <Section id="finalidade" icon={Eye} title="3. Finalidade do Tratamento">
            <p>Utilizamos seus dados pessoais para:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Prestação do serviço:</strong> calcular seu score de crédito imobiliário e apresentar sua análise personalizada</li>
              <li><strong>Simulações bancárias:</strong> verificar elegibilidade em programas habitacionais (MCMV, SBPE, FGTS)</li>
              <li><strong>Comunicação:</strong> enviar notificações sobre o andamento de processos, alertas de prazo e novidades da plataforma</li>
              <li><strong>Melhoria dos algoritmos:</strong> aprimorar os modelos preditivos de forma anonimizada e agregada</li>
              <li><strong>Prevenção de fraudes:</strong> verificar a autenticidade das informações fornecidas</li>
              <li><strong>Cumprimento legal:</strong> atender exigências regulatórias do Banco Central do Brasil e demais órgãos</li>
              <li><strong>Cobrança:</strong> processar pagamentos de assinaturas e emitir cobranças</li>
            </ul>
            <Highlight>
              Seus dados nunca serão vendidos a terceiros para fins de marketing não relacionado ao crédito imobiliário.
            </Highlight>
          </Section>

          <Section id="base" icon={FileText} title="4. Base Legal (LGPD — Art. 7º)">
            <p>O tratamento dos seus dados é realizado com base nas seguintes hipóteses legais:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Consentimento (Art. 7º, I):</strong> consultas a bureaus de crédito externos, comunicações de marketing</li>
              <li><strong>Execução de contrato (Art. 7º, V):</strong> dados necessários para prestação do serviço contratado</li>
              <li><strong>Cumprimento de obrigação legal (Art. 7º, II):</strong> dados exigidos por normas do Banco Central e COAF</li>
              <li><strong>Legítimo interesse (Art. 7º, IX):</strong> segurança da plataforma, prevenção de fraudes e melhoria do serviço</li>
              <li><strong>Proteção ao crédito (Art. 7º, X):</strong> análise de perfil creditício do titular</li>
            </ul>
          </Section>

          <Section id="compartilhamento" icon={Globe} title="5. Compartilhamento de Dados">
            <p>Podemos compartilhar seus dados com:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Corretores e correspondentes:</strong> apenas dados necessários para o processo de financiamento, com seu consentimento</li>
              <li><strong>Instituições financeiras parceiras:</strong> para análise e pré-aprovação de crédito, mediante sua solicitação explícita</li>
              <li><strong>Bureaus de crédito:</strong> Serasa Experian, SPC Brasil — para consulta de score (com consentimento)</li>
              <li><strong>Provedores de serviços técnicos:</strong> hospedagem em nuvem, processamento de pagamentos — sob contratos de confidencialidade</li>
              <li><strong>Autoridades competentes:</strong> quando exigido por lei, ordem judicial ou regulamentação do Banco Central</li>
            </ul>
            <p>
              Não compartilhamos seus dados com empresas de publicidade, listas de marketing ou corretoras sem relação com crédito imobiliário.
            </p>
          </Section>

          <Section id="seguranca" icon={Lock} title="6. Segurança dos Dados">
            <Highlight>
              A segurança dos seus dados é nossa prioridade. Implementamos medidas técnicas e organizacionais robustas para proteger suas informações.
            </Highlight>
            <p>Nossas práticas de segurança incluem:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Criptografia em trânsito:</strong> todas as comunicações utilizam TLS 1.3 (HTTPS)</li>
              <li><strong>Criptografia em repouso:</strong> dados sensíveis armazenados com AES-256</li>
              <li><strong>Senhas:</strong> armazenadas exclusivamente com hash bcrypt (nunca em texto claro)</li>
              <li><strong>Controle de acesso:</strong> princípio do menor privilégio — cada colaborador acessa apenas o necessário</li>
              <li><strong>Autenticação segura:</strong> sessões protegidas com cookies assinados e HTTPOnly</li>
              <li><strong>Monitoramento:</strong> detecção de anomalias e tentativas de acesso não autorizado em tempo real</li>
              <li><strong>Backups:</strong> cópias de segurança criptografadas com retenção controlada</li>
              <li><strong>Auditoria:</strong> logs de todas as operações sensíveis com rastreamento por usuário</li>
            </ul>
            <p>
              Em caso de incidente de segurança que afete seus dados, notificaremos você e a Autoridade Nacional de Proteção de Dados (ANPD) no prazo previsto pela LGPD.
            </p>
          </Section>

          <Section id="retencao" icon={Trash2} title="7. Retenção e Exclusão de Dados">
            <p>Mantemos seus dados pelo tempo necessário para:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Dados de conta ativa:</strong> enquanto sua conta estiver ativa na plataforma</li>
              <li><strong>Dados financeiros e de análise:</strong> 5 anos após o encerramento da conta (obrigação legal — normas do COAF)</li>
              <li><strong>Logs de segurança:</strong> 12 meses</li>
              <li><strong>Dados de marketing (com consentimento):</strong> até a revogação do consentimento</li>
            </ul>
            <p>
              Para solicitar a exclusão dos seus dados, acesse as configurações da sua conta ou envie e-mail para <strong>privacidade@scorecasa.com.br</strong>. Atenderemos em até 15 dias úteis, respeitando as obrigações legais de retenção.
            </p>
          </Section>

          <Section id="direitos" icon={UserCheck} title="8. Seus Direitos (LGPD — Art. 18)">
            <p>Você tem os seguintes direitos em relação aos seus dados pessoais:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Confirmação e acesso:</strong> saber se tratamos seus dados e acessá-los</li>
              <li><strong>Correção:</strong> solicitar a correção de dados incompletos, inexatos ou desatualizados</li>
              <li><strong>Anonimização, bloqueio ou eliminação:</strong> de dados desnecessários ou tratados em desconformidade</li>
              <li><strong>Portabilidade:</strong> receber seus dados em formato estruturado e interoperável</li>
              <li><strong>Eliminação:</strong> excluir dados tratados com base no consentimento</li>
              <li><strong>Informação sobre compartilhamento:</strong> saber com quais entidades públicas e privadas compartilhamos seus dados</li>
              <li><strong>Revogação do consentimento:</strong> revogar consentimentos dados anteriormente</li>
              <li><strong>Oposição:</strong> se opor a tratamentos realizados com base em legítimo interesse</li>
            </ul>
            <p>
              Para exercer seus direitos, entre em contato pelo e-mail <strong>privacidade@scorecasa.com.br</strong> ou pelo formulário disponível em sua área de configurações. Responderemos em até 15 dias úteis.
            </p>
          </Section>

          <Section id="cookies" icon={Shield} title="9. Cookies e Tecnologias Similares">
            <p>Utilizamos cookies para:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Cookies essenciais:</strong> manter sua sessão autenticada e garantir o funcionamento da plataforma (não podem ser desativados)</li>
              <li><strong>Cookies de desempenho:</strong> monitorar erros e tempo de carregamento para melhorar a experiência</li>
              <li><strong>Cookies de preferências:</strong> lembrar suas configurações de idioma e interface</li>
            </ul>
            <p>
              Não utilizamos cookies de rastreamento para publicidade comportamental. Você pode gerenciar cookies nas configurações do seu navegador. A desativação de cookies essenciais pode impedir o funcionamento correto da plataforma.
            </p>
          </Section>

          <Section id="menores" icon={UserCheck} title="10. Menores de Idade">
            <p>
              A plataforma ScoreCasa é destinada exclusivamente a pessoas maiores de 18 anos com plena capacidade civil. Não coletamos intencionalmente dados de menores de idade.
            </p>
            <p>
              Caso identifiquemos que coletamos dados de um menor inadvertidamente, excluiremos tais informações imediatamente. Se você acredita que coletamos dados de um menor, informe-nos pelo e-mail <strong>privacidade@scorecasa.com.br</strong>.
            </p>
          </Section>

          <Section id="alteracoes" icon={Bell} title="11. Alterações nesta Política">
            <p>
              Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos você por e-mail ou por aviso na plataforma com pelo menos 30 dias de antecedência em caso de alterações materiais.
            </p>
            <p>
              O uso continuado da plataforma após as alterações implica na aceitação da nova política. Recomendamos revisar esta política periodicamente.
            </p>
          </Section>

          <Section id="contato" icon={UserCheck} title="12. Encarregado de Dados (DPO)">
            <p>Nosso Encarregado de Proteção de Dados (Data Protection Officer) está disponível para atender suas solicitações:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>E-mail do DPO:</strong> privacidade@scorecasa.com.br</li>
              <li><strong>E-mail de segurança:</strong> seguranca@scorecasa.com.br</li>
              <li><strong>Telefone:</strong> (11) 3000-0000 (seg–sex, 9h–18h)</li>
              <li><strong>Prazo de resposta:</strong> até 15 dias úteis</li>
            </ul>
            <p>
              Você também pode registrar reclamações diretamente à <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong> pelo site <strong>www.gov.br/anpd</strong>.
            </p>
          </Section>

          {/* Footer */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
            <p className="text-xs text-gray-400 mb-3">
              Esta política é válida a partir de {LAST_UPDATE} e substitui todas as versões anteriores.
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/termos">
                <span className="text-xs font-semibold cursor-pointer hover:underline" style={{ color: "#0D1B8C" }}>
                  Termos de Uso
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
