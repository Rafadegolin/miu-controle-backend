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

// --- Helpers ---
const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomFloat = (min: number, max: number) => parseFloat((Math.random() * (max - min) + min).toFixed(2));
const getRandomElement = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

async function main() {
  console.log('🌱 Iniciando seed COMPLETO (v2.0)...\n');

  // 1. Limpeza (opcional, cuidado em prod)
  // await prisma.transaction.deleteMany(); 
  // ... melhor não limpar tudo se não for pedido explicitamente, mas seed geralmente é destrutivo ou upsert.
  // Vamos usar Upserts onde possível.

  // ==================== MOEDAS ====================
  console.log('💱 Criando moedas...');
  const currencies = [
    { code: 'BRL', name: 'Real Brasileiro', symbol: 'R$' },
    { code: 'USD', name: 'Dólar Americano', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
  ];
  for (const c of currencies) await prisma.currency.upsert({ where: { code: c.code }, update: {}, create: c });

  // Taxas
  const usd = await prisma.currency.findUnique({ where: { code: 'USD' } });
  const brl = await prisma.currency.findUnique({ where: { code: 'BRL' } });
  if (usd && brl) {
      // Upsert logic for exchange rate slightly complex due to no unique composite key on seeds usually, 
      // but let's just create if not exists or ignore.
      const exists = await prisma.exchangeRate.findFirst({ where: { fromCurrencyId: usd.id, toCurrencyId: brl.id } });
      if (!exists) {
        await prisma.exchangeRate.create({
            data: { fromCurrencyId: usd.id, toCurrencyId: brl.id, rate: 5.25, source: 'MANUAL' } 
        });
      }
  }

  // ==================== CATEGORIAS ====================
  console.log('📁 Criando categorias...');
  // Categorias padrão
  const categoriesData = [
    { id: 'cat-alimentacao', name: 'Alimentação', type: CategoryType.EXPENSE, color: '#EF4444', icon: '🍽️', isEssential: true },
    { id: 'cat-transporte', name: 'Transporte', type: CategoryType.EXPENSE, color: '#F59E0B', icon: '🚗', isEssential: true },
    { id: 'cat-moradia', name: 'Moradia', type: CategoryType.EXPENSE, color: '#8B5CF6', icon: '🏠', isEssential: true },
    { id: 'cat-saude', name: 'Saúde', type: CategoryType.EXPENSE, color: '#EC4899', icon: '🏥', isEssential: true },
    { id: 'cat-educacao', name: 'Educação', type: CategoryType.EXPENSE, color: '#3B82F6', icon: '📚', isEssential: true },
    { id: 'cat-lazer', name: 'Lazer', type: CategoryType.EXPENSE, color: '#10B981', icon: '🎮', isEssential: false },
    { id: 'cat-compras', name: 'Compras', type: CategoryType.EXPENSE, color: '#6366F1', icon: '🛍️', isEssential: false },
    { id: 'cat-contas', name: 'Contas Fixas', type: CategoryType.EXPENSE, color: '#14B8A6', icon: '📄', isEssential: true },
    { id: 'cat-assinaturas', name: 'Assinaturas', type: CategoryType.EXPENSE, color: '#A855F7', icon: '📱', isEssential: false },
    { id: 'cat-salario', name: 'Salário', type: CategoryType.INCOME, color: '#10B981', icon: '💰', isEssential: false }, // Income doesn't use isEssential logic usually but safer to set default or false
    { id: 'cat-freelance', name: 'Freelance', type: CategoryType.INCOME, color: '#06B6D4', icon: '💻', isEssential: false },
    { id: 'cat-investimentos', name: 'Investimentos', type: CategoryType.INCOME, color: '#84CC16', icon: '📈', isEssential: false },
  ];

  for (const cat of categoriesData) {
      await prisma.category.upsert({
          where: { id: cat.id }, // Usando ID fixo para facilitar relacionamentos
          update: { ...cat, isSystem: true },
          create: { ...cat, isSystem: true }
      });
  }

  // ==================== USUÁRIO ====================
  console.log('👤 Criando usuário de teste...');
  const passwordHash = await bcrypt.hash('senha123', 10);
  const testUser = await prisma.user.upsert({
      where: { email: 'teste@miucontrole.com' },
      update: {},
      create: {
          email: 'teste@miucontrole.com',
          passwordHash,
          fullName: 'Usuário de Teste',
          phone: '11999999999',
          preferredCurrency: 'BRL',
          // Configs Personalizadas
          aiConfig: {
              create: {
                  usesCorporateKey: true,
                  isAiEnabled: true,
                  categorizationModel: 'gpt-4o-mini',
                  analyticsModel: 'gemini-1.5-flash',
              }
          }
      }
  });

  // Ensure AI Config exists if user already existed
  const aiConfig = await prisma.userAiConfig.findUnique({ where: { userId: testUser.id }});
  if (!aiConfig) {
      await prisma.userAiConfig.create({
          data: {
              userId: testUser.id,
              usesCorporateKey: true
          }
      });
  }


  // ==================== CONTAS ====================
  console.log('🏦 Criando contas...');
  const accountsData = [
      { name: 'Nubank', type: AccountType.CHECKING, balance: 15430.50, color: '#820AD1', icon: '💳' },
      { name: 'Itaú', type: AccountType.CHECKING, balance: 5200.00, color: '#FF6200', icon: '🏦' },
      { name: 'Reserva de Emergência', type: AccountType.SAVINGS, balance: 50000.00, color: '#10B981', icon: '🐖' },
      { name: 'Carteira Física', type: AccountType.CHECKING, balance: 250.00, color: '#64748B', icon: '💵' },
      { name: 'XP Investimentos', type: AccountType.INVESTMENT, balance: 120000.00, color: '#000000', icon: '📈' }
  ];

  const accounts = [];
  for (const acc of accountsData) {
      const created = await prisma.account.create({
          data: {
              userId: testUser.id,
              name: acc.name,
              type: acc.type,
              initialBalance: acc.balance,
              currentBalance: acc.balance, // Será atualizado depois? Na verdade seed assume estado atual.
              currency: 'BRL',
              color: acc.color,
              icon: acc.icon
          }
      });
      accounts.push(created);
  }

  // ==================== TRANSAÇÕES & HISTÓRICO ====================
  console.log('� Gerando histórico de transações (12 meses)...');
  
  const merchantNames = {
      'cat-alimentacao': ['McDonalds', 'Carrefour', 'Pão de Açúcar', 'Ifood', 'Restaurante da Esquina', 'Outback', 'Starbucks'],
      'cat-transporte': ['Uber', 'Shell', 'Ipiranga', 'Sem Parar', 'Metrô SP', '99 Pop'],
      'cat-lazer': ['Netflix', 'Spotify', 'Cinema Cinemark', 'Steam', 'Playstation Store', 'Ingresso.com'],
      'cat-saude': ['Drogasil', 'Droga Raia', 'Dr. Consulta', 'Laboratório XY'],
      'cat-compras': ['Amazon', 'Mercado Livre', 'Shopee', 'Zara', 'Nike Store'],
      'cat-moradia': ['Condomínio', 'Sabesp', 'Enel', 'Aluguel'],
  };

  const monthlyVariations = []; // To store aggregates for MonthlyReport

  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1); // 12 meses atrás

  for (let m = 0; m < 12; m++) {
      const currentMonth = new Date(startDate.getFullYear(), startDate.getMonth() + m, 1);
      const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
      
      let monthlyIncome = 0;
      let monthlyExpense = 0;
      const transactionsToCreate = [];

      // 1. Salário (Fixo)
      const salaryDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 5);
      if (salaryDate <= today) {
        const amount = 8500.00;
        monthlyIncome += amount;
        transactionsToCreate.push({
            userId: testUser.id,
            accountId: accounts[1].id, // Itaú
            categoryId: 'cat-salario',
            type: TransactionType.INCOME,
            amount,
            description: 'Salário Mensal',
            merchant: 'Empresa LTDA',
            date: salaryDate,
            status: 'COMPLETED'
        });
      }

      // 2. Aluguel (Fixo)
      const rentDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 10);
      if (rentDate <= today) {
          const amount = 2500.00;
          monthlyExpense += amount;
          transactionsToCreate.push({
              userId: testUser.id,
              accountId: accounts[1].id,
              categoryId: 'cat-moradia',
              type: TransactionType.EXPENSE,
              amount,
              description: 'Aluguel Apartamento',
              merchant: 'Proprietário',
              date: rentDate,
              status: 'COMPLETED'
          });
      }

      // 3. Variáveis (Random)
      const numTransacoes = getRandomInt(15, 30);
      for (let t = 0; t < numTransacoes; t++) {
          const day = getRandomInt(1, daysInMonth);
          const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day, getRandomInt(8, 22), getRandomInt(0, 59));
          
          if (date > today) continue; // Não criar no futuro

          const type = Math.random() > 0.9 ? TransactionType.INCOME : TransactionType.EXPENSE; // 10% income extra
          
          let categoryId, categoryName, amount, desc, merchant;

          if (type === TransactionType.EXPENSE) {
             const cats = Object.keys(merchantNames);
             categoryId = getRandomElement(cats);
             merchant = getRandomElement(merchantNames[categoryId]);
             desc = merchant; // Simples
             amount = getRandomFloat(20, 500);
             monthlyExpense += amount;
          } else {
             categoryId = 'cat-freelance';
             merchant = 'Cliente Freelance';
             desc = 'Projeto Extra';
             amount = getRandomFloat(200, 1500);
             monthlyIncome += amount;
          }

          transactionsToCreate.push({
              userId: testUser.id,
              accountId: accounts[0].id, // Nubank
              categoryId,
              type,
              amount,
              description: desc,
              merchant,
              date,
              status: 'COMPLETED'
          });
      }

      // Batch Insert
      // Prisma createMany is faster
      await prisma.transaction.createMany({ data: transactionsToCreate });
      
      monthlyVariations.push({
          month: currentMonth,
          income: monthlyIncome,
          expense: monthlyExpense,
          balance: monthlyIncome - monthlyExpense
      });
  }

  console.log(`✅ Transações criadas com sucesso!`);

  // ==================== RELATÓRIOS MENSAIS (ISSUE #52) ====================
  console.log('� Gerando relatórios mensais...');
  
  // Create Reports for past closed months (exclude current running month for analysis logic sometimes, but let's populate all past)
  for (let i = 0; i < monthlyVariations.length - 1; i++) { // Skip last one if it's current month? Let's do all except strictly future.
      const stats = monthlyVariations[i];
      const prevStats = i > 0 ? monthlyVariations[i-1] : { income: 0, expense: 0, balance: 0 };
      
      const calcDelta = (curr, old) => old === 0 ? 0 : ((curr - old) / old) * 100;

      await prisma.monthlyReport.create({
          data: {
              userId: testUser.id,
              month: stats.month,
              totalIncome: stats.income,
              totalExpense: stats.expense,
              balance: stats.balance,
              savingsRate: stats.income > 0 ? ((stats.income - stats.expense) / stats.income) * 100 : 0,
              topCategories: [], // Simplificado
              anomalies: [],
              trends: { type: 'STABLE' },
              insights: ['Relatório gerado via Seed'],
              comparisonPrev: {
                  incomeDiff: calcDelta(stats.income, prevStats.income),
                  expenseDiff: calcDelta(stats.expense, prevStats.expense),
                  balanceDiff: calcDelta(stats.balance, prevStats.balance),
              },
              comparisonAvg: {}
          }
      });
  }

  // ==================== ORÇAMENTOS E METAS ====================
  console.log('🎯 Criando orçamentos e metas...');
  
  await prisma.budget.create({
      data: {
          userId: testUser.id,
          categoryId: 'cat-alimentacao',
          amount: 1200.00,
          period: BudgetPeriod.MONTHLY,
          startDate: new Date(),
          alertPercentage: 80
      }
  });

  await prisma.goal.create({
      data: {
          userId: testUser.id,
          name: 'Viagem Europa',
          description: 'Férias de Julho',
          targetAmount: 20000,
          currentAmount: 5000,
          targetDate: new Date(today.getFullYear() + 1, 6, 1),
          color: '#3B82F6',
          icon: '✈️',
          status: GoalStatus.ACTIVE
      }
  });

  // ==================== RECORRÊNCIA ====================
  console.log('🔁 Criando transações recorrentes...');
  // Cria a lógica base para que o sistema gere as próximas
  await prisma.recurringTransaction.create({
      data: {
          userId: testUser.id,
          categoryId: 'cat-moradia',
          accountId: accounts[1].id,
          type: TransactionType.EXPENSE,
          amount: 2500.00,
          description: 'Aluguel',
          merchant: 'Proprietário',
          frequency: RecurrenceFrequency.MONTHLY,
          interval: 1,
          dayOfMonth: 10,
          startDate: new Date(2024, 0, 1),
          nextOccurrence: new Date(today.getFullYear(), today.getMonth() + 1, 10), // Próximo mês
          autoCreate: true
      }
  });

  console.log('\n🎉 SEED COMPLETO FINALIZADO! 🎉');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
