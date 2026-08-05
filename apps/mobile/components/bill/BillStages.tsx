import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { STAGES, type Stage } from '../../lib/bill-stage';
import { useLang } from '../../lib/use-lang';
import { color, space } from '../../theme/tokens';
import { Text } from '../ui';
import { Check } from '../icons';

/**
 * 顶部步骤条:扫发票 → 校对 → 分享 → 汇总。
 * 已完成的步骤打勾且可点(回看/重开);当前步高亮;未到的步灰着不可点。
 */
export function BillStages({
  current,
  viewing,
  onSelect,
}: {
  /** 由数据推导的当前阶段 */
  current: Stage;
  /** 正在查看的阶段(可能是已完成的早期阶段) */
  viewing: Stage;
  onSelect: (stage: Stage) => void;
}) {
  const { t } = useLang();
  const currentIdx = STAGES.indexOf(current);

  return (
    <View style={styles.row}>
      {STAGES.map((stage, i) => {
        const done = i < currentIdx;
        const active = stage === viewing;
        const reachable = i <= currentIdx;
        const label = t(`stage.${stage}` as 'stage.scan');
        return (
          <React.Fragment key={stage}>
            {i > 0 && (
              <View
                style={[
                  styles.connector,
                  i <= currentIdx && styles.connectorDone,
                ]}
              />
            )}
            <Pressable
              onPress={() => reachable && onSelect(stage)}
              disabled={!reachable}
              style={styles.step}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled: !reachable }}
            >
              <View
                style={[
                  styles.dot,
                  done && styles.dotDone,
                  active && styles.dotActive,
                ]}
              >
                {done ? (
                  <Check size={16} color={color.inkInverse} />
                ) : (
                  <Text
                    variant="label"
                    style={{
                      color: active ? color.inkInverse : color.inkFaint,
                    }}
                  >
                    {i + 1}
                  </Text>
                )}
              </View>
              <Text
                variant="muted"
                tone={active ? 'default' : reachable ? 'muted' : 'faint'}
                numberOfLines={1}
                style={styles.label}
              >
                {label}
              </Text>
            </Pressable>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const DOT = 30;
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { alignItems: 'center', gap: space.xs, width: 60 },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.canvasSunk,
    borderWidth: 1,
    borderColor: color.border,
  },
  dotDone: { backgroundColor: color.primary, borderColor: color.primary },
  dotActive: { backgroundColor: color.primary, borderColor: color.primary },
  label: { textAlign: 'center' },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: color.border,
    marginTop: DOT / 2 - 1,
  },
  connectorDone: { backgroundColor: color.primary },
});
