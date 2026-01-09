import { ApiProperty } from '@nestjs/swagger';

export class ActionRecommendation {
    @ApiProperty()
    type: 'CUT' | 'DELAY' | 'INSTALLMENT' | 'EARN';
    
    @ApiProperty()
    message: string;
    
    @ApiProperty()
    details?: any;
}

export class ScenarioResultDto {
    @ApiProperty()
    isViable: boolean;

    @ApiProperty()
    currentBalance: number;

    @ApiProperty({ type: [Number] })
    projectedBalance12Months: number[];

    @ApiProperty()
    lowestBalance: number;
    
    @ApiProperty({ type: [String] })
    impactedGoals: string[];

    @ApiProperty({ type: [ActionRecommendation] })
    recommendations: ActionRecommendation[];

    @ApiProperty({ required: false })
    alternativeScenarios?: any[];
}
