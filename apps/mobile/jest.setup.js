// 组件测试固定用中文界面,断言才有确定的文案可比。
// i18n 自身的语言探测逻辑由 lib/__tests__/i18n.test.ts 单独覆盖(它会隔离模块)。
const { setLang } = require('./lib/i18n');
setLang('zh');
