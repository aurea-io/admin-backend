import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class PlanCreditsDto {
  @IsInt()
  @Min(0)
  monthly!: number;

  @IsOptional()
  @IsBoolean()
  rollover?: boolean;
}
