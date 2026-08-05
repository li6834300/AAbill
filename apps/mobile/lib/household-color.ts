import { householdColor } from '../theme/tokens';

/**
 * 家庭索引 → 身份色。按位置循环取用,保证同一家在任何视图里都是同一个颜色。
 *
 * 索引取账单 families 数组里的下标;超出色板长度就绕回开头。
 * 负数用取模再纠正,永远落在色板内 —— 不返回 undefined。
 */
export function householdColorAt(index: number): string {
  const n = householdColor.length;
  const wrapped = ((Math.trunc(index) % n) + n) % n;
  return householdColor[wrapped]!;
}
