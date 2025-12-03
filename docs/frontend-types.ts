/**
 * 🎯 Interfaces TypeScript para Goals com Imagens e Links
 * Use estas interfaces no frontend (React/Next.js)
 */

export enum GoalStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/**
 * Link de compra da meta
 */
export interface PurchaseLink {
  id: string;
  title: string;
  url: string;
  price?: number;
  currency?: string;
  note?: string;
  addedAt: string;
  updatedAt?: string;
}

/**
 * Meta financeira completa (com imagem e links)
 */
export interface Goal {
  // Campos básicos
  id: string;
  userId: string;
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  color: string;
  icon?: string;
  priority: number;
  status: GoalStatus;

  // 🆕 Campos de imagem
  imageUrl?: string;
  imageKey?: string;
  imageMimeType?: string;
  imageSize?: number;

  // 🆕 Links de compra
  purchaseLinks?: PurchaseLink[];

  // Campos calculados (não salvos no banco)
  percentage: number;
  remaining: number;
  isOverdue: boolean;
  daysRemaining?: number;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  completedAt?: string;

  // Contadores
  _count?: {
    contributions: number;
  };
}

/**
 * DTO para adicionar link de compra
 */
export interface AddPurchaseLinkDto {
  title: string;
  url: string;
  price?: number;
  currency?: string;
  note?: string;
}

/**
 * DTO para atualizar link de compra
 */
export interface UpdatePurchaseLinkDto {
  title?: string;
  url?: string;
  price?: number;
  currency?: string;
  note?: string;
}

/**
 * Resumo dos links de compra
 */
export interface PurchaseLinksSummary {
  total: number;
  totalBRL: number;
  byCurrenty: Record<string, number>;
  links: PurchaseLink[];
}

/**
 * Resposta do upload de imagem
 */
export interface UploadImageResponse {
  message: string;
  goal: Goal;
}

/**
 * Resposta de operações com links
 */
export interface PurchaseLinkResponse {
  message: string;
  goal: Goal;
}

// ==================== HOOKS E UTILITIES SUGERIDOS ====================

/**
 * Hook React para calcular progresso visual
 */
export const useGoalProgress = (goal: Goal) => {
  const progressColor = () => {
    if (goal.percentage >= 100) return 'green';
    if (goal.percentage >= 75) return 'blue';
    if (goal.percentage >= 50) return 'yellow';
    return 'orange';
  };

  const statusLabel = () => {
    switch (goal.status) {
      case GoalStatus.ACTIVE:
        return goal.percentage >= 100 ? 'Concluída! 🎉' : 'Em progresso';
      case GoalStatus.COMPLETED:
        return 'Concluída';
      case GoalStatus.CANCELLED:
        return 'Cancelada';
    }
  };

  return { progressColor, statusLabel };
};

/**
 * Formatar moeda
 */
export const formatCurrency = (
  amount: number,
  currency: string = 'BRL',
): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(amount);
};

/**
 * Calcular total dos links de compra
 */
export const calculatePurchaseLinksTotal = (
  links: PurchaseLink[] = [],
): number => {
  return links.reduce((sum, link) => sum + (link.price || 0), 0);
};

/**
 * Verificar se meta tem imagem
 */
export const hasGoalImage = (goal: Goal): boolean => {
  return !!goal.imageUrl;
};

/**
 * Verificar se total dos links excede meta
 */
export const isLinksOverBudget = (goal: Goal): boolean => {
  const total = calculatePurchaseLinksTotal(goal.purchaseLinks);
  return total > goal.targetAmount;
};

/**
 * Obter diferença entre meta e links
 */
export const getBudgetDifference = (
  goal: Goal,
): {
  amount: number;
  percentage: number;
  isOver: boolean;
} => {
  const total = calculatePurchaseLinksTotal(goal.purchaseLinks);
  const diff = goal.targetAmount - total;

  return {
    amount: Math.abs(diff),
    percentage: (Math.abs(diff) / goal.targetAmount) * 100,
    isOver: diff < 0,
  };
};

// ==================== EXEMPLO DE USO ====================

/**
 * Exemplo de componente React
 */
/*
import { Goal, formatCurrency, calculatePurchaseLinksTotal } from './types';

const GoalCard: React.FC<{ goal: Goal }> = ({ goal }) => {
  const linksTotal = calculatePurchaseLinksTotal(goal.purchaseLinks);

  return (
    <div className="goal-card">
      {goal.imageUrl && (
        <img
          src={goal.imageUrl}
          alt={goal.name}
          className="goal-image"
        />
      )}

      <h3>{goal.name}</h3>
      <p>{goal.description}</p>

      <div className="progress">
        <div className="progress-bar" style={{ width: `${goal.percentage}%` }}>
          {goal.percentage}%
        </div>
      </div>

      <div className="amounts">
        <span>Atual: {formatCurrency(goal.currentAmount)}</span>
        <span>Meta: {formatCurrency(goal.targetAmount)}</span>
      </div>

      {goal.purchaseLinks && goal.purchaseLinks.length > 0 && (
        <div className="purchase-links">
          <h4>Links de Compra</h4>
          <ul>
            {goal.purchaseLinks.map((link) => (
              <li key={link.id}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  {link.title}
                </a>
                {link.price && <span>{formatCurrency(link.price, link.currency)}</span>}
              </li>
            ))}
          </ul>
          <p>Total: {formatCurrency(linksTotal)}</p>
        </div>
      )}
    </div>
  );
};
*/
