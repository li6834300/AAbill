import type { Bill } from '@aabill/api-types';

/** Owner 端四个推进阶段(locked 是终态,不在步骤条里) */
export type Stage = 'scan' | 'review' | 'share' | 'summary';
export type StageOrLocked = Stage | 'locked';

/** 步骤条顺序 */
export const STAGES: Stage[] = ['scan', 'review', 'share', 'summary'];

/** 可认领项(均摊项不需要谁来认领,由全家庭平分) */
export function claimableItems(bill: Bill) {
  return bill.items.filter((i) => !i.isShared);
}

/** 可认领项是否都至少被认领了一次 */
export function claimsComplete(bill: Bill): boolean {
  const claimable = claimableItems(bill);
  return (
    claimable.length > 0 &&
    claimable.every((i) => bill.claims.some((c) => c.itemId === i.id))
  );
}

/**
 * 当前阶段,纯由账单数据 + 校验结果推导 —— 不新增服务端状态。
 * validationOk:Σ条目 ≈ 印刷合计(容差内),来自 api.validate。
 */
export function billStage(bill: Bill, validationOk: boolean): StageOrLocked {
  if (bill.status === 'locked') return 'locked';
  if (bill.items.length === 0) return 'scan';
  if (!bill.printedTotals || !validationOk) return 'review';
  if (bill.families.length === 0 || !claimsComplete(bill)) return 'share';
  return 'summary';
}
