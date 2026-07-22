import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { TaxCountryPicker } from '../TaxCountryPicker';

// 税制应当从发票里读出来,而不是在看到发票之前让用户猜。
// 只有 AI 读不出(value=null)时才请用户选;读出来了就只是安静地显示一下。

describe('TaxCountryPicker', () => {
  it('已确定税制:不打扰用户,只显示结果', () => {
    render(<TaxCountryPicker value="DE" onChange={jest.fn()} />);
    expect(screen.getByText(/德国/)).toBeTruthy();
    expect(screen.queryByTestId('tax-country-prompt')).toBeNull();
  });

  it('未确定:提示发票没识别出来,并给出 DE/NL 选项', () => {
    render(<TaxCountryPicker value={null} onChange={jest.fn()} />);
    expect(screen.getByTestId('tax-country-prompt')).toBeTruthy();
    expect(screen.getByText(/没能从发票识别出税制/)).toBeTruthy();
    expect(screen.getByTestId('pick-DE')).toBeTruthy();
    expect(screen.getByTestId('pick-NL')).toBeTruthy();
  });

  it('选择后回传国家码', () => {
    const onChange = jest.fn();
    render(<TaxCountryPicker value={null} onChange={onChange} />);
    fireEvent.press(screen.getByTestId('pick-NL'));
    expect(onChange).toHaveBeenCalledWith('NL');
  });

  it('提交中禁止重复点击', () => {
    const onChange = jest.fn();
    render(<TaxCountryPicker value={null} onChange={onChange} busy />);
    fireEvent.press(screen.getByTestId('pick-DE'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
