import { describe, expect, it } from 'vitest';
import {
  PLAN_LIMITS,
  monthlyPeriodStart,
  nextResetAt,
  quotaStatus,
} from '../src/quota.js';

// 免费 2 次/月,PRO 20 次/月,自然月(UTC)重置。
// 一个「额度」= 一张账单的首次 AI 识别;同一单重识不重扣(扣减发生在账单上,见 parse 路由)。
describe('额度策略', () => {
  it('套餐上限:免费 2,PRO 20', () => {
    expect(PLAN_LIMITS.free).toBe(2);
    expect(PLAN_LIMITS.pro).toBe(20);
  });

  describe('自然月边界(UTC)', () => {
    it('月中取到当月 1 号零点', () => {
      const start = monthlyPeriodStart(new Date('2026-09-05T14:23:45.123Z'));
      expect(start.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    });

    it('月初零点取到自身', () => {
      const start = monthlyPeriodStart(new Date('2026-09-01T00:00:00.000Z'));
      expect(start.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    });

    it('月末最后一毫秒仍属当月', () => {
      const start = monthlyPeriodStart(new Date('2026-09-30T23:59:59.999Z'));
      expect(start.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    });

    it('跨年:12 月回到当年 12 月 1 号', () => {
      const start = monthlyPeriodStart(new Date('2026-12-17T08:00:00.000Z'));
      expect(start.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    });
  });

  describe('下次重置时间', () => {
    it('9 月 → 10 月 1 号', () => {
      expect(nextResetAt(new Date('2026-09-05T14:00:00Z')).toISOString()).toBe(
        '2026-10-01T00:00:00.000Z',
      );
    });

    it('12 月跨年 → 次年 1 月 1 号', () => {
      expect(nextResetAt(new Date('2026-12-31T23:00:00Z')).toISOString()).toBe(
        '2027-01-01T00:00:00.000Z',
      );
    });
  });

  describe('额度状态', () => {
    const now = new Date('2026-09-05T12:00:00Z');

    it('免费用户没用过:剩 2,可用', () => {
      const s = quotaStatus('free', 0, now);
      expect(s).toMatchObject({ limit: 2, used: 0, remaining: 2, canConsume: true });
    });

    it('免费用户用了 1:剩 1,可用', () => {
      expect(quotaStatus('free', 1, now).remaining).toBe(1);
      expect(quotaStatus('free', 1, now).canConsume).toBe(true);
    });

    it('免费用户用满 2:剩 0,不可用', () => {
      const s = quotaStatus('free', 2, now);
      expect(s.remaining).toBe(0);
      expect(s.canConsume).toBe(false);
    });

    it('PRO 用了 2 仍可用(免费此时已满)', () => {
      expect(quotaStatus('pro', 2, now).canConsume).toBe(true);
      expect(quotaStatus('pro', 2, now).remaining).toBe(18);
    });

    it('PRO 用满 20 不可用', () => {
      expect(quotaStatus('pro', 20, now).canConsume).toBe(false);
    });

    // 手动降级(PRO→免费)后用量可能超过新上限,剩余必须夹到 0,不能出负数
    it('用量超过上限时剩余夹到 0', () => {
      const s = quotaStatus('free', 7, now);
      expect(s.remaining).toBe(0);
      expect(s.canConsume).toBe(false);
    });

    it('带出本期起点与下次重置时间', () => {
      const s = quotaStatus('free', 0, now);
      expect(s.periodStart.toISOString()).toBe('2026-09-01T00:00:00.000Z');
      expect(s.resetsAt.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    });
  });
});
