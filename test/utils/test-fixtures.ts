/**
 * Fixtures de dados para testes
 * Dados reutilizáveis e consistentes
 */

export const testUsers = {
  validUser: {
    email: 'test@example.com',
    password: 'Test@123456',
    name: 'Test User',
  },
  adminUser: {
    email: 'admin@example.com',
    password: 'Admin@123456',
    name: 'Admin User',
  },
  weakPassword: {
    email: 'weak@example.com',
    password: '123', // Senha fraca
    name: 'Weak Password User',
  },
};

export const testCategories = {
  food: {
    name: 'Alimentação',
    type: 'EXPENSE' as const,
    icon: 'food',
    color: '#FF5733',
  },
  salary: {
    name: 'Salário',
    type: 'INCOME' as const,
    icon: 'money',
    color: '#33FF57',
  },
  transport: {
    name: 'Transporte',
    type: 'EXPENSE' as const,
    icon: 'car',
    color: '#3357FF',
  },
};

export const testAccounts = {
  checking: {
    name: 'Conta Corrente',
    type: 'CHECKING' as const,
    initialBalance: 1000,
    color: '#4CAF50',
  },
  savings: {
    name: 'Poupança',
    type: 'SAVINGS' as const,
    initialBalance: 5000,
    color: '#2196F3',
  },
};

export const testTransactions = {
  expense: {
    description: 'Compra no mercado',
    amount: 150.75,
    type: 'EXPENSE' as const,
    date: new Date().toISOString(),
  },
  income: {
    description: 'Salário mensal',
    amount: 5000.00,
    type: 'INCOME' as const,
    date: new Date().toISOString(),
  },
  transfer: {
    description: 'Transferência entre contas',
    amount: 500.00,
    type: 'TRANSFER' as const,
    date: new Date().toISOString(),
  },
};

export const testBudgets = {
  food:  {
    amount: 800.00,
    period: 'MONTHLY' as const,
    startDate: new Date().toISOString(),
    alertPercentage: 80,
  },
  transport: {
    amount: 400.00,
    period: 'MONTHLY' as const,
    startDate: new Date().toISOString(),
    alertPercentage: 90,
  },
};

export const testGoals = {
  vacation: {
    name: 'Viagem de Férias',
    description: 'Economizar para viagem à Europa',
    targetAmount: 10000.00,
    targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 ano
    color: '#9C27B0',
    icon: 'plane',
    priority: 1,
  },
  emergency: {
    name: 'Fundo de Emergência',
    description: 'Reserva para imprevistos',
    targetAmount: 20000.00,
    color: '#F44336',
    icon: 'shield',
    priority: 1,
  },
};
