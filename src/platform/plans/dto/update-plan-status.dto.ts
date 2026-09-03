import { IsEnum } from 'class-validator';
import { PlanStatus } from '@prisma/client';

export class UpdatePlanStatusDto {
  @IsEnum(PlanStatus)
  status!: PlanStatus;
}
