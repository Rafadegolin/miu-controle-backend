import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PredictionResultDto } from '../dto/prediction-result.dto';

@Injectable()
export class PredictionEngineService {
  private readonly logger = new Logger(PredictionEngineService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Identifica categorias de despesas variáveis baseado no histórico
   * Critério: Coeficiente de Variação (CV) > 0.3
   */
  async detectVariableCategories(userId: string): Promise<string[]> {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // Buscar despesas agrupadas por categoria e mês
    const expenses = await this.prisma.transaction.groupBy({
      by: ['categoryId', 'date'],
      where: {
        userId,
        type: 'EXPENSE',
        date: { gte: oneYearAgo },
        categoryId: { not: null }, // Ignorar sem categoria
      },
      _sum: { amount: true },
    });

    // Reagrupar por Categoria -> Lista de valores mensais
    const categoryValues = new Map<string, number[]>();

    for (const record of expenses) {
      if (!record.categoryId) continue;
      const monthKey = record.date.toISOString().slice(0, 7); // Agrupar por mês
      const val = Number(record._sum.amount || 0);
      
      // Nota: O groupBy do Prisma retorna datas individuais, precisamos somar por mês nós mesmos
      // Mas para simplificar, vamos assumir que o groupBy já foi suficiente ou processamos aqui.
      // O groupBy acima agrupa por DATA exata gerando muitos registros.
      // Melhor fazer uma query raw ou processar em memória. 
      // Vamos processar em memória: chaves compostas categoryId + month
    }
    
    // Abordagem melhor: Buscar todas transações e processar
    // (Para muitos usuários pode ser pesado, mas para MVP ok)
    // Vamos usar a mesma lógica do getMonthlyHistory mas por categoria
    
    const variableCategoryIds: string[] = [];
    const allCategories = await this.prisma.category.findMany({
      where: { userId, type: 'EXPENSE' },
      select: { id: true }
    });

    for (const cat of allCategories) {
      const isVariable = await this.isCategoryVariable(userId, cat.id);
      if (isVariable) variableCategoryIds.push(cat.id);
    }

    return variableCategoryIds;
  }

  /**
   * Verifica se uma categoria específica é variável
   */
  async isCategoryVariable(userId: string, categoryId: string): Promise<boolean> {
    const history = await this.getCategoryMonthlyHistory(userId, categoryId, 12);
    if (history.length < 3) return false; // Sem dados suficientes

    const values = history.map(h => h.amount);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    
    if (mean === 0) return false;

    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean;

    // Se CV > 0.3, consideramos variável
    return cv > 0.3;
  }

  /**
   * Gera previsão para uma categoria para o próximo mês
   */
  async predictCategoryExpense(
    userId: string, 
    categoryId: string, 
    targetDate: Date = new Date() // Data alvo (geralmente mês que vem)
  ): Promise<PredictionResultDto | null> {
    
    // Garantir que é 1o dia do mês alvo
    const month = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1); 
    
    // 1. Histórico Recente (para médias)
    // Precisamos de 6 meses para trás
    const history6M = await this.getCategoryMonthlyHistory(userId, categoryId, 6);
    
    if (history6M.length < 3) return null; // Dados insuficientes

    // 2. Dado Ano Anterior (para sazonalidade base)
    const prevYearDate = new Date(month);
    prevYearDate.setFullYear(prevYearDate.getFullYear() - 1);
    
    // Buscar especificamente o mês do ano anterior
    const prevYearHistory = await this.getCategoryMonthlyHistory(
      userId, 
      categoryId, 
      1, 
      prevYearDate
    );
    const prevYearAmount = prevYearHistory.length > 0 ? prevYearHistory[0].amount : 0;

    // 3. Calcular Médias
    // Ordenado do mais antigo para mais novo pelo getCategoryMonthlyHistory
    // Mas precisamos pegar os últimos X do array history6M que pegou "até hoje"
    
    const values = history6M.map(h => h.amount).reverse(); // [M-1, M-2, ...] (Do mais recente pro antigo)
    
    /*
      Previsão = (Média 3 meses * 0.5) + 
                 (Média 6 meses * 0.3) + 
                 (Mesmo mês ano anterior * 0.2)
    */

    const avg3M = values.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(values.length, 3);
    const avg6M = values.slice(0, 6).reduce((a, b) => a + b, 0) / Math.min(values.length, 6);
    
    // Se não tiver ano anterior, redistribuir peso? 
    // Vamos manter 0 se não tiver, ou usar Média 6M como fallback
    const sameMonthPrevYear = prevYearAmount || avg6M; 

    const basePredicted = (avg3M * 0.5) + (avg6M * 0.3) + (sameMonthPrevYear * 0.2);

    // 4. Calcular Fator Sazonal
    // Comparar o mês alvo (ex: Jan) com a média anual histórica
    const seasonality = await this.calculateSeasonalityFactor(userId, categoryId, month.getMonth());
    
    // Aplicar Sazonalidade (Multiplier)
    // Se Dezembro é +40%, factor é 1.4. Predicted = Base * 1.4
    const finalPredicted = basePredicted * seasonality;

    // 5. Calcular Intervalo de Confiança
    // Usar StdDev dos últimos 6 meses
    const mean6M = avg6M;
    const variance = values.slice(0, 6).reduce((a, b) => a + Math.pow(b - mean6M, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // 95% Confidence (Z=1.96 approx 2)
    // Mas para finanças pessoais, intervalor menor pode ser melhor visualmente.
    // Vamos usar margem de erro baseada no desvio.
    const margin = stdDev * 1.0; // 1 Sigma (68% chance) para ser safe e não criar range gigante
    
    return {
      categoryId,
      month,
      predictedAmount: Math.max(0, finalPredicted),
      confidence: Math.max(0, 100 - (stdDev / (mean6M || 1) * 100)), // Crude confidence score
      lowerBound: Math.max(0, finalPredicted - margin),
      upperBound: finalPredicted + margin,
      algorithm: 'WEIGHTED_MOVING_AVG_W_SEASONALITY',
      factors: {
        seasonality,
        trend: avg3M > avg6M ? 'UP' : 'DOWN',
        historicalAverage: mean6M
      }
    };
  }

  // --- Helpers ---

  /**
   * Pega histórico mensal (soma) de uma categoria
   */
  private async getCategoryMonthlyHistory(
    userId: string, 
    categoryId: string, 
    months: number,
    referenceDate: Date = new Date() // Data "Fim" (exclusiva? ou inclusiva?)
  ) {
    const endDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 0); // Último dia do mês ANTERIOR ao target
    const startDate = new Date(endDate);
    startDate.setMonth(startDate.getMonth() - months + 1);
    startDate.setDate(1);

    // Se a referência é "Hoje" (ex: Jan 8), queremos histórico até Dez 31?
    // Geralmente previsão é para o mês FUTURO baseada nos passados FECHADOS.
    
    const transactions = await this.prisma.transaction.groupBy({
      by: ['date'],
      where: {
        userId,
        categoryId,
        date: {
          gte: startDate,
          lte: endDate
        },
        type: 'EXPENSE'
      },
      _sum: { amount: true }
    });

    // Agregar via JS pq groupBy date é por dia, nao mes
    const monthlyData = new Map<string, number>();
    
    // Pre-fill zeros
    for(let i=0; i<months; i++) {
        const d = new Date(startDate);
        d.setMonth(d.getMonth() + i);
        monthlyData.set(d.toISOString().slice(0, 7), 0);
    }

    transactions.forEach(t => {
        const key = t.date.toISOString().slice(0, 7);
        if (monthlyData.has(key)) {
            monthlyData.set(key, (monthlyData.get(key) || 0) + Number(t._sum.amount));
        }
    });

    return Array.from(monthlyData.entries()).map(([period, amount]) => ({ period, amount }))
        .sort((a,b) => a.period.localeCompare(b.period));
  }

  /**
   * Calcula fator sazonal para um mês específico (0-11)
   * Baseado em todo o histórico disponível
   */
  private async calculateSeasonalityFactor(
    userId: string, 
    categoryId: string, 
    targetMonthIndex: number
  ): Promise<number> {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 2); // Pelo menos 2 anos pra ser bom, mas vamos pegar tudo

    const transactions = await this.prisma.transaction.findMany({
        where: { userId, categoryId, type: 'EXPENSE' },
        select: { date: true, amount: true }
    });
    
    if (!transactions.length) return 1.0;

    // Calcular média geral mensal
    // Na verdade, precisamos da média de "Cada Mês" vs "Média Geral"
    
    const monthlyTotals = new Map<string, number>(); // "YYYY-MM" -> total
    transactions.forEach(t => {
        const key = t.date.toISOString().slice(0, 7);
        monthlyTotals.set(key, (monthlyTotals.get(key) || 0) + Number(t.amount));
    });
    
    const allMonths = Array.from(monthlyTotals.values());
    const globalMonthlyAvg = allMonths.reduce((a,b) => a+b, 0) / allMonths.length;
    
    if (globalMonthlyAvg === 0) return 1.0;

    // Calcular média especifica do mês alvo (ex: tods os Dezembros)
    let targetMonthSum = 0;
    let targetMonthCount = 0;
    
    monthlyTotals.forEach((val, key) => {
        const monthIndex = parseInt(key.split('-')[1]) - 1; // 0-based
        if (monthIndex === targetMonthIndex) {
            targetMonthSum += val;
            targetMonthCount++;
        }
    });
    
    if (targetMonthCount === 0) return 1.0;
    
    const targetMonthAvg = targetMonthSum / targetMonthCount;
    
    // Factor = Média do Mês Alvo / Média Geral
    // Ex: Dezembro (1400) / Geral (1000) = 1.4 (+40%)
    return targetMonthAvg / globalMonthlyAvg;
  }
}
