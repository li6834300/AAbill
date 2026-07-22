import { z } from 'zod';
import type { ClaimSuggester, SuggestInput } from './suggester.js';

const SYSTEM_PROMPT = [
  '你在帮人分账:用户拍了一张"自己买的东西"的照片,下面给你这张账单里的候选商品清单',
  '(每项含编号、名称、重量/件数、单价)。判断照片里出现了清单中的哪些商品,只返回编号。',
  '规则:',
  '- 只返回你**确实在照片里看到**的商品;宁可漏也不要多选 —— 多选比漏选更烦人。',
  '- 【同名商品必须靠重量区分】清单里常有多条名称完全相同的商品(如 8 块 RINDER FILET),',
  '  它们只有重量不同。**不要把同名的全选上**:',
  '  · 照片里的价签/标签上通常印着重量(kg)和金额 —— 读出来,挑重量最接近的那一条;',
  '  · 看不清重量时,照片里有几件就最多返回几条,不要返回全部同名项。',
  '- 数量要对得上:照片里只有一块牛肉,就只返回一条牛肉,不要返回八条。',
  '- 编号必须来自给定清单,不要编造。照片里有但清单上没有的东西,忽略。',
  '- 同一编号只返回一次。',
].join('\n');

/** 结果只要编号:让模型抄 UUID 容易出错,编号更稳。 */
const ResultSchema = z.object({
  matchedIndexes: z.array(z.number().int()),
});

export function createOpenAISuggester(opts: {
  apiKey: string;
  model: string;
}): ClaimSuggester {
  return {
    async suggestItems({ fileBase64, mimeType, candidates }: SuggestInput) {
      const list = candidates
        .map(
          (c, i) =>
            `${i + 1}. ${c.name}${c.nameZh ? `(${c.nameZh})` : ''} — ${c.qtyLabel} — ${c.priceLabel}`,
        )
        .join('\n');

      const res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${opts.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: opts.model,
          instructions: SYSTEM_PROMPT,
          max_output_tokens: 2000,
          input: [
            {
              role: 'user',
              content: [
                { type: 'input_text', text: `候选商品清单:\n${list}` },
                {
                  type: 'input_image',
                  image_url: `data:${mimeType};base64,${fileBase64}`,
                },
              ],
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'matched_items',
              strict: true,
              schema: z.toJSONSchema(ResultSchema),
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

      const { matchedIndexes } = ResultSchema.parse(JSON.parse(text));
      // 编号 → id;越界/重复一律忽略,不让模型的失误炸掉流程
      const seen = new Set<string>();
      const ids: string[] = [];
      for (const n of matchedIndexes) {
        const c = candidates[n - 1];
        if (c && !seen.has(c.id)) {
          seen.add(c.id);
          ids.push(c.id);
        }
      }
      return ids;
    },
  };
}
