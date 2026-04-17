import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { FormFieldSchema } from '../types/formSchema';

export type FieldValues = Record<string, unknown>;

function sortedFields(fields: FormFieldSchema[]): FormFieldSchema[] {
  return [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function buildInitialValues(fields: FormFieldSchema[]): FieldValues {
  const v: FieldValues = {};
  for (const f of fields) {
    if (f.default_value !== undefined) v[f.key] = f.default_value;
    else if (f.type === 'number') v[f.key] = '';
    else if (f.type === 'choice' && f.options?.[0]) v[f.key] = f.options[0].id;
    else v[f.key] = '';
  }
  return v;
}

function isVisible(field: FormFieldSchema, values: FieldValues): boolean {
  const w = field.visible_when;
  if (!w) return true;
  const cur = values[w.field];
  if (w.eq !== undefined) return cur === w.eq;
  if (w.in) return w.in.some((x) => x === cur);
  return true;
}

export function DynamicFormFields({
  fields,
  values,
  onChange,
  editable = true,
}: {
  fields: FormFieldSchema[];
  values: FieldValues;
  onChange: (next: FieldValues) => void;
  editable?: boolean;
}) {
  const ordered = useMemo(() => sortedFields(fields), [fields]);
  const [choiceKey, setChoiceKey] = useState<string | null>(null);
  const activeChoice = ordered.find((f) => f.key === choiceKey && f.type === 'choice');

  const set = (key: string, val: unknown) => {
    onChange({ ...values, [key]: val });
  };

  return (
    <View style={styles.wrap}>
      {ordered.map((field) => {
        if (!isVisible(field, values)) return null;
        if (field.editable === false || !editable) {
          return (
            <View key={field.key} style={styles.field}>
              <Text style={styles.label}>{field.label_key}</Text>
              <Text style={styles.static}>{String(values[field.key] ?? '')}</Text>
            </View>
          );
        }
        switch (field.type) {
          case 'number':
            return (
              <View key={field.key} style={styles.field}>
                <Text style={styles.label}>
                  {field.label_key}
                  {field.required ? ' *' : ''}
                </Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={values[field.key] === '' || values[field.key] == null ? '' : String(values[field.key])}
                  onChangeText={(t) => set(field.key, t === '' ? '' : Number(t))}
                />
              </View>
            );
          case 'choice':
            return (
              <View key={field.key} style={styles.field}>
                <Text style={styles.label}>
                  {field.label_key}
                  {field.required ? ' *' : ''}
                </Text>
                <Pressable style={styles.choiceBtn} onPress={() => setChoiceKey(field.key)}>
                  <Text>
                    {field.options?.find((o) => o.id === values[field.key])?.label ??
                      String(values[field.key] ?? 'Select…')}
                  </Text>
                </Pressable>
              </View>
            );
          case 'string':
          default:
            return (
              <View key={field.key} style={styles.field}>
                <Text style={styles.label}>
                  {field.label_key}
                  {field.required ? ' *' : ''}
                </Text>
                <TextInput
                  style={[styles.input, field.key === 'description' && styles.multiline]}
                  multiline={field.key === 'description' || field.input_mode === 'markdown'}
                  value={String(values[field.key] ?? '')}
                  onChangeText={(t) => set(field.key, t)}
                />
              </View>
            );
        }
      })}

      <Modal visible={!!activeChoice} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setChoiceKey(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{activeChoice?.label_key}</Text>
            {activeChoice?.options?.map((opt) => (
              <Pressable
                key={opt.id}
                style={styles.modalRow}
                onPress={() => {
                  if (activeChoice) set(activeChoice.key, opt.id);
                  setChoiceKey(null);
                }}>
                <Text>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  field: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600', opacity: 0.85 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  static: { fontSize: 16, opacity: 0.9 },
  choiceBtn: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    maxHeight: '70%',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  modalRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' },
});
