import type { Bill, Claim, Family, Item } from '@aabill/api-types';
import type { Pool, PoolClient } from 'pg';
import type { BillRepo } from '../repo.js';

// 仓储实现:BillRepo 是整单粒度接口,save 用「先删子表再重插」的事务全量同步。
// 账单只有几十行,简单正确优先;真到性能瓶颈再做差量。

interface BillRow {
  id: string;
  owner_id: string;
  title: string;
  status: Bill['status'];
  tax_country: Bill['taxCountry'];
  translation_lang: Bill['translationLang'];
  tax_rate_a_bp: number | null;
  tax_rate_b_bp: number | null;
  share_token: string;
  invoice_url: string | null;
  invoice_net_cents: number | null;
  invoice_vat_a_cents: number | null;
  invoice_vat_b_cents: number | null;
  invoice_gross_cents: number | null;
  created_at: Date;
}

export function createPostgresRepo(pool: Pool): BillRepo {
  async function loadChildren(billId: string): Promise<{
    families: Family[];
    items: Item[];
    claims: Claim[];
  }> {
    const [families, items, claims] = await Promise.all([
      pool.query(
        'select id, name, sort_order from families where bill_id = $1 order by sort_order',
        [billId],
      ),
      pool.query('select * from items where bill_id = $1 order by position', [
        billId,
      ]),
      pool.query(
        'select * from claims where bill_id = $1 order by updated_at, id',
        [billId],
      ),
    ]);
    return {
      families: families.rows.map((r) => ({
        id: r.id as string,
        name: r.name as string,
        sortOrder: r.sort_order as number,
      })),
      items: items.rows.map((r): Item => ({
        id: r.id as string,
        name: r.name as string,
        nameTranslated: r.name_translated as string,
        qtyMilli: r.qty_milli as number,
        unit: r.unit as string,
        unitPriceMilli: r.unit_price_milli as number,
        taxClass: r.tax_class as Item['taxClass'],
        isShared: r.is_shared as boolean,
        source: r.source as Item['source'],
        ...(r.printed_line_net_cents !== null && {
          printedLineNetCents: r.printed_line_net_cents as number,
        }),
      })),
      claims: claims.rows.map((r): Claim => ({
        id: r.id as string,
        itemId: r.item_id as string,
        familyId: r.family_id as string,
        portion: r.portion as number,
        updatedAt: (r.updated_at as Date).toISOString(),
      })),
    };
  }

  async function rowToBill(row: BillRow): Promise<Bill> {
    const children = await loadChildren(row.id);
    return {
      id: row.id,
      ownerId: row.owner_id,
      title: row.title,
      taxCountry: row.tax_country,
      translationLang: row.translation_lang,
      taxRates:
        row.tax_rate_a_bp === null || row.tax_rate_b_bp === null
          ? null
          : { A: row.tax_rate_a_bp, B: row.tax_rate_b_bp },
      status: row.status,
      createdAt: row.created_at.toISOString(),
      shareToken: row.share_token,
      invoiceUrl: row.invoice_url,
      printedTotals:
        row.invoice_gross_cents === null
          ? null
          : {
              netCents: row.invoice_net_cents ?? 0,
              vatByClass: {
                A: row.invoice_vat_a_cents ?? 0,
                B: row.invoice_vat_b_cents ?? 0,
              },
              grossCents: row.invoice_gross_cents,
            },
      ...children,
    };
  }

  async function writeChildren(client: PoolClient, bill: Bill): Promise<void> {
    await client.query('delete from claims where bill_id = $1', [bill.id]);
    await client.query('delete from items where bill_id = $1', [bill.id]);
    await client.query('delete from families where bill_id = $1', [bill.id]);
    for (const f of bill.families) {
      await client.query(
        'insert into families (id, bill_id, name, sort_order) values ($1, $2, $3, $4)',
        [f.id, bill.id, f.name, f.sortOrder],
      );
    }
    for (const [position, i] of bill.items.entries()) {
      await client.query(
        `insert into items
           (id, bill_id, position, name, name_translated, qty_milli, unit,
            unit_price_milli, printed_line_net_cents, tax_class, is_shared, source)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          i.id,
          bill.id,
          position,
          i.name,
          i.nameTranslated,
          i.qtyMilli,
          i.unit,
          i.unitPriceMilli,
          i.printedLineNetCents ?? null,
          i.taxClass,
          i.isShared,
          i.source,
        ],
      );
    }
    for (const cl of bill.claims) {
      await client.query(
        'insert into claims (id, bill_id, item_id, family_id, portion, updated_at) values ($1, $2, $3, $4, $5, $6)',
        [cl.id, bill.id, cl.itemId, cl.familyId, cl.portion, cl.updatedAt],
      );
    }
  }

  async function upsert(bill: Bill): Promise<Bill> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `insert into bills
           (id, owner_id, title, status, tax_country, share_token, invoice_url,
            invoice_net_cents, invoice_vat_a_cents, invoice_vat_b_cents,
            invoice_gross_cents, created_at, tax_rate_a_bp, tax_rate_b_bp,
            translation_lang)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         on conflict (id) do update set
           title = excluded.title,
           status = excluded.status,
           tax_country = excluded.tax_country,
           tax_rate_a_bp = excluded.tax_rate_a_bp,
           tax_rate_b_bp = excluded.tax_rate_b_bp,
           translation_lang = excluded.translation_lang,
           invoice_url = excluded.invoice_url,
           invoice_net_cents = excluded.invoice_net_cents,
           invoice_vat_a_cents = excluded.invoice_vat_a_cents,
           invoice_vat_b_cents = excluded.invoice_vat_b_cents,
           invoice_gross_cents = excluded.invoice_gross_cents`,
        [
          bill.id,
          bill.ownerId,
          bill.title,
          bill.status,
          bill.taxCountry,
          bill.shareToken,
          bill.invoiceUrl,
          bill.printedTotals?.netCents ?? null,
          bill.printedTotals?.vatByClass.A ?? null,
          bill.printedTotals?.vatByClass.B ?? null,
          bill.printedTotals?.grossCents ?? null,
          bill.createdAt,
          bill.taxRates?.A ?? null,
          bill.taxRates?.B ?? null,
          bill.translationLang,
        ],
      );
      await writeChildren(client, bill);
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
    return bill;
  }

  // 路径参数可能不是合法 uuid,PG 对非法 uuid 是报错而非查不到
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  return {
    create: upsert,
    save: upsert,
    async get(id) {
      if (!UUID_RE.test(id)) return undefined;
      const { rows } = await pool.query<BillRow>(
        'select * from bills where id = $1',
        [id],
      );
      return rows[0] ? rowToBill(rows[0]) : undefined;
    },
    async getByToken(shareToken) {
      const { rows } = await pool.query<BillRow>(
        'select * from bills where share_token = $1',
        [shareToken],
      );
      return rows[0] ? rowToBill(rows[0]) : undefined;
    },
    async list() {
      const { rows } = await pool.query<BillRow>(
        'select * from bills order by created_at desc',
      );
      return Promise.all(rows.map(rowToBill));
    },
  };
}
