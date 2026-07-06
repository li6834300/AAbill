/** 整数比值取整:四舍五入、远离零。分母须为正。 */
export function roundHalfAwayFromZero(numerator: number, denominator: number): number {
  const sign = numerator < 0 ? -1 : 1;
  const n = Math.abs(numerator);
  return sign * Math.floor((n + denominator / 2) / denominator);
}

/** 十进制字符串 → 整数千分位(如 '6.488' → 6488)。最多 3 位小数,超出即抛错。 */
export function toMilli(decimal: string): number {
  const m = /^(-?)(\d+)(?:\.(\d{1,3}))?$/.exec(decimal);
  if (!m) throw new Error(`无法解析十进制数: "${decimal}"`);
  const [, sign, int, frac = ''] = m;
  const milli = Number(int) * 1000 + Number(frac.padEnd(3, '0'));
  return sign === '-' ? -milli : milli;
}
