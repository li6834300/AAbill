import { createMockSuggester } from './mock-suggester.js';
import { createOpenAISuggester } from './openai-suggester.js';

/**
 * 给模型看的候选商品。
 * **必须带重量/件数与单价**:一张发票上常有 8 块名字完全相同的牛肉
 * (RINDER FILET ×8),只有重量能区分它们。不给这些信息,再强的模型也只能瞎猜。
 */
export interface ClaimCandidate {
  id: string;
  name: string;
  nameTranslated: string;
  /** 如 "1.952 KG"、"10 件" */
  qtyLabel: string;
  /** 如 "12.291 €/KG"、"2.79 €/件" */
  priceLabel: string;
}

export interface SuggestInput {
  fileBase64: string;
  mimeType: string;
  candidates: ClaimCandidate[];
}

/**
 * 拍照认领建议器(PRD 二期 PRO):看一张"我买的东西"的照片,
 * 从候选商品里挑出照片中出现的,返回商品 id。只做建议,认领与否由用户确认。
 */
export interface ClaimSuggester {
  suggestItems(input: SuggestInput): Promise<string[]>;
}

export function selectSuggester(env: Record<string, string | undefined>): {
  kind: 'mock' | 'openai';
  suggester: ClaimSuggester;
} {
  if (env.OPENAI_API_KEY && env.AI_PROVIDER !== 'mock') {
    return {
      kind: 'openai',
      suggester: createOpenAISuggester({
        apiKey: env.OPENAI_API_KEY,
        model: env.OPENAI_MODEL?.trim() || 'gpt-4.1',
      }),
    };
  }
  return { kind: 'mock', suggester: createMockSuggester() };
}
