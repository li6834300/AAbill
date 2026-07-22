-- 税率不再由国家反查:发票上印的实际税率才是权威(国家表会过时)。
-- 单位基点:19% = 1900。两列同时为空 = 尚未确定,校验/结算被挡下。
alter table bills add column if not exists tax_rate_a_bp int;
alter table bills add column if not exists tax_rate_b_bp int;

-- 存量账单:按其国家回填兜底税率,不影响已有分账。
update bills set tax_rate_a_bp = 1900, tax_rate_b_bp = 700
  where tax_country = 'DE' and tax_rate_a_bp is null;
update bills set tax_rate_a_bp = 2100, tax_rate_b_bp = 900
  where tax_country = 'NL' and tax_rate_a_bp is null;

-- 国家清单从 2 国扩到 30 国,旧的 CHECK 约束必须去掉。
alter table bills drop constraint if exists bills_tax_country_check;
