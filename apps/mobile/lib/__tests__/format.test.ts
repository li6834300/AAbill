import { centsToEuro, milliToDecimal } from '../format';

// UI 层显示格式:整数分/千分位 → 十进制字符串(计算永远在 core,这里只管展示)

describe('centsToEuro', () => {
  it('分 → 欧元两位小数', () => {
    expect(centsToEuro(1863)).toBe('18.63');
    expect(centsToEuro(0)).toBe('0.00');
    expect(centsToEuro(5)).toBe('0.05');
  });

  it('负数(差额展示)带负号', () => {
    expect(centsToEuro(-1)).toBe('-0.01');
  });
});

describe('milliToDecimal', () => {
  it('千分位 → 十进制,去尾零', () => {
    expect(milliToDecimal(2871)).toBe('2.871');
    expect(milliToDecimal(2000)).toBe('2');
    expect(milliToDecimal(6488)).toBe('6.488');
    expect(milliToDecimal(2790)).toBe('2.79');
  });
});
