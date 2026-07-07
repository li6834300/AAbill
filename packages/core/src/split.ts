import { allocateByLargestRemainder } from './allocate.js';

/** 均摊:totalCents 由 familyCount 个家庭平分,尾差按最大余数法,和精确守恒。 */
export function splitEvenly(totalCents: number, familyCount: number): number[] {
  if (!Number.isInteger(familyCount) || familyCount <= 0) {
    throw new Error(`家庭数必须为正整数,收到 ${familyCount}`);
  }
  return allocateByLargestRemainder(
    totalCents,
    Array.from({ length: familyCount }, () => 1),
  );
}
