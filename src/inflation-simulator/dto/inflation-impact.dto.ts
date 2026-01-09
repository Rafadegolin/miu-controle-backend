import { ApiProperty } from '@nestjs/swagger';

export class GoalInflationImpact {
    @ApiProperty()
    goalId: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    originalTarget: number;

    @ApiProperty()
    adjustedTarget: number;

    @ApiProperty()
    difference: number;
    
    @ApiProperty()
    yearsToTarget: number;
}

export class BudgetInflationImpact {
    @ApiProperty()
    budgetId: string;

    @ApiProperty()
    categoryName: string;

    @ApiProperty()
    currentAmount: number;

    @ApiProperty()
    projectedAmount: number;

    @ApiProperty()
    monthlyIncrease: number;
}

export class PurchasingPowerProjection {
    @ApiProperty()
    month: number;
    
    @ApiProperty()
    nominalValue: number; // e.g. 1000 constant
    
    @ApiProperty()
    realValue: number; // e.g. 950
}

export class InflationImpactDto {
    @ApiProperty({ description: 'Ganho ou perda real percentual' })
    realGainRate: number;

    @ApiProperty()
    purchasingPowerLost: number; // Value lost per 1000 currency units

    @ApiProperty({ type: [PurchasingPowerProjection] })
    purchasingPowerProjections: PurchasingPowerProjection[];

    @ApiProperty({ type: [GoalInflationImpact] })
    affectedGoals: GoalInflationImpact[];

    @ApiProperty({ type: [BudgetInflationImpact] })
    budgetImpacts: BudgetInflationImpact[];

    @ApiProperty({ type: [String] })
    recommendations: string[];
}
