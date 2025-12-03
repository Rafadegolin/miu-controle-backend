import { PartialType } from '@nestjs/swagger';
import { AddPurchaseLinkDto } from './add-purchase-link.dto';

export class UpdatePurchaseLinkDto extends PartialType(AddPurchaseLinkDto) {}
