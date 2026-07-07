import { lineNetCents, vatCents, type TaxClass, type TaxRates } from './tax';

export interface BillItem {
  qtyMilli: number;
  unitPriceMilli: number;
  taxClass: TaxClass;
  /** 发票印刷的行总额(分):OCR 可得时优先于 qty×单价 的推算值 */
  printedLineNetCents?: number;
}

export interface PrintedTotals {
  netCents: number;
  vatByClass: Record<TaxClass, number>;
  grossCents: number;
}

export interface ComputedTotals {
  netByClass: Record<TaxClass, number>;
  netCents: number;
  vatByClass: Record<TaxClass, number>;
  grossCents: number;
}

export interface ValidateResult {
  ok: boolean;
  computed: ComputedTotals;
  /** 计算值 − 印刷值:负数表示识别结果偏低(疑漏行) */
  diffs: {
    netCents: number;
    vatByClass: Record<TaxClass, number>;
    grossCents: number;
  };
}

/** 行净额:优先采用印刷行总额,否则按 qty×单价 取整推算。 */
export function itemNetCents(item: BillItem): number {
  return (
    item.printedLineNetCents ?? lineNetCents(item.qtyMilli, item.unitPriceMilli)
  );
}

/** 对账:按行取整重算合计,与发票印刷合计逐项求差(PRD A4)。 */
export function validate(input: {
  items: BillItem[];
  rates: TaxRates;
  printed: PrintedTotals;
}): ValidateResult {
  const { items, rates, printed } = input;

  const netByClass: Record<TaxClass, number> = { A: 0, B: 0 };
  for (const item of items) {
    netByClass[item.taxClass] += itemNetCents(item);
  }
  const vatByClass: Record<TaxClass, number> = {
    A: vatCents(netByClass.A, rates.A),
    B: vatCents(netByClass.B, rates.B),
  };
  const netCents = netByClass.A + netByClass.B;
  const grossCents = netCents + vatByClass.A + vatByClass.B;
  const computed: ComputedTotals = {
    netByClass,
    netCents,
    vatByClass,
    grossCents,
  };

  const diffs = {
    netCents: netCents - printed.netCents,
    vatByClass: {
      A: vatByClass.A - printed.vatByClass.A,
      B: vatByClass.B - printed.vatByClass.B,
    },
    grossCents: grossCents - printed.grossCents,
  };
  const ok =
    diffs.netCents === 0 &&
    diffs.grossCents === 0 &&
    diffs.vatByClass.A === 0 &&
    diffs.vatByClass.B === 0;

  return { ok, computed, diffs };
}
