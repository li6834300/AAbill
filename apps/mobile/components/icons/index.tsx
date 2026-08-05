import React from 'react';
import { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';
import { Icon, type IconProps } from './Icon';

// 手写图标集,替换散落在各处的 Unicode 字形(› × − ＋ ☑ ☐ ▾ ⚠️ ✓ ↗ 📷)。
// 全部 24×24 viewBox、圆头描边,填充式的用 currentColor,契合暖纸圆润气质。
// 描边宽度统一 2,圆角端点 —— 与"贴纸/小票"的手作感一致。

const S = {
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** › 列表项进入 */
export const ChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <Polyline points="9 6 15 12 9 18" stroke="currentColor" {...S} />
  </Icon>
);

/** ▾ 下拉展开 */
export const ChevronDown = (p: IconProps) => (
  <Icon {...p}>
    <Polyline points="6 9 12 15 18 9" stroke="currentColor" {...S} />
  </Icon>
);

/** ＋ 加行 / 新建 / 步进加 */
export const Plus = (p: IconProps) => (
  <Icon {...p}>
    <Line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" {...S} />
    <Line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" {...S} />
  </Icon>
);

/** − 步进减 */
export const Minus = (p: IconProps) => (
  <Icon {...p}>
    <Line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" {...S} />
  </Icon>
);

/** × 移除 chip / 关闭 */
export const Close = (p: IconProps) => (
  <Icon {...p}>
    <Line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" {...S} />
    <Line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" {...S} />
  </Icon>
);

/** ✓ 完成 / 已复制 / 校验通过 */
export const Check = (p: IconProps) => (
  <Icon {...p}>
    <Polyline points="20 6 9 17 4 12" stroke="currentColor" {...S} />
  </Icon>
);

/** ☑ 选中的方框 */
export const CheckSquare = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M9 11l3 3L22 4" stroke="currentColor" {...S} />
    <Path
      d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
      stroke="currentColor"
      {...S}
    />
  </Icon>
);

/** ☐ 未选的方框 */
export const Square = (p: IconProps) => (
  <Icon {...p}>
    <Rect
      x="4"
      y="4"
      width="16"
      height="16"
      rx="3"
      stroke="currentColor"
      {...S}
    />
  </Icon>
);

/** ⚠️ 警告 / 冲突 / 需要处理 */
export const Warning = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M12 3.5 1.8 20.5h20.4L12 3.5Z" stroke="currentColor" {...S} />
    <Line x1="12" y1="10" x2="12" y2="14" stroke="currentColor" {...S} />
    <Circle cx="12" cy="17.2" r="1.1" fill="currentColor" />
  </Icon>
);

/** info 蓝色信息提示 */
export const Info = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx="12" cy="12" r="9" stroke="currentColor" {...S} />
    <Line x1="12" y1="11" x2="12" y2="16" stroke="currentColor" {...S} />
    <Circle cx="12" cy="7.8" r="1.1" fill="currentColor" />
  </Icon>
);

/** ↗ 外链(查看原始发票) */
export const External = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M14 4h6v6" stroke="currentColor" {...S} />
    <Line x1="20" y1="4" x2="10" y2="14" stroke="currentColor" {...S} />
    <Path
      d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"
      stroke="currentColor"
      {...S}
    />
  </Icon>
);

/** 复制分享链接 / 汇总文本 */
export const Copy = (p: IconProps) => (
  <Icon {...p}>
    <Rect
      x="9"
      y="9"
      width="12"
      height="12"
      rx="2.5"
      stroke="currentColor"
      {...S}
    />
    <Path
      d="M15 5.5A2.5 2.5 0 0 0 12.5 3H6A2.5 2.5 0 0 0 3.5 5.5V13"
      stroke="currentColor"
      {...S}
    />
  </Icon>
);

/** 分享(系统分享面板) */
export const Share = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx="6" cy="12" r="2.5" stroke="currentColor" {...S} />
    <Circle cx="18" cy="6" r="2.5" stroke="currentColor" {...S} />
    <Circle cx="18" cy="18" r="2.5" stroke="currentColor" {...S} />
    <Line x1="8.2" y1="10.9" x2="15.8" y2="7.1" stroke="currentColor" {...S} />
    <Line x1="8.2" y1="13.1" x2="15.8" y2="16.9" stroke="currentColor" {...S} />
  </Icon>
);

/** 锁定(账单确认锁定) */
export const Lock = (p: IconProps) => (
  <Icon {...p}>
    <Rect
      x="4.5"
      y="10.5"
      width="15"
      height="10"
      rx="2.5"
      stroke="currentColor"
      {...S}
    />
    <Path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="currentColor" {...S} />
  </Icon>
);

/** 小票 / 发票(扫描入口、空状态) */
export const Receipt = (p: IconProps) => (
  <Icon {...p}>
    <Path
      d="M6 3h12v18l-2.4-1.6L13.2 21 12 19.4 10.8 21 8.4 19.4 6 21V3Z"
      stroke="currentColor"
      {...S}
    />
    <Line x1="9" y1="8" x2="15" y2="8" stroke="currentColor" {...S} />
    <Line x1="9" y1="12" x2="15" y2="12" stroke="currentColor" {...S} />
  </Icon>
);

/** 相机(拍照认领 / 上传) */
export const Camera = (p: IconProps) => (
  <Icon {...p}>
    <Path
      d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1-1.6a1 1 0 0 1 .85-.47h4.9a1 1 0 0 1 .85.47l1 1.6h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
      stroke="currentColor"
      {...S}
    />
    <Circle cx="12" cy="12.5" r="3.2" stroke="currentColor" {...S} />
  </Icon>
);

/** 家庭(参与分账的一家) */
export const Household = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M4 11 12 4l8 7" stroke="currentColor" {...S} />
    <Path d="M6 10v9h12v-9" stroke="currentColor" {...S} />
    <Path d="M10 19v-4h4v4" stroke="currentColor" {...S} />
  </Icon>
);

/** ✦ AI 生成标记(译名、拍照建议) */
export const Sparkle = (p: IconProps) => (
  <Icon {...p}>
    <Path
      d="M12 3c.6 3.8 1.7 4.9 5.5 5.5C13.7 9.1 12.6 10.2 12 14c-.6-3.8-1.7-4.9-5.5-5.5C10.3 7.9 11.4 6.8 12 3Z"
      fill="currentColor"
    />
    <Path
      d="M18.5 14c.3 1.7.8 2.2 2.5 2.5-1.7.3-2.2.8-2.5 2.5-.3-1.7-.8-2.2-2.5-2.5 1.7-.3 2.2-.8 2.5-2.5Z"
      fill="currentColor"
    />
  </Icon>
);

export { Icon } from './Icon';
export type { IconProps } from './Icon';
