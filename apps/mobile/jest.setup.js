/* global jest */
// 组件测试固定用中文界面,断言才有确定的文案可比。
// i18n 自身的语言探测逻辑由 lib/__tests__/i18n.test.ts 单独覆盖(它会隔离模块)。
const { setLang } = require('./lib/i18n');
setLang('zh');

// 隔离渲染(RNTL)时没有 SafeAreaProvider,useSafeAreaInsets 会抛错。
// 生产里由 expo-router 的 ExpoRoot 提供;测试里给一份零 inset,让用 Screen/StickyBar/Toast 的组件可单测。
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});
