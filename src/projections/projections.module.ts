import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PredictionsModule } from '../predictions/predictions.module'; // Import predictions
import { RecurringTransactionsModule } from '../recurring-transactions/recurring-transactions.module'; // Import recurring
import { ProjectionsController } from './projections.controller';
import { ProjectionsService } from './projections.service';

@Module({
  imports: [
    PrismaModule,
    PredictionsModule,
    RecurringTransactionsModule
  ],
  controllers: [ProjectionsController],
  providers: [ProjectionsService],
  exports: [ProjectionsService]
})
export class ProjectionsModule {}
