import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { householdColorAt } from '../../lib/household-color';
import { color, radius } from '../../theme/tokens';
import { Text } from './Text';

/** 取名字首个可见字符(中文取首字,拉丁取首字母大写) */
function initial(name: string): string {
  const ch = [...name.trim()][0] ?? '?';
  return /[a-z]/i.test(ch) ? ch.toUpperCase() : ch;
}

/**
 * 家庭头像:圆形色块 + 首字。颜色按家庭在 bill.families 里的序号稳定分配,
 * 于是同一家在认领页、FamilyChips、汇总表里都是同一个颜色。
 *
 * face:把色块变成一张小脸(白点眼 + 微笑),让每个家庭成为一个小 character
 * —— Headspace 的彩色小人思路,但落在"家庭"上,是我们自己的。名字另有文字显示时用它最合适。
 */
export function Avatar({
  name,
  index,
  size = 36,
  dotOnly = false,
  face = false,
}: {
  name: string;
  /** 家庭序号,决定颜色 */
  index: number;
  size?: number;
  /** 只显示小圆点(用于条目行的"谁领了"标记) */
  dotOnly?: boolean;
  /** 显示一张小脸而非首字(名字在旁边另有文字时用) */
  face?: boolean;
}) {
  const bg = householdColorAt(index);
  if (dotOnly) {
    return (
      <View
        accessibilityLabel={name}
        style={{
          width: size,
          height: size,
          borderRadius: radius.pill,
          backgroundColor: bg,
        }}
      />
    );
  }
  return (
    <View
      accessibilityLabel={name}
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
        },
      ]}
    >
      {face ? (
        <Svg width={size} height={size} viewBox="0 0 36 36">
          <Circle cx={13.5} cy={15} r={2.3} fill={color.inkInverse} />
          <Circle cx={22.5} cy={15} r={2.3} fill={color.inkInverse} />
          <Path
            d="M13 22 Q18 27 23 22"
            fill="none"
            stroke={color.inkInverse}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </Svg>
      ) : (
        <Text
          style={[
            styles.initial,
            { fontSize: size * 0.42, color: color.inkInverse },
          ]}
        >
          {initial(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontWeight: '700' },
});
