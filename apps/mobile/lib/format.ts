// UI 展示格式化:计算一律在 core,这里只做整数 → 字符串的显示转换。

/** 整数分 → 欧元两位小数字符串(1863 → '18.63') */
export function centsToEuro(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** 整数千分位 → 十进制字符串,去尾零(2871 → '2.871',2000 → '2') */
export function milliToDecimal(milli: number): string {
  const sign = milli < 0 ? '-' : '';
  const abs = Math.abs(milli);
  const frac = String(abs % 1000)
    .padStart(3, '0')
    .replace(/0+$/, '');
  return `${sign}${Math.floor(abs / 1000)}${frac ? `.${frac}` : ''}`;
}
