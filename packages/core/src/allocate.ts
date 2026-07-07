/**
 * 把 totalCents 按权重比例拆成整数分,尾差按最大余数法分配。
 * 结果之和精确等于 totalCents;余数并列时下标靠前者优先;负数总额镜像处理。
 * 全程整数运算(余数比较用交叉相乘,不引入浮点)。
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

  const floors = weights.map((w) => Math.floor((totalCents * w) / weightSum));
  // 余数 = totalCents×w mod weightSum,整数,可直接比大小
  const remainders = weights.map(
    (w, i) => totalCents * w - (floors[i] ?? 0) * weightSum,
  );
  let leftover = totalCents - floors.reduce((a, b) => a + b, 0);

  const byRemainderDesc = weights
    .map((_, i) => i)
    .sort((a, b) => (remainders[b] ?? 0) - (remainders[a] ?? 0) || a - b);

  const result = [...floors];
  for (const i of byRemainderDesc) {
    if (leftover === 0) break;
    result[i] = (result[i] ?? 0) + 1;
    leftover -= 1;
  }
  return result;
}
