import { PrismaClient, CategoryType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed das categorias...\n');

  // Limpar categorias existentes (opcional, cuidado em produção!)
  await prisma.category.deleteMany({
    where: { isSystem: true },
  });

  // ==================== CATEGORIAS DE DESPESAS ====================
  const expenseCategories = [
    {
      id: 'cat-alimentacao',
      name: 'Alimentação',
      type: CategoryType.EXPENSE,
      color: '#EF4444',
      icon: '🍽️',
      description: 'Supermercado, restaurantes, delivery',
    },
    {
      id: 'cat-transporte',
      name: 'Transporte',
      type: CategoryType.EXPENSE,
      color: '#F59E0B',
      icon: '🚗',
      description: 'Uber, gasolina, estacionamento, transporte público',
    },
    {
      id: 'cat-moradia',
      name: 'Moradia',
      type: CategoryType.EXPENSE,
      color: '#8B5CF6',
      icon: '🏠',
      description: 'Aluguel, condomínio, IPTU, reparos',
    },
    {
      id: 'cat-saude',
      name: 'Saúde',
      type: CategoryType.EXPENSE,
      color: '#EC4899',
      icon: '🏥',
      description: 'Plano de saúde, medicamentos, consultas',
    },
    {
      id: 'cat-educacao',
      name: 'Educação',
      type: CategoryType.EXPENSE,
      color: '#3B82F6',
      icon: '📚',
      description: 'Cursos, livros, mensalidade escolar',
    },
    {
      id: 'cat-lazer',
      name: 'Lazer',
      type: CategoryType.EXPENSE,
      color: '#10B981',
      icon: '🎮',
      description: 'Cinema, streaming, hobbies, viagens',
    },
    {
      id: 'cat-compras',
      name: 'Compras',
      type: CategoryType.EXPENSE,
      color: '#6366F1',
      icon: '🛍️',
      description: 'Roupas, eletrônicos, presentes',
    },
    {
      id: 'cat-contas',
      name: 'Contas Fixas',
      type: CategoryType.EXPENSE,
      color: '#14B8A6',
      icon: '📄',
      description: 'Luz, água, internet, telefone, gás',
    },
    {
      id: 'cat-investimentos',
      name: 'Investimentos',
      type: CategoryType.EXPENSE,
      color: '#84CC16',
      icon: '📈',
      description: 'Aportes em ações, fundos, previdência',
    },
    {
      id: 'cat-pets',
      name: 'Pets',
      type: CategoryType.EXPENSE,
      color: '#F97316',
      icon: '🐾',
      description: 'Ração, veterinário, produtos para pets',
    },
    {
      id: 'cat-assinaturas',
      name: 'Assinaturas',
      type: CategoryType.EXPENSE,
      color: '#A855F7',
      icon: '📱',
      description: 'Netflix, Spotify, apps, serviços mensais',
    },
    {
      id: 'cat-outros-despesas',
      name: 'Outras Despesas',
      type: CategoryType.EXPENSE,
      color: '#64748B',
      icon: '💸',
      description: 'Despesas diversas não categorizadas',
    },
  ];

  // ==================== CATEGORIAS DE RECEITAS ====================
  const incomeCategories = [
    {
      id: 'cat-salario',
      name: 'Salário',
      type: CategoryType.INCOME,
      color: '#10B981',
      icon: '💰',
      description: 'Salário mensal, 13º, bonificações',
    },
    {
      id: 'cat-freelance',
      name: 'Freelance',
      type: CategoryType.INCOME,
      color: '#06B6D4',
      icon: '💻',
      description: 'Trabalhos pontuais, projetos externos',
    },
    {
      id: 'cat-investimentos-receita',
      name: 'Rendimentos',
      type: CategoryType.INCOME,
      color: '#84CC16',
      icon: '📊',
      description: 'Dividendos, juros, lucros de investimentos',
    },
    {
      id: 'cat-vendas',
      name: 'Vendas',
      type: CategoryType.INCOME,
      color: '#F59E0B',
      icon: '🏷️',
      description: 'Venda de produtos ou serviços',
    },
    {
      id: 'cat-presente',
      name: 'Presentes',
      type: CategoryType.INCOME,
      color: '#EC4899',
      icon: '🎁',
      description: 'Dinheiro recebido de presente',
    },
    {
      id: 'cat-reembolso',
      name: 'Reembolsos',
      type: CategoryType.INCOME,
      color: '#8B5CF6',
      icon: '💳',
      description: 'Cashback, devoluções, reembolsos',
    },
    {
      id: 'cat-outros-receitas',
      name: 'Outras Receitas',
      type: CategoryType.INCOME,
      color: '#64748B',
      icon: '💵',
      description: 'Receitas diversas não categorizadas',
    },
  ];

  // Inserir todas as categorias
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
        userId: null, // Categoria global
      },
    });
    console.log(`✅ ${category.icon} ${category.name} criada!`);
  }

  console.log(
    `\n🎉 Seed concluído! ${allCategories.length} categorias criadas.\n`,
  );
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
