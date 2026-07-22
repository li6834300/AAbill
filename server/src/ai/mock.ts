import type { ParsedReceipt } from '@aabill/api-types';
import type { ReceiptParser } from './provider.js';

/** 确定性 mock:本地开发与测试用,数据取自 Metro 夹具的三行缩影。 */
export function createMockParser(): ReceiptParser {
  const receipt: ParsedReceipt = {
    detectedTaxCountry: 'DE',
    items: [
      {
        name: '10mx30cm KRAFT-ALUFOLIE',
        nameZh: '铝箔纸',
        qty: '1',
        unit: 'ST',
        unitPriceNet: '1.99',
        lineNet: '1.99',
        taxClass: 'A',
      },
      {
        name: 'MC HAE.OBERKEULE',
        nameZh: '鸡大腿',
        qty: '2.871',
        unit: 'KG',
        unitPriceNet: '6.488',
        lineNet: '18.63',
        taxClass: 'B',
      },
      {
        name: '10er Eier bunt M Boden',
        nameZh: '散养鸡蛋 10个',
        qty: '2',
        unit: 'PG',
        unitPriceNet: '2.79',
        lineNet: '5.58',
        taxClass: 'B',
      },
    ],
    totals: { net: '26.20', vatA: '0.38', vatB: '1.69', gross: '28.27' },
  };
  return {
    parseReceipt: async () => structuredClone(receipt),
  };
}
