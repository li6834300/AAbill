# 003: M3 —— Owner 分账页闭环(Expo Router + RNTL)

日期:2026-07-07 · 分支:m2-parse(组件测试先行;页面为薄壳装配,按 PRD 由 Maestro 冒烟覆盖,后补)

## 验收标准(PRD A2/A4/B2/B3)

- 校验横幅:对上=绿色确认;差额逐项显示(欧元),隐藏为 0 的项
- 条目行:展示名称/中文名/数量×单价/行净额(行净额调 core 的 itemNetCents);
  编辑合并为一次 PATCH,非法输入不提交该字段;均摊开关;删除
- 家庭 chips:真实名字增删,空输入不触发
- 页面:列表/新建 → 详情(识别、合计录入+校验、条目校对、家庭)

## 红 → 绿

- `test: mobile 组件`(15 例,RNTL)→ 实现四个纯组件 → 全绿
- 页面装配后在本地预览实测:mock 识别 → 3 条目(含中文名、AI 标记)→
  合计自动入库 → 绿色「与发票合计一致」→ 均摊开关/家庭添加均落库

## 环境坑(记录给后来者)

1. **RNTL 安装**:react-test-renderer 必须与 react 精确同版(19.2.3),否则 ERESOLVE
2. **TS6 不吃 @types/jest 全局**:改为测试文件显式 `import {...} from '@jest/globals'`,更干净
3. **ESM `.js` 后缀导入**:jest 用 moduleNameMapper 映射;Metro 根本不解析——最终把 core 源码
   相对导入的 `.js` 后缀去掉(moduleResolution: Bundler 下三方工具链统一),一处根治

## 学到的

monorepo 里「workspace 包被 RN 直接吃 TS 源码」很省事,但模块后缀风格必须迁就
最挑剔的消费者(Metro)。组件测试写在装配之前,页面只是接线,几乎没有回修。
