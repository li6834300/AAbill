import { ParsedReceiptSchema } from '@aabill/api-types';
import { z } from 'zod';
import type { ParseInput, ReceiptParser } from './provider.js';

const LANG_NAMES: Record<string, string> = {
  zh: '简体中文',
  en: 'English',
  nl: 'Nederlands (Dutch)',
  de: 'Deutsch (German)',
};

const systemPrompt = (lang: string) =>
  [
    '你是发票识别器。从超市发票(图片或 PDF)中提取每一个商品行,输出 JSON。',
    '规则:',
    '- 【提取全部】必须提取每一页的每一行商品。发票常有多页,不要在某页小计(SEITENSUMME)处停下;',
    '  跳过页眉/页脚、章节标题(如 **** Nonfood ****)、LOT-Nr / MHD / BC GTIN 等附加行。',
    '- 【Metro 折扣】用 INT KD PREIS(最后一列,折后净单价)作为 unitPriceNet;带 * 号的行是折扣行,',
    '  折后价低于 EINZEL PREIS,一律以 INT KD 为准,不要用 GESAMT PREIS(那是折扣前的行总额)。',
    '- unitPriceNet = INT KD PREIS(折后净单价);qty = MENGE(数量或重量,KG 行为重量);',
    '  lineNet = qty × unitPriceNet 的折后行净额(自己算,保留 2 位小数),不要抄 GESAMT 列。',
    '- qty 与 unitPriceNet 保持发票原样精度(最多 3 位小数);金额最多 2 位小数。',
    '- taxClass 为该行的税类字母(GESAMT 列后的 M 标记,A 或 B)。',
    `- nameTranslated 给出简短的${LANG_NAMES[lang] ?? 'English'}译名(商品名的翻译,不是解释)。`,
    '- 【税制国家】detectedTaxCountry:填**开票方/门店所在国**的两位国家码(如 DE、NL、FR、BE)。',
    '  依据只看卖方一侧:抬头的商号与地址、增值税税号前缀(USt-IdNr. DE…、BTW NL…、TVA BE…)、',
    '  门店地址与邮编。',
    '  【重要】**忽略买方/收货人地址** —— 跨境采购很常见(德国门店卖给荷兰客户),',
    '  买方在哪国与适用税制无关。看到买卖双方国家不同时,一律以卖方为准,不要因此返回 UNKNOWN。',
    '  实在找不到卖方国家线索才返回 UNKNOWN。',
    '- 【实际税率】detectedRates:抄发票底部税额汇总栏里印的**税率百分比**,A 类填 A 的、B 类填 B 的,',
    '  原样保留发票写法("19,00" 或 "19.00" 都行,不要加 % 号)。这是算钱的权威值。',
    '  汇总栏没印税率就留空字符串,不要拿国家去推算。',
    '- totals 抄发票印刷的最终合计(全部折扣后):净额、A 税额、B 税额、含税总额。',
    '- 自检:所有 lineNet 之和应约等于 totals.net;若明显对不上,说明漏了行或用错了价格列,请重查。',
  ].join('\n');

/** 文件内容部分:图片走 input_image,PDF 走 input_file。 */
function fileContentPart({ fileBase64, mimeType }: ParseInput) {
  const dataUrl = `data:${mimeType};base64,${fileBase64}`;
  return mimeType === 'application/pdf'
    ? { type: 'input_file', filename: 'invoice.pdf', file_data: dataUrl }
    : { type: 'input_image', image_url: dataUrl };
}

/**
 * OpenAI Responses API(/v1/responses)+ structured outputs。
 * chat/completions 自 2025-09 起不再收文件输入,故 vision 与 PDF 统一走 Responses。
 * 密钥只在服务端。
 */
export function createOpenAIParser(opts: {
  apiKey: string;
  model: string;
}): ReceiptParser {
  return {
    async parseReceipt(input: ParseInput) {
      const res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${opts.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: opts.model,
          instructions: systemPrompt(input.lang ?? 'en'),
          // 长发票(几十行)输出可能很长,给足空间以免被默认上限截断
          max_output_tokens: 16000,
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: '识别这张发票的全部商品行与合计。',
                },
                fileContentPart(input),
              ],
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'parsed_receipt',
              strict: true,
              schema: z.toJSONSchema(ParsedReceiptSchema),
            },
          },
        }),
      });
      if (!res.ok) {
        throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
      }
      const data = (await res.json()) as {
        output?: Array<{ content?: Array<{ type: string; text?: string }> }>;
      };
      const text = (data.output ?? [])
        .flatMap((o) => o.content ?? [])
        .find((c) => c.type === 'output_text')?.text;
      if (!text) throw new Error('OpenAI 返回空内容');
      return ParsedReceiptSchema.parse(JSON.parse(text));
    },
  };
}
