export interface ClaimDraftItem {
  id: string;
  isShared: boolean;
  myPortion: number;
}

/** 草稿只有与服务端已提交认领不同时才算可提交。 */
export function hasClaimChanges(
  items: ClaimDraftItem[],
  draft: Record<string, number>,
): boolean {
  return items.some(
    (item) =>
      !item.isShared && (draft[item.id] ?? 0) !== Math.max(0, item.myPortion),
  );
}
