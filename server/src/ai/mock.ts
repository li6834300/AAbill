import type { Lang, ParsedReceipt } from '@aabill/api-types';
import type { ReceiptParser } from './provider.js';

/** 三行商品的各语言译名。mock 也遵守目标语言,否则本地开发会看到
 *  「荷兰语账单配中文商品名」这种真实 provider 不会出现的假象。 */
const NAMES: Record<Lang, [string, string, string]> = {
  zh: ['铝箔纸', '鸡大腿', '散养鸡蛋 10个'],
  en: ['Aluminium foil', 'Chicken thighs', 'Free-range eggs, 10'],
  nl: ['Aluminiumfolie', 'Kippenbouten', 'Scharreleieren, 10'],
  de: ['Alufolie', 'Hähnchenschenkel', 'Freilandeier, 10er'],
};

/** 确定性 mock:本地开发与测试用,数据取自 Metro 夹具的三行缩影。 */
export function createMockParser(): ReceiptParser {
  const build = (lang: Lang): ParsedReceipt => ({
    detectedTaxCountry: 'DE',
    detectedRates: { A: '19,00', B: '7,00' },
    items: [
      {
        name: '10mx30cm KRAFT-ALUFOLIE',
        nameTranslated: NAMES[lang][0],
        qty: '1',
        unit: 'ST',
        unitPriceNet: '1.99',
        lineNet: '1.99',
        taxClass: 'A',
      },
      {
        name: 'MC HAE.OBERKEULE',
        nameTranslated: NAMES[lang][1],
        qty: '2.871',
        unit: 'KG',
        unitPriceNet: '6.488',
        lineNet: '18.63',
        taxClass: 'B',
      },
      {
        name: '10er Eier bunt M Boden',
        nameTranslated: NAMES[lang][2],
        qty: '2',
        unit: 'PG',
        unitPriceNet: '2.79',
        lineNet: '5.58',
        taxClass: 'B',
      },
    ],
    totals: { net: '26.20', vatA: '0.38', vatB: '1.69', gross: '28.27' },
  });
  return {
    parseReceipt: async (input) => build(input.lang ?? 'en'),
  };
}
