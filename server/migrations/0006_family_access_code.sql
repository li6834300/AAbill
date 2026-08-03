-- 每家一个 5 位数字认领口令(账单内唯一):participant 凭它进入自己那家。
alter table families add column if not exists access_code text;

-- 存量 family 回填账单内唯一的 5 位口令:10000 起按序号递增,账单内不重复。
-- (存量都是开发期测试账单,连号可接受;新建 family 由 server 生成随机码。
--  window function 不能直接用在 UPDATE ... SET,故先用 CTE 算出序号再 join 回写。)
with numbered as (
  select
    id,
    row_number() over (partition by bill_id order by sort_order, id) - 1 as seq
  from families
  where access_code is null
)
update families f
set access_code = lpad((10000 + n.seq)::text, 5, '0')
from numbered n
where f.id = n.id;
