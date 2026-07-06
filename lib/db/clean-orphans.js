import pg from 'pg';

const { Client } = pg;

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/scorecasa';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log('Iniciando auditoria de leads órfãos...');

    // 1. Obter todos os corretores ativos para reatribuição se necessário
    const brokersRes = await client.query('SELECT id, name, correspondent_id FROM brokers WHERE status = $1 ORDER BY id LIMIT 1', ['active']);
    const defaultBroker = brokersRes.rows[0];
    if (defaultBroker) {
      console.log(`Corretor padrão para reatribuição: ${defaultBroker.name} (ID: ${defaultBroker.id})`);
    } else {
      console.log('Aviso: Nenhum corretor ativo encontrado no banco.');
    }

    // 2. Obter todos os leads cadastrados
    const leadsRes = await client.query('SELECT id, name, email, broker_id, correspondent_id, linked_correspondent_id FROM leads');
    const leads = leadsRes.rows;
    console.log(`Total de leads encontrados no banco: ${leads.length}`);

    let updatedCount = 0;
    let deletedCount = 0;

    for (const lead of leads) {
      // Verificar se o broker_id é inválido (não existe na tabela brokers)
      let brokerExists = false;
      if (lead.broker_id) {
        const brokerCheck = await client.query('SELECT id FROM brokers WHERE id = $1', [lead.broker_id]);
        brokerExists = brokerCheck.rows.length > 0;
      }

      const isOrphaned = !lead.broker_id || !brokerExists;

      if (isOrphaned) {
        console.log(`\nLead órfão detectado: ID ${lead.id} - ${lead.name} (${lead.email})`);
        if (lead.broker_id && !brokerExists) {
          console.log(` -> Razão: Aponta para um broker_id inexistente (${lead.broker_id})`);
        } else {
          console.log(` -> Razão: Sem corretor vinculado (broker_id é null)`);
        }

        // Verificar se existe um usuário correspondente do tipo client
        const userRes = await client.query('SELECT id, name, role FROM users WHERE LOWER(email) = LOWER($1) OR lead_id = $2', [lead.email, lead.id]);
        const user = userRes.rows[0];

        if (user) {
          console.log(` -> Usuário cliente encontrado: ${user.name} (ID: ${user.id}, Role: ${user.role})`);
          if (defaultBroker) {
            // Reatribuir o lead ao corretor padrão
            const updates = [defaultBroker.id];
            let queryStr = 'UPDATE leads SET broker_id = $1';
            let paramIdx = 2;

            if (defaultBroker.correspondent_id) {
              queryStr += `, correspondent_id = $${paramIdx}, linked_correspondent_id = $${paramIdx}`;
              updates.push(defaultBroker.correspondent_id);
              paramIdx++;
            } else {
              queryStr += ', correspondent_id = NULL, linked_correspondent_id = NULL';
            }

            queryStr += ` WHERE id = $${paramIdx}`;
            updates.push(lead.id);

            await client.query(queryStr, updates);
            console.log(` -> REATRIBUÍDO com sucesso para o corretor ${defaultBroker.name}`);
            updatedCount++;

            // Incrementar o total de leads do corretor
            await client.query('UPDATE brokers SET total_leads = total_leads + 1 WHERE id = $1', [defaultBroker.id]);
          } else {
            console.log(' -> Não foi possível reatribuir: nenhum corretor padrão disponível.');
          }
        } else {
          // Sem usuário vinculado: trata-se de um registro legado/teste órfão
          console.log(` -> Nenhum usuário cliente vinculado encontrado.`);
          await client.query('DELETE FROM leads WHERE id = $1', [lead.id]);
          console.log(` -> APAGADO com sucesso (registro de teste legado).`);
          deletedCount++;
        }
      }
    }

    console.log('\n========================================');
    console.log(`Auditoria concluída!`);
    console.log(`Leads reatribuídos: ${updatedCount}`);
    console.log(`Leads excluídos: ${deletedCount}`);
    console.log('========================================');

  } catch (error) {
    console.error('Erro na auditoria de leads órfãos:', error);
  } finally {
    await client.end();
  }
}

run();
