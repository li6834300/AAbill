/**
 * 把 totalCents 按权重比例拆成整数分,尾差按最大余数法分配。
 * 结果之和精确等于 totalCents;余数并列时下标靠前者优先;负数总额镜像处理。
 * 全程整数运算(余数即 totalCents×w mod ΣW,整数可直接比大小,不引入浮点)。
 */
export function allocateByLargestRemainder(
  totalCents: number,
  weights: number[],
): number[] {
  if (weights.length === 0) throw new Error('权重不能为空');
  if (weights.some((w) => w < 0)) throw new Error('权重不能为负');
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum === 0) throw new Error('权重和不能为 0');
  if (totalCents < 0) {
    return allocateByLargestRemainder(-totalCents, weights).map((c) => 0 - c);
  }

  const entries = weights.map((weight, index) => {
    const floor = Math.floor((totalCents * weight) / weightSum);
    return { index, floor, remainder: totalCents * weight - floor * weightSum };
  });
  const leftover = totalCents - entries.reduce((sum, e) => sum + e.floor, 0);
  const bonusIndexes = new Set(
    [...entries]
      .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
      .slice(0, leftover)
      .map((e) => e.index),
  );
  return entries.map((e) => e.floor + (bonusIndexes.has(e.index) ? 1 : 0));
}
