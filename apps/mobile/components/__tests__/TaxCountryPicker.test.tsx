import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { TaxCountryPicker } from '../TaxCountryPicker';

// 税制常驻一个不显眼的下拉:识别出来就自动填上,用户随时可改。
// 不弹提示条 —— 一进详情页就一大块黄色警告太吵了。

const props = {
  country: 'DE' as const,
  rates: { A: 1900, B: 700 },
  onChange: jest.fn(),
};

describe('TaxCountryPicker', () => {
  it('已确定:一行小字显示国家与实际税率', () => {
    render(<TaxCountryPicker {...props} onChange={jest.fn()} />);
    expect(screen.getByTestId('tax-country-trigger')).toBeTruthy();
    expect(screen.getByText(/德国/)).toBeTruthy();
    expect(screen.getByText(/19%/)).toBeTruthy();
    expect(screen.getByText(/7%/)).toBeTruthy();
  });

  it('显示发票读出的非整数税率(法国 5.5%)', () => {
    render(
      <TaxCountryPicker
        {...props}
        country="FR"
        rates={{ A: 2000, B: 550 }}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByText(/5\.5%/)).toBeTruthy();
  });

  it('未确定:提示待定,但不是警告块', () => {
    render(
      <TaxCountryPicker
        {...props}
        country={null}
        rates={null}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByText(/税制待定/)).toBeTruthy();
  });

  it('选中只有一档低税率的国家 → 直接回传', () => {
    const onChange = jest.fn();
    render(<TaxCountryPicker {...props} onChange={onChange} />);
    fireEvent.press(screen.getByTestId('tax-country-trigger'));
    expect(screen.getByTestId('option-FR')).toBeTruthy();
    expect(screen.getByTestId('option-IT')).toBeTruthy();
    fireEvent.press(screen.getByTestId('option-DE'));
    expect(onChange).toHaveBeenCalledWith('DE', undefined);
  });

  it('选中多档低税率的国家 → 追问用哪档,不替用户猜', () => {
    // 法国有 0.9/1.05/2.1/5.5/8.5/10/13 七档,自动取一档必然算错
    const onChange = jest.fn();
    render(<TaxCountryPicker {...props} onChange={onChange} />);
    fireEvent.press(screen.getByTestId('tax-country-trigger'));
    fireEvent.press(screen.getByTestId('option-FR'));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/多档低税率/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('reduced-550'));
    expect(onChange).toHaveBeenCalledWith('FR', 550);
  });

  it('可搜索:输入关键字过滤国家', () => {
    render(<TaxCountryPicker {...props} onChange={jest.fn()} />);
    fireEvent.press(screen.getByTestId('tax-country-trigger'));
    fireEvent.changeText(screen.getByTestId('country-search'), '法国');
    expect(screen.getByTestId('option-FR')).toBeTruthy();
    expect(screen.queryByTestId('option-IT')).toBeNull();
  });

  it('搜索也认国家码', () => {
    render(<TaxCountryPicker {...props} onChange={jest.fn()} />);
    fireEvent.press(screen.getByTestId('tax-country-trigger'));
    fireEvent.changeText(screen.getByTestId('country-search'), 'be');
    expect(screen.getByTestId('option-BE')).toBeTruthy();
    expect(screen.queryByTestId('option-IT')).toBeNull();
  });

  it('提交中不可点开', () => {
    render(<TaxCountryPicker {...props} onChange={jest.fn()} busy />);
    fireEvent.press(screen.getByTestId('tax-country-trigger'));
    expect(screen.queryByTestId('option-FR')).toBeNull();
  });
});
