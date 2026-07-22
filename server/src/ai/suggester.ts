import { createMockSuggester } from './mock-suggester.js';
import { createOpenAISuggester } from './openai-suggester.js';

/** 给模型看的候选商品(不含价格,只需辨认是不是照片里的东西) */
export interface ClaimCandidate {
  id: string;
  name: string;
  nameZh: string;
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
