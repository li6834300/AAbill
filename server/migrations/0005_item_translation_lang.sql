-- 商品译名不再假定是中文:跟着账单的译名语言走(识别时定下)。
alter table items rename column name_zh to name_translated;
alter table bills add column if not exists translation_lang text;

-- 存量账单的译名都是中文时代产生的
update bills set translation_lang = 'zh'
  where translation_lang is null
    and exists (select 1 from items where items.bill_id = bills.id);
