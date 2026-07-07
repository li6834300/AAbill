import { ParsedReceiptSchema } from '@aabill/api-types';
import { z } from 'zod';
import type { ParseInput, ReceiptParser } from './provider.js';

const SYSTEM_PROMPT = [
  '你是发票识别器。从超市发票(图片或 PDF)中提取每一行商品,输出 JSON。',
  '规则:',
  '- Metro 发票以 INT KD PREIS(折后净价)为准,不要重复打折;含 M(手输)与 *(折扣)标记行。',
  '- lineNet 必须抄发票印刷的行总额(Wert 列),不要自己用数量×单价重算。',
  '- qty 与 unitPriceNet 保持发票原样精度(最多 3 位小数);金额最多 2 位小数。',
  '- taxClass 为发票行上的税类字母(A/B)。',
  '- nameZh 给出简短中文翻译。',
  '- totals 抄发票印刷合计:净额、A 税额、B 税额、含税总额。',
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
          instructions: SYSTEM_PROMPT,
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
