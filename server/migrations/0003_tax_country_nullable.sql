-- 税制改为「识别时确定」:建单时还没看到发票,允许留空。
alter table bills alter column tax_country drop not null;
