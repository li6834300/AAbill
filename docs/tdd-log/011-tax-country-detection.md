# 011 税制自动识别

## 起因

用户反馈:「账单准备页面,上传发票之前,现在是让用户提前选择税制,而且只有 NL 和 DE,这个有点 dumb,
税制应该要可以从发票直接识别出来,识别不出来的话,再让用户手动选择。」

确实 dumb:国家就印在发票上(地址、邮编、USt-IdNr./BTW 税号、税率、货币),
却要用户在**还没看到发票**的时候先猜一个。而且默认值 DE 一旦猜错,
19%/7% 与 21%/9% 的差别会一路错到结算金额,还不容易被发现。

## 验收标准

1. 建单时不必给税制,账单 `taxCountry` 为 `null`(待定)。
2. 识别发票时 AI 一并读出国家;读出 DE/NL 就直接采用。
3. AI 读不出(UNKNOWN)→ 保持 `null`,由用户在详情页补选。
4. 用户已确定的税制,**重新识别不覆盖** —— 人工判断优先于模型。
5. 税制未定时,`validate` / `settlement` / `lock` 一律 409(税率无从取,不能算错)。
6. 旧用法(建单时显式给 taxCountry)仍兼容。

## 先写的测试

- `server/test/tax-detect.test.ts`(8 个用例,覆盖上述 1–6 与 `PUT /bills/:id/tax-country`
  的 200/400/404)。红着提交,再写实现。
- `apps/mobile/components/__tests__/TaxCountryPicker.test.tsx`:已确定 → 安静显示不打扰;
  未确定 → 提示 + DE/NL 两个选项;选择回传国家码;提交中禁止重复点击。

## 关键取舍

**`detectedTaxCountry` 设为必填而非可选。** OpenAI structured outputs 的 strict 模式
要求 schema 里所有字段必填,可选字段会被拒。所以让模型显式说 `UNKNOWN`,
而不是省略字段 —— 顺带也逼着 prompt 明确「证据不足就说不知道,不要猜」。

**税率取不到时选择 409 而不是回退默认值。** 早期版本默认 DE,猜错也照算不误。
金额算错却不报错,是这个项目最不能接受的失败模式;宁可挡住,让用户补一次选择。

**认领页(Participant)税制未定时只显示净额。** 参与者看不到「预计应付」的含税数
总比看到一个用错税率算出来的数好;文案明说「发起人尚未确定税制」。

## AI 输出被人否决/修正的点

- 我最初把 `bill.taxCountry` 在 parse 时无条件覆盖为识别结果。测试
  「用户已手动设定的税制,重新识别不覆盖」把这个行为挡了下来 —— 用户重传一张
  拍糊的发票,不该把他手动纠正过的税制冲掉。
- `ParsedReceiptSchema` 加字段后,`server/src/ai/mock.ts` 与两处测试夹具同时红了。
  这正是共享 schema 应有的效果:契约变更无处可藏。

## 迁移

`server/migrations/0003_tax_country_nullable.sql` 去掉 `bills.tax_country` 的 NOT NULL。
启动时自动应用(`_migrations` 表记账,幂等)。存量账单的税制不受影响。
