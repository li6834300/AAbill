# 014 商品译名跟随账单语言

接 013。013 做的是**界面**语言,这篇做**商品译名**的语言。

## 决策回顾

用户选了方案 B:切界面语言**不**重译已识别的商品名,要换语言得重新识别整张发票。
理由是省 token —— 识别一张 42 行的发票不便宜,为切个语言重跑不值。

我在实现时补了一个折中:**界面文案与商品译名分开**。
荷兰朋友打开分享链接,按钮、提示、错误信息都是荷兰语(跟他自己的设置),
只有商品译名跟账单走。否则「译名跟账单」会连带把整个界面也锁死在创建者的语言上。

## 先写的测试

`server/test/translation-lang.test.ts`(5 例):

- parse 请求带 lang → 透传给 provider,并记在 `bill.translationLang`
- 不给 lang → 默认 `en`。作者是中文用户,但对陌生用户英文是更安全的回落
- **不支持的语言 → 400,不悄悄回落** —— 回落会让用户以为翻译了其实没有
- 换语言重新识别 → 译名与账单语言都跟着换
- 新建未识别的账单 → `translationLang` 为 null

`TranslationLangNotice.test.tsx`(5 例):语言一致或未识别时不打扰;
不一致时说明现状 + 给重新识别入口;识别中不可重复点。

`ai-provider.test.ts` 加了一条:目标语言必须真的进 prompt,不传则为英文。

## 命名:nameZh → nameTranslated

`nameZh` 这个名字本身就是个错误假设 —— 它假定译名一定是中文。
全仓库改名 52 处,迁移 `0005` 把 `items.name_zh` 改成 `name_translated`,
并给存量账单回填 `translation_lang = 'zh'`(那些译名确实是中文时代产生的)。

## mock 也要遵守语言

第一版 mock parser 无视 lang 返回固定中文,结果本地开发看到
「荷兰语账单配中文商品名」—— 真实 provider 不会有的假象。
改成按语言给译名(四语各一套),本地开发所见即所得。

## 语言名不手写

「界面为中文时,'de' 显示成"德语"」这种 4×4 对照表同样交给 `Intl.DisplayNames`
(type: 'language')。和 013 的国名一个路子。

## 实测

界面荷兰语、账单以英文识别时,详情页出现蓝色提示条:
「De artikelnamen op deze bon zijn vertaald naar het Engels, anders dan je schermtaal.」
下面一行可点:「Bon opnieuw scannen om naar het Nederlands te vertalen」。
商品名显示 Aluminium foil / Chicken thighs(英文,与账单一致),
而界面其余部分是荷兰语 —— 正是设计意图。控制台无错误。

API 层四种语言逐一验过:nl → Aluminiumfolie / Kippenbouten / Scharreleieren,
de → Alufolie / Hähnchenschenkel / Freilandeier,zh/en 同理;`lang=fr` 返回 400。
