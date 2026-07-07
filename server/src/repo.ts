import type { Bill } from '@aabill/api-types';

/** 账单仓储接口:MVP 用内存实现,Postgres(Neon)在部署期接线(ADR 0004)。 */
export interface BillRepo {
  create(bill: Bill): Promise<Bill>;
  get(id: string): Promise<Bill | undefined>;
  list(): Promise<Bill[]>;
  save(bill: Bill): Promise<Bill>;
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
    async list() {
      return [...bills.values()];
    },
    async save(bill) {
      bills.set(bill.id, bill);
      return bill;
    },
  };
}
