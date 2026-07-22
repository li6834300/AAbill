import type { ClaimSuggester } from './suggester.js';

/** 确定性 mock:挑候选里的前两个,便于本地与测试。 */
export function createMockSuggester(): ClaimSuggester {
  return {
    suggestItems: async ({ candidates }) =>
      candidates.slice(0, 2).map((c) => c.id),
  };
}
