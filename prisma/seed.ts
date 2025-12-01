import {
  PrismaClient,
  CategoryType,
  AccountType,
  TransactionType,
  BudgetPeriod,
  GoalStatus,
  RecurrenceFrequency,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed COMPLETO do banco de dados...\n');

  // ==================== MOEDAS ====================
  console.log('💱 Criando moedas...');

  const currencies = [
    { code: 'BRL', name: 'Real Brasileiro', symbol: 'R$' },
    { code: 'USD', name: 'Dólar Americano', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'Libra Esterlina', symbol: '£' },
    { code: 'JPY', name: 'Iene Japonês', symbol: '¥' },
    { code: 'CAD', name: 'Dólar Canadense', symbol: 'C$' },
    { code: 'AUD', name: 'Dólar Australiano', symbol: 'A$' },
    { code: 'CHF', name: 'Franco Suíço', symbol: 'CHF' },
    { code: 'CNY', name: 'Yuan Chinês', symbol: '¥' },
    { code: 'ARS', name: 'Peso Argentino', symbol: '$' },
  ];

  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: {},
      create: currency,
    });
  }
  console.log(`✅ ${currencies.length} moedas criadas!\n`);

  // ==================== TAXAS DE CÂMBIO ====================
  console.log('💱 Criando taxas de câmbio...');

  const usdCurrency = await prisma.currency.findUnique({
    where: { code: 'USD' },
  });
  const brlCurrency = await prisma.currency.findUnique({
    where: { code: 'BRL' },
  });
  const eurCurrency = await prisma.currency.findUnique({
    where: { code: 'EUR' },
  });

  if (usdCurrency && brlCurrency) {
    await prisma.exchangeRate.create({
      data: {
        fromCurrencyId: usdCurrency.id,
        toCurrencyId: brlCurrency.id,
        rate: 5.25,
        source: 'MANUAL',
      },
    });
    console.log('✅ Taxa USD -> BRL criada!');
  }

  if (eurCurrency && brlCurrency) {
    await prisma.exchangeRate.create({
      data: {
        fromCurrencyId: eurCurrency.id,
        toCurrencyId: brlCurrency.id,
        rate: 5.8,
        source: 'MANUAL',
      },
    });
    console.log('✅ Taxa EUR -> BRL criada!\n');
  }

  // ==================== CATEGORIAS ====================
  console.log('📁 Criando categorias...');

  await prisma.category.deleteMany({ where: { isSystem: true } });

  const expenseCategories = [
    {
      id: 'cat-alimentacao',
      name: 'Alimentação',
      type: CategoryType.EXPENSE,
      color: '#EF4444',
      icon: '🍽️',
    },
    {
      id: 'cat-transporte',
      name: 'Transporte',
      type: CategoryType.EXPENSE,
      color: '#F59E0B',
      icon: '🚗',
    },
    {
      id: 'cat-moradia',
      name: 'Moradia',
      type: CategoryType.EXPENSE,
      color: '#8B5CF6',
      icon: '🏠',
    },
    {
      id: 'cat-saude',
      name: 'Saúde',
      type: CategoryType.EXPENSE,
      color: '#EC4899',
      icon: '🏥',
    },
    {
      id: 'cat-educacao',
      name: 'Educação',
      type: CategoryType.EXPENSE,
      color: '#3B82F6',
      icon: '📚',
    },
    {
      id: 'cat-lazer',
      name: 'Lazer',
      type: CategoryType.EXPENSE,
      color: '#10B981',
      icon: '🎮',
    },
    {
      id: 'cat-compras',
      name: 'Compras',
      type: CategoryType.EXPENSE,
      color: '#6366F1',
      icon: '🛍️',
    },
    {
      id: 'cat-contas',
      name: 'Contas Fixas',
      type: CategoryType.EXPENSE,
      color: '#14B8A6',
      icon: '📄',
    },
    {
      id: 'cat-investimentos',
      name: 'Investimentos',
      type: CategoryType.EXPENSE,
      color: '#84CC16',
      icon: '📈',
    },
    {
      id: 'cat-pets',
      name: 'Pets',
      type: CategoryType.EXPENSE,
      color: '#F97316',
      icon: '🐾',
    },
    {
      id: 'cat-assinaturas',
      name: 'Assinaturas',
      type: CategoryType.EXPENSE,
      color: '#A855F7',
      icon: '📱',
    },
    {
      id: 'cat-outros-despesas',
      name: 'Outras Despesas',
      type: CategoryType.EXPENSE,
      color: '#64748B',
      icon: '💸',
    },
  ];

  const incomeCategories = [
    {
      id: 'cat-salario',
      name: 'Salário',
      type: CategoryType.INCOME,
      color: '#10B981',
      icon: '💰',
    },
    {
      id: 'cat-freelance',
      name: 'Freelance',
      type: CategoryType.INCOME,
      color: '#06B6D4',
      icon: '💻',
    },
    {
      id: 'cat-investimentos-receita',
      name: 'Rendimentos',
      type: CategoryType.INCOME,
      color: '#84CC16',
      icon: '📊',
    },
    {
      id: 'cat-vendas',
      name: 'Vendas',
      type: CategoryType.INCOME,
      color: '#F59E0B',
      icon: '🏷️',
    },
    {
      id: 'cat-presente',
      name: 'Presentes',
      type: CategoryType.INCOME,
      color: '#EC4899',
      icon: '🎁',
    },
    {
      id: 'cat-reembolso',
      name: 'Reembolsos',
      type: CategoryType.INCOME,
      color: '#8B5CF6',
      icon: '💳',
    },
    {
      id: 'cat-outros-receitas',
      name: 'Outras Receitas',
      type: CategoryType.INCOME,
      color: '#64748B',
      icon: '💵',
    },
  ];

  const allCategories = [...expenseCategories, ...incomeCategories];

  for (const category of allCategories) {
    await prisma.category.create({
      data: {
        id: category.id,
        name: category.name,
        type: category.type,
        color: category.color,
        icon: category.icon,
        isSystem: true,
        userId: null,
      },
    });
  }
  console.log(`✅ ${allCategories.length} categorias criadas!\n`);

  // ==================== USUÁRIO DE TESTE ====================
  console.log('👤 Criando usuário de teste...');

  const passwordHash = await bcrypt.hash('senha123', 10);

  const testUser = await prisma.user.upsert({
    where: { email: 'teste@miucontrole.com' },
    update: {},
    create: {
      email: 'teste@miucontrole.com',
      passwordHash,
      fullName: 'Usuário de Teste',
      phone: '11987654321',
      emailVerified: true,
      preferredCurrency: 'BRL',
    },
  });

  console.log(
    `✅ Usuário criado! Email: teste@miucontrole.com | Senha: senha123\n`,
  );

  // ==================== CONTAS BANCÁRIAS ====================
  console.log('🏦 Criando contas bancárias...');

  const nubank = await prisma.account.create({
    data: {
      userId: testUser.id,
      name: 'Nubank',
      type: AccountType.CHECKING,
      initialBalance: 5000,
      currentBalance: 5000,
      currency: 'BRL',
      color: '#820AD1',
      icon: '💳',
    },
  });

  const contaCorrente = await prisma.account.create({
    data: {
      userId: testUser.id,
      name: 'Conta Corrente BB',
      type: AccountType.CHECKING,
      initialBalance: 3000,
      currentBalance: 3000,
      currency: 'BRL',
      color: '#FFDD00',
      icon: '🏦',
    },
  });

  const poupanca = await prisma.account.create({
    data: {
      userId: testUser.id,
      name: 'Poupança',
      type: AccountType.SAVINGS,
      initialBalance: 10000,
      currentBalance: 10000,
      currency: 'BRL',
      color: '#10B981',
      icon: '🐷',
    },
  });

  const contaUSD = await prisma.account.create({
    data: {
      userId: testUser.id,
      name: 'Conta USD',
      type: AccountType.CHECKING,
      initialBalance: 1000,
      currentBalance: 1000,
      currency: 'USD',
      color: '#3B82F6',
      icon: '💵',
    },
  });

  console.log('✅ 4 contas criadas!\n');

  // ==================== TRANSAÇÕES ====================
  console.log('💸 Criando transações dos últimos 12 meses...');

  const transactionsData = [];
  let transactionCount = 0;

  // Últimos 12 meses
  for (let month = 0; month < 12; month++) {
    const date = new Date();
    date.setMonth(date.getMonth() - month);

    // Salário mensal
    transactionsData.push({
      userId: testUser.id,
      accountId: contaCorrente.id,
      categoryId: 'cat-salario',
      type: TransactionType.INCOME,
      amount: 5000 + Math.random() * 500,
      description: 'Salário',
      date: new Date(date.getFullYear(), date.getMonth(), 28),
      status: 'COMPLETED',
    });

    // Aluguel
    transactionsData.push({
      userId: testUser.id,
      accountId: nubank.id,
      categoryId: 'cat-moradia',
      type: TransactionType.EXPENSE,
      amount: 1500,
      description: 'Aluguel',
      merchant: 'Imobiliária ABC',
      date: new Date(date.getFullYear(), date.getMonth(), 5),
      status: 'COMPLETED',
    });

    // Contas fixas
    const contas = [
      {
        cat: 'cat-contas',
        desc: 'Luz',
        valor: 150 + Math.random() * 50,
        dia: 10,
      },
      {
        cat: 'cat-contas',
        desc: 'Água',
        valor: 80 + Math.random() * 30,
        dia: 12,
      },
      { cat: 'cat-contas', desc: 'Internet', valor: 120, dia: 15 },
      { cat: 'cat-assinaturas', desc: 'Netflix', valor: 39.9, dia: 20 },
      { cat: 'cat-assinaturas', desc: 'Spotify', valor: 19.9, dia: 22 },
    ];

    for (const conta of contas) {
      transactionsData.push({
        userId: testUser.id,
        accountId: nubank.id,
        categoryId: conta.cat,
        type: TransactionType.EXPENSE,
        amount: conta.valor,
        description: conta.desc,
        date: new Date(date.getFullYear(), date.getMonth(), conta.dia),
        status: 'COMPLETED',
      });
    }

    // Despesas variáveis (10-15 por mês)
    const despesasVariaveis = [
      {
        cat: 'cat-alimentacao',
        desc: ['Mercado', 'Restaurante', 'Delivery', 'Padaria'],
        min: 50,
        max: 300,
      },
      {
        cat: 'cat-transporte',
        desc: ['Uber', 'Gasolina', 'Estacionamento'],
        min: 30,
        max: 150,
      },
      {
        cat: 'cat-lazer',
        desc: ['Cinema', 'Show', 'Bar', 'Parque'],
        min: 40,
        max: 200,
      },
      {
        cat: 'cat-compras',
        desc: ['Roupa', 'Eletrônico', 'Presente'],
        min: 100,
        max: 500,
      },
      {
        cat: 'cat-saude',
        desc: ['Farmácia', 'Consulta', 'Academia'],
        min: 50,
        max: 300,
      },
    ];

    for (let i = 0; i < 12; i++) {
      const categoria =
        despesasVariaveis[Math.floor(Math.random() * despesasVariaveis.length)];
      const descricao =
        categoria.desc[Math.floor(Math.random() * categoria.desc.length)];
      const valor =
        categoria.min + Math.random() * (categoria.max - categoria.min);
      const dia = 1 + Math.floor(Math.random() * 28);

      transactionsData.push({
        userId: testUser.id,
        accountId: Math.random() > 0.5 ? nubank.id : contaCorrente.id,
        categoryId: categoria.cat,
        type: TransactionType.EXPENSE,
        amount: valor,
        description: descricao,
        date: new Date(date.getFullYear(), date.getMonth(), dia),
        status: 'COMPLETED',
      });
    }

    // Freelance ocasional (30% de chance)
    if (Math.random() > 0.7) {
      transactionsData.push({
        userId: testUser.id,
        accountId: nubank.id,
        categoryId: 'cat-freelance',
        type: TransactionType.INCOME,
        amount: 500 + Math.random() * 2000,
        description: 'Projeto Freelance',
        date: new Date(
          date.getFullYear(),
          date.getMonth(),
          15 + Math.floor(Math.random() * 10),
        ),
        status: 'COMPLETED',
      });
    }
  }

  // Inserir todas as transações
  for (const transaction of transactionsData) {
    await prisma.transaction.create({ data: transaction });
    transactionCount++;
  }

  console.log(`✅ ${transactionCount} transações criadas!\n`);

  // Atualizar saldos das contas (soma de todas as transações)
  const nubankTransactions = await prisma.transaction.findMany({
    where: { accountId: nubank.id },
  });
  const nubankBalance = nubankTransactions.reduce((sum, t) => {
    return sum + (t.type === 'INCOME' ? Number(t.amount) : -Number(t.amount));
  }, 5000);

  await prisma.account.update({
    where: { id: nubank.id },
    data: { currentBalance: nubankBalance },
  });

  const contaCorrenteTransactions = await prisma.transaction.findMany({
    where: { accountId: contaCorrente.id },
  });
  const contaCorrenteBalance = contaCorrenteTransactions.reduce((sum, t) => {
    return sum + (t.type === 'INCOME' ? Number(t.amount) : -Number(t.amount));
  }, 3000);

  await prisma.account.update({
    where: { id: contaCorrente.id },
    data: { currentBalance: contaCorrenteBalance },
  });

  console.log('✅ Saldos das contas atualizados!\n');

  // ==================== ORÇAMENTOS ====================
  console.log('💰 Criando orçamentos...');

  const budgets = [
    { categoryId: 'cat-alimentacao', amount: 1500, alertPercentage: 80 },
    { categoryId: 'cat-transporte', amount: 800, alertPercentage: 85 },
    { categoryId: 'cat-lazer', amount: 500, alertPercentage: 90 },
    { categoryId: 'cat-compras', amount: 1000, alertPercentage: 75 },
  ];

  for (const budget of budgets) {
    await prisma.budget.create({
      data: {
        userId: testUser.id,
        categoryId: budget.categoryId,
        amount: budget.amount,
        period: BudgetPeriod.MONTHLY,
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        alertPercentage: budget.alertPercentage,
      },
    });
  }

  console.log(`✅ ${budgets.length} orçamentos criados!\n`);

  // ==================== METAS ====================
  console.log('🎯 Criando metas...');

  const viagem = await prisma.goal.create({
    data: {
      userId: testUser.id,
      name: 'Viagem para Europa',
      description: 'Economizar para viagem de férias',
      targetAmount: 15000,
      currentAmount: 8500,
      targetDate: new Date(new Date().getFullYear() + 1, 6, 1),
      color: '#10B981',
      icon: '✈️',
      priority: 1,
      status: GoalStatus.ACTIVE,
    },
  });

  const emergencia = await prisma.goal.create({
    data: {
      userId: testUser.id,
      name: 'Reserva de Emergência',
      description: 'Fundo para emergências (6 meses)',
      targetAmount: 30000,
      currentAmount: 15000,
      color: '#EF4444',
      icon: '🚨',
      priority: 2,
      status: GoalStatus.ACTIVE,
    },
  });

  const carro = await prisma.goal.create({
    data: {
      userId: testUser.id,
      name: 'Carro Novo',
      description: 'Entrada para carro 0km',
      targetAmount: 50000,
      currentAmount: 35000,
      targetDate: new Date(new Date().getFullYear() + 2, 0, 1),
      color: '#3B82F6',
      icon: '🚗',
      priority: 3,
      status: GoalStatus.ACTIVE,
    },
  });

  console.log('✅ 3 metas criadas!\n');

  // ==================== TRANSAÇÕES RECORRENTES ====================
  console.log('🔁 Criando transações recorrentes...');

  await prisma.recurringTransaction.create({
    data: {
      userId: testUser.id,
      accountId: nubank.id,
      categoryId: 'cat-moradia',
      type: TransactionType.EXPENSE,
      amount: 1500,
      description: 'Aluguel',
      merchant: 'Imobiliária ABC',
      frequency: RecurrenceFrequency.MONTHLY,
      interval: 1,
      dayOfMonth: 5,
      startDate: new Date(2024, 0, 1),
      nextOccurrence: new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        5,
      ),
      autoCreate: true,
      tags: ['fixo', 'moradia'],
    },
  });

  await prisma.recurringTransaction.create({
    data: {
      userId: testUser.id,
      accountId: contaCorrente.id,
      categoryId: 'cat-salario',
      type: TransactionType.INCOME,
      amount: 5000,
      description: 'Salário',
      merchant: 'Empresa XYZ',
      frequency: RecurrenceFrequency.MONTHLY,
      interval: 1,
      dayOfMonth: 28,
      startDate: new Date(2024, 0, 1),
      nextOccurrence: new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        28,
      ),
      autoCreate: true,
      tags: ['receita', 'salário'],
    },
  });

  await prisma.recurringTransaction.create({
    data: {
      userId: testUser.id,
      accountId: nubank.id,
      categoryId: 'cat-assinaturas',
      type: TransactionType.EXPENSE,
      amount: 39.9,
      description: 'Netflix',
      frequency: RecurrenceFrequency.MONTHLY,
      interval: 1,
      dayOfMonth: 20,
      startDate: new Date(2024, 0, 1),
      nextOccurrence: new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        20,
      ),
      autoCreate: true,
      tags: ['assinatura', 'streaming'],
    },
  });

  console.log('✅ 3 transações recorrentes criadas!\n');

  console.log('🎉🎉🎉 SEED COMPLETO FINALIZADO! 🎉🎉🎉\n');
  console.log('📊 RESUMO:');
  console.log(`   💱 ${currencies.length} moedas`);
  console.log(`   📁 ${allCategories.length} categorias`);
  console.log(`   👤 1 usuário de teste`);
  console.log(`   🏦 4 contas bancárias`);
  console.log(`   💸 ${transactionCount} transações`);
  console.log(`   💰 ${budgets.length} orçamentos`);
  console.log(`   🎯 3 metas`);
  console.log(`   🔁 3 transações recorrentes`);
  console.log(`   💱 2 taxas de câmbio`);
  console.log('\n🔑 LOGIN:');
  console.log('   Email: teste@miucontrole.com');
  console.log('   Senha: senha123\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
