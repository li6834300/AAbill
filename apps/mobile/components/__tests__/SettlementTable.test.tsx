import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { buildSummaryText, SettlementTable } from '../SettlementTable';

// PRD D2/D3:AA 汇总 —— 每家净额/税额/含税,合计精确等于发票总额;可复制为文本。

const settlement = {
  families: [
    { familyId: 'f1', name: '甲', netCents: 590, vatCents: 65, grossCents: 655 },
    { familyId: 'f2', name: '乙', netCents: 596, vatCents: 42, grossCents: 638 },
    { familyId: 'f3', name: '丙', netCents: 186, vatCents: 13, grossCents: 199 },
  ],
  totals: { grossCents: 1492 },
};

describe('SettlementTable', () => {
  it('渲染每家含税金额与合计', () => {
    render(<SettlementTable settlement={settlement} />);
    expect(screen.getByText('甲')).toBeTruthy();
    expect(screen.getByText('6.55 €')).toBeTruthy();
    expect(screen.getByText('6.38 €')).toBeTruthy();
    expect(screen.getByText('1.99 €')).toBeTruthy();
    expect(screen.getByText(/14\.92/)).toBeTruthy();
  });
});

describe('buildSummaryText', () => {
  it('生成可发群里的文本(D3)', () => {
    expect(buildSummaryText('Metro 05-16', settlement)).toBe(
      [
        'Metro 05-16 · AA 汇总',
        '甲:6.55 €(净 5.90 + 税 0.65)',
        '乙:6.38 €(净 5.96 + 税 0.42)',
        '丙:1.99 €(净 1.86 + 税 0.13)',
        '合计:14.92 €',
      ].join('\n'),
    );
  });
});
