import React from 'react';
import { Platform } from 'react-native';
import Svg, { type SvgProps } from 'react-native-svg';
import { color as tokenColor } from '../../theme/tokens';

// 装饰性图标要对无障碍隐藏。原生用 accessibilityElementsHidden/importantForAccessibility;
// web 上这两个不是 DOM 属性(react-native-web 会原样漏到 <svg> 触发 React 警告),改用 aria-hidden。
const decorativeProps = Platform.select({
  web: { 'aria-hidden': true } as Record<string, unknown>,
  default: {
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no' as const,
  },
});

export interface IconProps {
  /** 方形边长(px),默认 20 */
  size?: number;
  /** 描边/填充色,默认正文墨色 */
  color?: string;
  /** 无障碍标签;不给则视为装饰性图标 */
  title?: string;
}

/**
 * 图标底座:统一 24×24 viewBox、方形尺寸、currentColor 语义。
 * 各图标只画路径,颜色靠 stroke/fill="currentColor",由这里注入。
 *
 * 手写 SVG 而非图标字体:10 个图标的量,react-native-svg 比 @expo/vector-icons
 * (要额外拉 ~10 个字体 ttf、且重现"图标即文字"的对齐问题)更轻更可控。
 */
export function Icon({
  size = 20,
  color = tokenColor.ink,
  title,
  children,
  ...rest
}: IconProps & { children: React.ReactNode } & SvgProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      color={color}
      fill="none"
      {...(title
        ? { accessibilityRole: 'image', accessibilityLabel: title }
        : decorativeProps)}
      {...rest}
    >
      {children}
    </Svg>
  );
}
