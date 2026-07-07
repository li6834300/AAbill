import { allocateByLargestRemainder } from './allocate';

/**
 * 整单折扣按商品净额比例分摊(PRD B4):返回各商品应摊的折扣分,
 * 之和精确等于 discountCents。净额为 0 的商品不分摊。
 */
export function allocateDiscount(
  discountCents: number,
  itemNetsCents: number[],
): number[] {
  if (itemNetsCents.some((net) => net < 0)) {
    throw new Error('分摊基数不能含负净额(折扣行不参与再分摊)');
  }
  const netSum = itemNetsCents.reduce((a, b) => a + b, 0);
  if (Math.abs(discountCents) > netSum) {
    throw new Error(`折扣 ${discountCents} 分超过商品净额之和 ${netSum} 分`);
  }
  if (discountCents === 0) return itemNetsCents.map(() => 0);
  return allocateByLargestRemainder(discountCents, itemNetsCents);
}
