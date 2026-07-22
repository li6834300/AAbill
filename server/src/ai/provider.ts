import type { Lang, ParsedReceipt } from '@aabill/api-types';
import { createMockParser } from './mock.js';
import { createOpenAIParser } from './openai.js';

export interface ParseInput {
  /** 发票文件的 base64(图片或 PDF) */
  fileBase64: string;
  /** image/* 或 application/pdf */
  mimeType: string;
  /** 译名的目标语言;由账单决定,不跟界面语言走 */
  lang?: Lang;
}

/** 识别 provider 接口:OpenAI 为主,DeepSeek 备选,测试/本地默认 mock。 */
export interface ReceiptParser {
  parseReceipt(input: ParseInput): Promise<ParsedReceipt>;
}

/** 按环境选择 provider:有 OPENAI_API_KEY 且未显式指定 mock 时走 OpenAI。 */
export function selectParser(env: Record<string, string | undefined>): {
  kind: 'mock' | 'openai';
  parser: ReceiptParser;
} {
  if (env.OPENAI_API_KEY && env.AI_PROVIDER !== 'mock') {
    return {
      kind: 'openai',
      parser: createOpenAIParser({
        apiKey: env.OPENAI_API_KEY,
        // gpt-4.1 对多页发票的完整提取远好于 gpt-4o(见 tdd-log 010)
        model: env.OPENAI_MODEL?.trim() || 'gpt-4.1',
      }),
    };
  }
  return { kind: 'mock', parser: createMockParser() };
}
