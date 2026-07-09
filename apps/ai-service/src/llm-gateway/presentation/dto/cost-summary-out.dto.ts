import { ApiProperty } from '@nestjs/swagger';

export class CostSummaryItemDto {
  @ApiProperty() model: string;
  @ApiProperty() totalCostUsd: number;
}

export class CostSummaryOutDto {
  @ApiProperty({ type: [CostSummaryItemDto] })
  items: CostSummaryItemDto[];

  @ApiProperty() from: string;
  @ApiProperty() to: string;

  static of(
    items: Array<{ model: string; totalCostUsd: number }>,
    from: Date,
    to: Date,
  ): CostSummaryOutDto {
    const dto = new CostSummaryOutDto();
    dto.items = items.map((i) => {
      const item = new CostSummaryItemDto();
      item.model = i.model;
      item.totalCostUsd = i.totalCostUsd;
      return item;
    });
    dto.from = from.toISOString();
    dto.to = to.toISOString();
    return dto;
  }
}

export class BreakerStatusOutDto {
  @ApiProperty() model: string;
  @ApiProperty() status: string;
  @ApiProperty() failureCount: number;
  @ApiProperty({ nullable: true }) openedAt: number | null;
}
