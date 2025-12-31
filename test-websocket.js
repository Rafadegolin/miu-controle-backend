/**
 * Script de teste do WebSocket
 * Execute: node test-websocket.js
 * 
 * Pré-requisitos:
 * 1. Servidor rodando (npm run start:dev)
 * 2. Ter um usuário cadastrado
 * 3. npm install socket.io-client axios (se não estiver instalado)
 */

const io = require('socket.io-client');
const axios = require('axios');
const readline = require('readline');

const API_URL = 'http://localhost:3001';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('🧪 Teste de WebSocket - Miu Controle\n');

  try {
    // 1. Fazer login
    console.log('📝 Etapa 1: Login');
    const email = await question('Email: ');
    const password = await question('Senha: ');

    console.log('\n🔐 Fazendo login...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email,
      password,
    });

    const token = loginResponse.data.accessToken;
    const user = loginResponse.data.user;
    console.log(`✅ Login bem-sucedido! Bem-vindo, ${user.fullName}\n`);

    // 2. Conectar ao WebSocket
    console.log('🔌 Etapa 2: Conectando ao WebSocket...');
    const socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    // Listeners de conexão
    socket.on('connect', () => {
      console.log(`✅ WebSocket conectado! ID: ${socket.id}\n`);
      console.log('👂 Aguardando eventos em tempo real...\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Erro na conexão:', error.message);
      process.exit(1);
    });

    socket.on('disconnect', (reason) => {
      console.log(`\n❌ Desconectado: ${reason}`);
      process.exit(0);
    });

    socket.on('connected', (data) => {
      console.log('📨 Mensagem do servidor:', data);
    });

    // 3. Listeners de eventos
    socket.on('transaction.created', (data) => {
      console.log('\n🆕 EVENTO: transaction.created');
      console.log('📊 Dados:', JSON.stringify(data, null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });

    socket.on('transaction.updated', (data) => {
      console.log('\n✏️  EVENTO: transaction.updated');
      console.log('📊 Dados:', JSON.stringify(data, null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });

    socket.on('transaction.deleted', (data) => {
      console.log('\n🗑️  EVENTO: transaction.deleted');
      console.log('📊 Dados:', JSON.stringify(data, null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });

    socket.on('balance.updated', (data) => {
      console.log('\n💰 EVENTO: balance.updated');
      console.log('📊 Dados:', JSON.stringify(data, null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });

    socket.on('notification.new', (data) => {
      console.log('\n🔔 EVENTO: notification.new');
      console.log('📊 Dados:', JSON.stringify(data, null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });

    socket.on('budget.alert', (data) => {
      console.log('\n⚠️  EVENTO: budget.alert');
      console.log('📊 Dados:', JSON.stringify(data, null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });

    socket.on('goal.milestone', (data) => {
      console.log('\n🎯 EVENTO: goal.milestone');
      console.log('📊 Dados:', JSON.stringify(data, null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });

    // 4. Menu interativo
    console.log('\n📋 Menu de Testes:');
    console.log('1 - Criar transação de teste');
    console.log('2 - Ver status do WebSocket');
    console.log('3 - Sair\n');

    while (true) {
      const choice = await question('Escolha uma opção: ');

      if (choice === '1') {
        // Criar transação de teste
        console.log('\n💸 Criando transação de teste...');
        
        try {
          // Buscar primeira conta do usuário
          const accountsResponse = await axios.get(`${API_URL}/accounts`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (!accountsResponse.data || accountsResponse.data.length === 0) {
            console.log('❌ Você não tem contas cadastradas. Crie uma conta primeiro.');
            continue;
          }

          const accountId = accountsResponse.data[0].id;

          // Criar transação
          const transactionData = {
            accountId,
            type: 'EXPENSE',
            amount: Math.random() * 100,
            description: `Teste WebSocket ${new Date().toLocaleTimeString()}`,
            date: new Date().toISOString(),
          };

          await axios.post(`${API_URL}/transactions`, transactionData, {
            headers: { Authorization: `Bearer ${token}` }
          });

          console.log('✅ Transação criada! Aguarde o evento...\n');
        } catch (error) {
          console.error('❌ Erro ao criar transação:', error.response?.data || error.message);
        }

      } else if (choice === '2') {
        // Ver status do WebSocket
        console.log('\n📊 Verificando status do WebSocket...');
        
        try {
          const statusResponse = await axios.get(`${API_URL}/websocket/status`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          console.log('\n📈 Status:');
          console.log(JSON.stringify(statusResponse.data, null, 2));
          console.log();
        } catch (error) {
          console.error('❌ Erro ao obter status:', error.response?.data || error.message);
        }

      } else if (choice === '3') {
        console.log('\n👋 Encerrando...');
        socket.close();
        rl.close();
        process.exit(0);
      } else {
        console.log('❌ Opção inválida\n');
      }
    }

  } catch (error) {
    console.error('\n❌ Erro:', error.response?.data || error.message);
    rl.close();
    process.exit(1);
  }
}

main();
