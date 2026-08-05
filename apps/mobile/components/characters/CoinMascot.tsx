import React from 'react';
import { Platform } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { color } from '../../theme/tokens';

/**
 * 硬币君 —— 结算/汇总时刻的小伙伴。一枚会笑的欧元硬币,阳光黄外圈 + 绿色 €。
 * 和小票君同一套画风(圆脸、点眼、微笑),色调用阳光黄点睛。
 */
export function CoinMascot({
  size = 96,
  title,
}: {
  size?: number;
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
    <Svg width={size} height={size} viewBox="0 0 100 100" {...a11y}>
      {/* 外圈 + 内盘 */}
      <Circle cx={50} cy={52} r={40} fill={color.sunbeam} />
      <Circle cx={50} cy={52} r={31} fill={color.sunbeamTint} />
      {/* € 淡描,做背景纹样 */}
      <Path
        d="M60 40 Q46 34 42 52 Q46 70 60 64 M34 48 H52 M34 56 H50"
        fill="none"
        stroke={color.sunbeam}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.55}
      />
      {/* 脸 */}
      <G>
        <Circle cx={42} cy={50} r={3} fill={color.inkDisplay} />
        <Circle cx={58} cy={50} r={3} fill={color.inkDisplay} />
        <Path
          d="M43 59 Q50 66 57 59"
          fill="none"
          stroke={color.inkDisplay}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Circle cx={36} cy={57} r={2.4} fill={color.accent} opacity={0.5} />
        <Circle cx={64} cy={57} r={2.4} fill={color.accent} opacity={0.5} />
      </G>
    </Svg>
  );
}
