import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { ValidationBanner } from '../ValidationBanner';

// PRD A4:校验提示条 —— 对上显示绿色确认;差额逐项高亮,引导找漏行/错行。

const okResult = {
  ok: true,
  diffs: { netCents: 0, vatByClass: { A: 0, B: 0 }, grossCents: 0 },
};

describe('ValidationBanner', () => {
  it('无校验结果:不渲染', () => {
    render(<ValidationBanner result={null} />);
    expect(screen.queryByTestId('validation-banner')).toBeNull();
  });

  it('全部对上:显示一致提示', () => {
    render(<ValidationBanner result={okResult} />);
    expect(screen.getByText(/与发票合计一致/)).toBeTruthy();
  });

  it('有差额:逐项显示非零差额(欧元),提示排查', () => {
    render(
      <ValidationBanner
        result={{
          ok: false,
          diffs: { netCents: -558, vatByClass: { A: 0, B: -39 }, grossCents: -597 },
        }}
      />,
    );
    expect(screen.getByText(/净额差 -5\.58/)).toBeTruthy();
    expect(screen.getByText(/B 税额差 -0\.39/)).toBeTruthy();
    expect(screen.getByText(/含税差 -5\.97/)).toBeTruthy();
    expect(screen.queryByText(/A 税额差/)).toBeNull();
  });
});
