-- 数据模型按 PRD §5.3;金额一律整数分/千分位(ADR 0003)
create table bills (
  id uuid primary key,
  owner_id text, -- Owner JWT 接入前为空(ADR 0004 待接线)
  title text not null,
  status text not null check (status in ('draft', 'claiming', 'locked')),
  tax_country text not null check (tax_country in ('DE', 'NL')),
  share_token text not null unique,
  invoice_net_cents integer,
  invoice_vat_a_cents integer,
  invoice_vat_b_cents integer,
  invoice_gross_cents integer,
  created_at timestamptz not null
);

create table families (
  id uuid primary key,
  bill_id uuid not null references bills (id) on delete cascade,
  name text not null,
  sort_order integer not null
);

create table items (
  id uuid primary key,
  bill_id uuid not null references bills (id) on delete cascade,
  position integer not null, -- 发票行序,展示顺序
  name text not null,
  name_zh text not null default '',
  qty_milli integer not null,
  unit text not null default 'ST',
  unit_price_milli integer not null,
  printed_line_net_cents integer,
  tax_class text not null check (tax_class in ('A', 'B')),
  is_shared boolean not null default false,
  source text not null check (source in ('ai', 'manual'))
);

create table claims (
  id uuid primary key,
  bill_id uuid not null references bills (id) on delete cascade,
  item_id uuid not null references items (id) on delete cascade,
  family_id uuid not null references families (id) on delete cascade,
  portion integer not null check (portion > 0),
  updated_at timestamptz not null,
  unique (item_id, family_id)
);

create index families_bill_idx on families (bill_id);
create index items_bill_idx on items (bill_id);
create index claims_bill_idx on claims (bill_id);
