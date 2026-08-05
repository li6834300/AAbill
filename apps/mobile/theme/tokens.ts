import { Platform, type TextStyle } from 'react-native';

/**
 * 「集市纸 / Market Paper」设计令牌。
 *
 * 这个 App 数字化的实物是一张超市小票,发生的场景是朋友之间分钱 —— 后者天然尴尬。
 * 所以基调是**暖纸而非诊所白**:大圆角、一种表示"去做"的绿、颜色只作标点不作装饰。
 *
 * RN 没有 CSS 层,令牌只能是普通 TS 模块,在 StyleSheet.create 里引用。
 */

// ── 颜色 ────────────────────────────────────────────────────────────────

export const color = {
  /** 冷调近白 —— 全局默认底色(去黄、去暖,干净不像模板) */
  canvas: '#F6F6F4',
  /** 下沉面:表头行、折叠起来的步骤条 */
  canvasSunk: '#EDEEEB',
  /** 卡片、输入框、弹层 */
  surface: '#FFFFFF',
  /** 分隔线、表格线 */
  hairline: '#E7E7E4',
  /** 输入框与卡片描边 */
  border: '#DADAD6',

  /** 仅用于展示级标题 —— 冷调近黑 */
  inkDisplay: '#141517',
  /** 正文 */
  ink: '#1B1C1E',
  /** 次级文字、标签 */
  inkMuted: '#6B6E73',
  /** 提示、placeholder、禁用 */
  inkFaint: '#9A9CA1',
  /** 实心按钮上的文字 */
  inkInverse: '#FFFFFF',

  /** 主色:所有主要动作(沿用品牌绿) */
  primary: '#0B7A5B',
  /** 贴纸投影的下沿 + 按下态 */
  primaryDeep: '#07543E',
  /** 选中面、成功提示底 */
  primaryTint: '#E6F2EC',

  /** 琥珀:"需要你处理"、尾差、警告(略收黄,偏橙) */
  accent: '#E8912A',
  /** accentTint 上的文字(纯 accent 当文字对比度不够) */
  accentInk: '#7A4A12',
  accentTint: '#FAEEDD',

  /** 阳光黄:AI 魔法时刻 + 值得庆祝的瞬间(参考 Headspace 的招牌黄,克制点缀) */
  sunbeam: '#FFCE00',
  /** sunbeamTint 上的文字 */
  sunbeamInk: '#5C4A00',
  sunbeamTint: '#FFF3C4',

  /** 陶土红:错误与冲突 */
  danger: '#C1442E',
  dangerTint: '#FAE9E5',

  /** 弹层背景遮罩 */
  scrim: 'rgba(20, 21, 23, 0.45)',
} as const;

/**
 * 家庭身份色。多家同时认领时,一眼看出哪样东西是谁拿的。
 *
 * 刻意**不包含** primary/accent/danger —— 家庭若能被渲染成和主按钮一样的绿、
 * 或和报错一样的红,语义色就不再有语义了。
 */
export const householdColor = [
  '#2E6FB4', // blue
  '#7A4E9E', // plum
  '#C2185B', // rose
  '#0E7C7B', // teal
  '#A2662A', // ochre
  '#4A6B2A', // olive
] as const;

// ── 间距与形状 ──────────────────────────────────────────────────────────

/** 4 的倍数 */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
  giant: 64,
} as const;

export const radius = {
  /** 小圆点、迷你 chip */
  xs: 6,
  /** 输入框、加减控件 */
  sm: 10,
  /** 卡片、提示条 */
  md: 14,
  /** 弹层、大特写卡 */
  lg: 20,
  /** 胶囊按钮 */
  pill: 999,
} as const;

/**
 * 「贴纸按下」—— 本设计系统的签名交互。
 *
 * 深度来自**同色系更深的下边框**,不是投影:RN 的 shadow* 属性在 iOS / Android /
 * web 上表现各不相同,而 borderBottomWidth 三端完全一致,且零成本。
 * 按下时下沿收到 1px、整体下移 2px,视觉上就是把贴纸按扁了。
 */
export const sticker = {
  restBorderWidth: 3,
  pressedBorderWidth: 1,
  pressedTranslateY: 2,
} as const;

// ── 字体 ────────────────────────────────────────────────────────────────

/**
 * Plus Jakarta Sans 里没有中文字形,而本 App 是中文优先(测试固定 zh、界面全是中文)。
 * 所以**绝不设全局 fontFamily** —— 安卓上会渲染成豆腐块。自定义字体只贴在它真正
 * 擅长、且内容必为拉丁/数字的地方:金额、数量、德文商品名。中文正文/标题留系统字体
 * (仍然吃到新的字号与字距,只是字族不变)。
 *
 * 已核实(见 plan §6):PJS 带 tnum 表(DM Sans 没有),tabular-nums 生效;
 * web 端要带系统回退串,原生端只给字族名。
 */
const pjs = (weight: 'Regular' | 'Medium' | 'SemiBold' | 'Bold'): string =>
  `PlusJakartaSans_${weight === 'Regular' ? '400' : weight === 'Medium' ? '500' : weight === 'SemiBold' ? '600' : '700'}${weight}`;

const withWebFallback = (family: string): string =>
  Platform.OS === 'web' ? `${family}, system-ui, sans-serif` : family;

export const fontFamily = {
  regular: pjs('Regular'),
  medium: pjs('Medium'),
  semibold: pjs('SemiBold'),
  bold: pjs('Bold'),
} as const;

/**
 * 数字排版片段 —— 在 Money 原语和任何金额/数量 Text 上展开。
 * tabular-nums 只能用数组形式(RN 类型层唯一合法写法),必须逐处显式设置。
 */
export const numericFont: TextStyle = {
  fontFamily: withWebFallback(fontFamily.semibold),
  fontVariant: ['tabular-nums'],
};

/**
 * 展示级片段 —— 只用在内容必为拉丁/数字的大标题(账单标题、汇总总额)。
 * 中文区块标题不要用它,交给系统字体。
 */
export const displayFont: TextStyle = {
  fontFamily: withWebFallback(fontFamily.bold),
};

/**
 * 字号阶梯。**只含字号/字重/字距,不含字族** —— 中文安全,处处可用。
 * letterSpacing 在 RN 里是 px 不是 em,这里是换算后的绝对值
 * (如 display 32px × -0.03em = -0.96)。字号越大收得越紧 —— 品牌识别点,
 * 标题不靠加粗喊,靠收紧塑形。
 */
export const type = {
  /** 账单标题、汇总总额 */
  display: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -0.96,
  },
  /** 步骤标题、区块标题 */
  heading: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  /** 卡片标题、商品名 */
  subhead: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '600',
    letterSpacing: -0.17,
  },
  /** 正文 —— 新基准(旧代码依赖 RN 默认的 14,偏小) */
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: -0.16,
  },
  /** 按钮、chip、表单标签 */
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: 0,
  },
  /** 副行、提示 */
  muted: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: 0,
  },
  /** 条目金额 */
  money: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: 0,
  },
  /** 底栏合计、汇总总额 */
  moneyLg: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.56,
  },
} as const satisfies Record<string, TextStyle>;

// ── 布局 ────────────────────────────────────────────────────────────────

export const layout = {
  /** 屏幕左右留白 */
  gutter: space.base,
  /** 大区块之间 */
  sectionGap: space.xxl,
  /** 卡片内边距 */
  cardPadding: space.base,
  /** web 上内容不要拉满超宽屏 */
  maxContentWidth: 720,
} as const;
