import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export interface FamilyView {
  id: string;
  name: string;
  sortOrder: number;
}

/** PRD B2:参与分账的家庭,用真实名字。 */
export function FamilyChips({
  families,
  onAdd,
  onRemove,
}: {
  families: FamilyView[];
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName('');
  };
  return (
    <View>
      <View style={styles.chips}>
        {families.map((f) => (
          <View key={f.id} style={styles.chip}>
            <Text>{f.name}</Text>
            <Pressable
              testID={`remove-family-${f.id}`}
              onPress={() => onRemove(f.id)}
              style={styles.x}
            >
              <Text style={styles.xText}>×</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <View style={styles.addRow}>
        <TextInput
          testID="family-input"
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="家庭名(如 Rio家)"
        />
        <Pressable onPress={add} style={styles.btn}>
          <Text style={styles.btnText}>添加</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  x: { paddingHorizontal: 4 },
  xText: { color: '#666' },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
  },
  btn: { padding: 8 },
  btnText: { color: '#0a7', fontWeight: '600' },
});
