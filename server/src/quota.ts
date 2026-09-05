/**
 * AI 识别额度策略(纯函数,无 IO)。
 *
 * 一个「额度」= 一张账单的**首次**成功 AI 识别。同一张账单重新识别不重复扣减
 * (拍糊了重试不该受罚),这条由 parse 路由按 bill.quotaChargedAt 保证。
 * 按自然月(UTC)重置 —— 比滚动 30 天好解释:每月 1 号回满。
 */
export type Plan = 'free' | 'pro';

export const PLAN_LIMITS: Record<Plan, number> = {
  free: 2,
  pro: 20,
};

/** 本计费期起点:当月 1 号 00:00:00 UTC。 */
export function monthlyPeriodStart(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
}

/** 下次重置:次月 1 号 00:00:00 UTC(Date.UTC 自动处理跨年)。 */
export function nextResetAt(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
}

export interface QuotaStatus {
  plan: Plan;
  limit: number;
  used: number;
  remaining: number;
  canConsume: boolean;
  periodStart: Date;
  resetsAt: Date;
}

/**
 * 由套餐与本期已用次数算出额度状态。
 * remaining 夹到 0:手动把 PRO 降回免费后,已用可能超过新上限,不能显示负数。
 */
export function quotaStatus(
  plan: Plan,
  usedInPeriod: number,
  now: Date,
): QuotaStatus {
  const limit = PLAN_LIMITS[plan];
  const used = Math.max(0, usedInPeriod);
  return {
    plan,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    canConsume: used < limit,
    periodStart: monthlyPeriodStart(now),
    resetsAt: nextResetAt(now),
  };
}
