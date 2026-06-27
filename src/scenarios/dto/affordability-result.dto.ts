import { ApiProperty } from '@nestjs/swagger';

export enum AffordabilityStatus {
  CAN_AFFORD = 'CAN_AFFORD', // 70-100 (Green)
  CAUTION = 'CAUTION',       // 40-69 (Yellow)
  NOT_RECOMMENDED = 'NOT_RECOMMENDED' // 0-39 (Red)
}

export class AffordabilityBreakdown {
    @ApiProperty()
    balanceScore: number; // Max 25

    @ApiProperty()
    budgetScore: number; // Max 20

    @ApiProperty()
    reserveScore: number; // Max 20

    @ApiProperty()
    goalScore: number; // Max 15

    @ApiProperty()
    historyScore: number; // Max 10

    @ApiProperty()
    timingScore: number; // Max 10
}

export class AffordabilityResultDto {
    @ApiProperty()
    score: number; // 0-100

    @ApiProperty({ enum: AffordabilityStatus })
    status: AffordabilityStatus;

    @ApiProperty()
    badgeColor: string; // HEX

    @ApiProperty({ type: AffordabilityBreakdown })
    breakdown: AffordabilityBreakdown;

    @ApiProperty({ type: [String] })
    recommendations: string[];

    @ApiProperty({ required: false })
    alternatives?: string[];
}
