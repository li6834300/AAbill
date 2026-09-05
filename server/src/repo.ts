import type { Bill } from '@aabill/api-types';

/** 账单仓储接口:MVP 用内存实现,Postgres(Neon)在部署期接线(ADR 0004)。 */
export interface BillRepo {
  create(bill: Bill): Promise<Bill>;
  get(id: string): Promise<Bill | undefined>;
  getByToken(shareToken: string): Promise<Bill | undefined>;
  list(): Promise<Bill[]>;
  save(bill: Bill): Promise<Bill>;
  /**
   * 统计某 Owner 自 sinceIso 起已扣额度的账单数(= 本计费期已用次数)。
   * 扣减记在 bill.quotaChargedAt 上,故重识别同一单不会被重复计入。
   */
  countChargedSince(ownerId: string, sinceIso: string): Promise<number>;
}

export function createInMemoryRepo(): BillRepo {
  const bills = new Map<string, Bill>();
  return {
    async create(bill) {
      bills.set(bill.id, bill);
      return bill;
    },
    async get(id) {
      return bills.get(id);
    },
    async getByToken(shareToken) {
      return [...bills.values()].find((b) => b.shareToken === shareToken);
    },
    async list() {
      return [...bills.values()];
    },
    async save(bill) {
      bills.set(bill.id, bill);
      return bill;
    },
    async countChargedSince(ownerId, sinceIso) {
      return [...bills.values()].filter(
        (b) =>
          b.ownerId === ownerId &&
          b.quotaChargedAt !== null &&
          b.quotaChargedAt >= sinceIso,
      ).length;
    },
  };
}
