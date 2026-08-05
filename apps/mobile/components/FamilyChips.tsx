import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLang } from '../lib/use-lang';
import { space } from '../theme/tokens';
import { Avatar, Button, Chip, Input } from './ui';

export interface FamilyView {
  id: string;
  name: string;
  sortOrder: number;
}

/** PRD B2:参与分账的家庭,用真实名字。每家一个稳定的身份色头像。 */
export function FamilyChips({
  families,
  onAdd,
  onRemove,
}: {
  families: FamilyView[];
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useLang();
  const [name, setName] = useState('');
  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName('');
  };
  return (
    <View style={styles.wrap}>
      {families.length > 0 && (
        <View style={styles.chips}>
          {families.map((f, i) => (
            <Chip
              key={f.id}
              label={f.name}
              leading={<Avatar name={f.name} index={i} size={22} />}
              onRemove={() => onRemove(f.id)}
              removeTestID={`remove-family-${f.id}`}
            />
          ))}
        </View>
      )}
      <View style={styles.addRow}>
        <Input
          testID="family-input"
          style={styles.flex}
          value={name}
          onChangeText={setName}
          placeholder={t('family.placeholder')}
          onSubmitEditing={add}
        />
        <Button label={t('common.add')} onPress={add} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  addRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  flex: { flex: 1 },
});
