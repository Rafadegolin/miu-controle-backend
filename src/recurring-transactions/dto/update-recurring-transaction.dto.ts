import { PartialType } from '@nestjs/swagger';
import { CreateRecurringTransactionDto } from './create-recurring-transaction.dto';

export class UpdateRecurringTransactionDto extends PartialType(
  CreateRecurringTransactionDto,
) {}
