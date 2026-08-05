import React from 'react';
import { Platform } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { color } from '../../theme/tokens';

export type MascotPose = 'default' | 'scan' | 'happy';

/**
 * 小票君 —— App 的吉祥物。一张会笑的小票:圆角顶、锯齿撕边、脸 + 三条商品行
 * (最后一行绿色代表合计)。手写 SVG,不是栅格图,颜色跟随 token。
 *
 * 这是我们自己的 character(不是 Headspace 那颗笑脸头):数字化的对象本身就是小票,
 * 让小票开口笑,既贴题又独一份。
 *
 * pose:default 微笑 / scan 拿放大镜(空发票态) / happy 眯眼笑 + 阳光黄星星(完成态)。
 */
export function ReceiptMascot({
  size = 120,
  pose = 'default',
  title,
}: {
  size?: number;
  pose?: MascotPose;
  title?: string;
}) {
  const a11y = title
    ? { accessibilityRole: 'image' as const, accessibilityLabel: title }
    : Platform.select({
        web: { 'aria-hidden': true } as Record<string, unknown>,
        default: {
          accessibilityElementsHidden: true,
          importantForAccessibility: 'no' as const,
        },
      });
  return (
    <Svg
      width={size}
      height={size * (116 / 100)}
      viewBox="0 0 100 116"
      {...a11y}
    >
      {/* 身体:圆角顶 + 锯齿撕边底 */}
      <Path
        d="M24 22 Q24 14 32 14 H68 Q76 14 76 22 V96 l-6.5 6 l-6.5 -6 l-6.5 6 l-6.5 -6 l-6.5 6 l-6.5 -6 l-6.5 6 l-6.5 -6 Z"
        fill={color.surface}
        stroke={color.border}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {/* 商品行(最后一行绿色=合计) */}
      <Rect
        x={34}
        y={70}
        width={32}
        height={3.5}
        rx={1.75}
        fill={color.hairline}
      />
      <Rect
        x={34}
        y={78}
        width={24}
        height={3.5}
        rx={1.75}
        fill={color.hairline}
      />
      <Rect
        x={34}
        y={86}
        width={20}
        height={3.5}
        rx={1.75}
        fill={color.primary}
      />

      {/* 脸 */}
      <G>
        {pose === 'happy' ? (
          <>
            <Path
              d="M37 45 Q41 41 45 45"
              fill="none"
              stroke={color.inkDisplay}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <Path
              d="M55 45 Q59 41 63 45"
              fill="none"
              stroke={color.inkDisplay}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <Path
              d="M41 52 Q50 61 59 52"
              fill="none"
              stroke={color.inkDisplay}
              strokeWidth={3}
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <Circle cx={41} cy={44} r={3} fill={color.inkDisplay} />
            <Circle cx={59} cy={44} r={3} fill={color.inkDisplay} />
            <Path
              d="M42 53 Q50 60 58 53"
              fill="none"
              stroke={color.inkDisplay}
              strokeWidth={3}
              strokeLinecap="round"
            />
          </>
        )}
        {/* 腮红 */}
        <Circle cx={35} cy={50} r={2.4} fill={color.accent} opacity={0.45} />
        <Circle cx={65} cy={50} r={2.4} fill={color.accent} opacity={0.45} />
      </G>

      {/* scan:放大镜 */}
      {pose === 'scan' && (
        <G>
          <Circle
            cx={70}
            cy={80}
            r={11}
            fill="none"
            stroke={color.primary}
            strokeWidth={4}
          />
          <Path
            d="M78 88 L88 98"
            stroke={color.primary}
            strokeWidth={5}
            strokeLinecap="round"
          />
        </G>
      )}

      {/* happy:阳光黄星星 */}
      {pose === 'happy' && (
        <G>
          <Sparkle cx={20} cy={26} r={5} />
          <Sparkle cx={82} cy={34} r={6.5} />
          <Sparkle cx={26} cy={92} r={4} />
        </G>
      )}
    </Svg>
  );
}

/** 四角星,阳光黄 */
function Sparkle({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <Path
      d={`M${cx} ${cy - r} Q${cx + r * 0.18} ${cy - r * 0.18} ${cx + r} ${cy} Q${cx + r * 0.18} ${cy + r * 0.18} ${cx} ${cy + r} Q${cx - r * 0.18} ${cy + r * 0.18} ${cx - r} ${cy} Q${cx - r * 0.18} ${cy - r * 0.18} ${cx} ${cy - r} Z`}
      fill={color.sunbeam}
    />
  );
}
