import pg from 'pg';
import crypto from 'crypto';

const { Client } = pg;

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/scorecasa';

const DEFAULT_PLANS = [
  {
    id: "free",
    label: "Free",
    role: "client",
    group: "individual",
    price_monthly: 0,
    price_yearly: 0,
    highlight: false,
    lead_limit: null,
    enterprise: false,
    color: "#10A65A",
    bg_light: "#F0FDF4",
    description: "Entrada gratuita ao ecossistema ScoreCasa.",
    features: [
      "Simulação básica de financiamento",
      "Score básico ScoreCasa",
      "Até 3 análises por mês",
      "Marketplace limitado",
    ],
    sort_order: 1,
  },
  {
    id: "individual",
    label: "Individual",
    role: "client",
    group: "individual",
    price_monthly: 29.90,
    price_yearly: 299.00,
    highlight: true,
    lead_limit: null,
    enterprise: false,
    color: "#10A65A",
    bg_light: "#F0FDF4",
    description: "IA completa, Open Finance e marketplace ilimitado.",
    features: [
      "IA completa de previsão de aprovação",
      "Monitoramento contínuo do score",
      "Imóveis ilimitados",
      "Open Finance integrado",
    ],
    sort_order: 2,
  },
  {
    id: "plus",
    label: "Plus",
    role: "client",
    group: "individual",
    price_monthly: 59.90,
    price_yearly: 599.00,
    highlight: false,
    lead_limit: null,
    enterprise: false,
    color: "#10A65A",
    bg_light: "#F0FDF4",
    description: "Personal financeiro imobiliário — para quem quer realmente aprovar.",
    features: [
      "Tudo do Individual",
      "Consultoria com IA dedicada",
      "Plano de aprovação personalizado",
      "Alertas de crédito em tempo real",
    ],
    sort_order: 3,
  },
  {
    id: "corretor",
    label: "Corretor",
    role: "broker",
    group: "corretor",
    price_monthly: 297.00,
    price_yearly: 2970.00,
    highlight: true,
    lead_limit: 15,
    enterprise: false,
    color: "#0D1B8C",
    bg_light: "#EEF2FF",
    description: "Gestão profissional de leads e comparativo entre bancos.",
    features: [
      "Análise de crédito avançada",
      "Comparativo de 8 bancos",
      "Ranking de aprovações",
      "Exportação de relatórios PDF",
    ],
    sort_order: 1,
  },
  {
    id: "imobiliaria",
    label: "Imobiliária",
    role: "broker",
    group: "corretor",
    price_monthly: 697.00,
    price_yearly: 6970.00,
    highlight: false,
    lead_limit: 50,
    enterprise: false,
    color: "#0D1B8C",
    bg_light: "#EEF2FF",
    description: "Painel multi-corretores e gestão de equipe completa.",
    features: [
      "Tudo do Corretor",
      "Painel multi-corretores",
      "Vitrine de imóveis incluída",
      "Suporte prioritário",
    ],
    sort_order: 2,
  },
  {
    id: "enterprise",
    label: "Enterprise",
    role: "broker",
    group: "corretor",
    price_monthly: 1497.00,
    price_yearly: 14970.00,
    highlight: false,
    lead_limit: 200,
    enterprise: false,
    color: "#0D1B8C",
    bg_light: "#EEF2FF",
    description: "Operação em escala com SLA dedicado.",
    features: [
      "Tudo da Imobiliária",
      "Gerente de conta dedicado",
      "API e integração personalizada",
      "SLA dedicado",
    ],
    sort_order: 3,
  },
  {
    id: "correspondente_individual",
    label: "Correspondente Individual",
    role: "correspondent",
    group: "correspondent",
    price_monthly: 297.00,
    price_yearly: 2970.00,
    highlight: false,
    lead_limit: null,
    enterprise: false,
    color: "#7C3AED",
    bg_light: "#F5F3FF",
    description: "Para o correspondente autônomo que opera sozinho.",
    features: [
      "Painel individual de processos",
      "Até 30 operações ativas por mês",
      "Esteira CCA padrão: aprovação → contrato",
      "Gestão de documentação bancária",
      "Templates de contrato Caixa",
    ],
    sort_order: 1,
  },
  {
    id: "bank_connect",
    label: "Correspondente Bank Connect",
    role: "correspondent",
    group: "correspondent",
    price_monthly: 299.00,
    price_yearly: 2990.00,
    highlight: true,
    lead_limit: null,
    enterprise: false,
    color: "#7C3AED",
    bg_light: "#F5F3FF",
    description: "Plano padrão para correspondentes bancários operarem a esteira de processos.",
    features: ["Gestão completa de esteira de processos", "Vínculo com rede de corretores", "Integração SIRIC/Caixa"],
    sort_order: 2,
  },
  {
    id: "correspondent_200",
    label: "Correspondente Pro",
    role: "correspondent",
    group: "correspondent",
    price_monthly: 599.00,
    price_yearly: 5990.00,
    highlight: false,
    lead_limit: null,
    enterprise: false,
    color: "#7C3AED",
    bg_light: "#F5F3FF",
    description: "Para correspondentes bancários de grande porte e assessorias.",
    features: ["Processos ilimitados", "Multi-operadores", "Gestão de equipe de correspondentes"],
    sort_order: 3,
  },
];

async function seed() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log('🚀 Iniciando Seeder do ScoreCasa...\n');

    // 1. Inserir / Atualizar Planos Padrão
    console.log('📦 Semeando tabela de planos (plans)...');
    let insertedPlans = 0;
    for (const plan of DEFAULT_PLANS) {
      const query = `
        INSERT INTO plans (id, label, role, "group", price_monthly, price_yearly, highlight, lead_limit, enterprise, color, bg_light, description, features, is_active, is_legacy, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, false, $14)
        ON CONFLICT (id) DO UPDATE SET
          label = EXCLUDED.label,
          role = EXCLUDED.role,
          "group" = EXCLUDED."group",
          price_monthly = EXCLUDED.price_monthly,
          price_yearly = EXCLUDED.price_yearly,
          highlight = EXCLUDED.highlight,
          lead_limit = EXCLUDED.lead_limit,
          description = EXCLUDED.description,
          features = EXCLUDED.features;
      `;
      await client.query(query, [
        plan.id, plan.label, plan.role, plan.group, plan.price_monthly,
        plan.price_yearly, plan.highlight, plan.lead_limit, plan.enterprise, plan.color,
        plan.bg_light, plan.description, plan.features, plan.sort_order
      ]);
      insertedPlans++;
    }
    console.log(` ✅ ${insertedPlans} planos inseridos/atualizados com sucesso.`);

    // 2. Verificar/Inserir Usuário Admin Padrão
    console.log('\n👤 Verificando usuário administrador...');
    const adminEmail = 'admin@scorecasa.com.br';
    const adminPassword = 'admin123';
    const adminPasswordHash = crypto.createHash("sha256").update(adminPassword + "scorecasa_salt").digest("hex");

    const userRes = await client.query(`
      INSERT INTO users (name, email, role, password_hash)
      VALUES ('Administrador ScoreCasa', $1, 'admin', $2)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin'
      RETURNING id;
    `, [adminEmail, adminPasswordHash]);

    console.log(` ✅ Usuário Administrador configurado (ID: ${userRes.rows[0].id}, Email: ${adminEmail}, Senha: ${adminPassword})`);

    console.log('\n========================================');
    console.log('🎉 Seeder concluído com sucesso!');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Erro durante a execução da seeder:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
