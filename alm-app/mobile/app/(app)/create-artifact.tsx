import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { createArtifact } from '@/src/api/artifacts';
import { getErrorMessage } from '@/src/api/client';
import { fetchFormSchema } from '@/src/api/formSchema';
import { manifestQueryKey, fetchProjectManifest } from '@/src/api/manifest';
import {
  DynamicFormFields,
  buildInitialValues,
  type FieldValues,
} from '@/src/components/DynamicFormFields';
import { useSessionStore } from '@/src/store/sessionStore';

export default function CreateArtifactScreen() {
  const orgSlug = useSessionStore((s) => s.orgSlug)!;
  const projectId = useSessionStore((s) => s.projectId)!;
  const [artifactType, setArtifactType] = useState<string | null>(null);
  const [values, setValues] = useState<FieldValues>({});

  const manifestQuery = useQuery({
    queryKey: manifestQueryKey(orgSlug, projectId),
    queryFn: () => fetchProjectManifest(orgSlug, projectId),
    enabled: !!orgSlug && !!projectId,
  });

  const types = useMemo(() => {
    const at = manifestQuery.data?.manifest_bundle?.artifact_types ?? [];
    return at.filter((t) => !t.id.startsWith('root-') && t.is_system_root !== true);
  }, [manifestQuery.data]);

  useEffect(() => {
    if (!artifactType && types[0]) setArtifactType(types[0].id);
  }, [artifactType, types]);

  const formQuery = useQuery({
    queryKey: ['orgs', orgSlug, 'projects', projectId, 'form-schema', 'artifact', 'create', artifactType ?? ''],
    queryFn: () => fetchFormSchema(orgSlug, projectId, 'artifact', 'create', artifactType ?? undefined),
    enabled: !!orgSlug && !!projectId && !!artifactType,
  });

  useEffect(() => {
    const fields = formQuery.data?.fields ?? [];
    if (fields.length) setValues(buildInitialValues(fields));
  }, [formQuery.data?.fields, artifactType]);

  async function onCreate() {
    if (!artifactType) return;
    const fields = formQuery.data?.fields ?? [];
    let title = '';
    let description = '';
    const custom_fields: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.key];
      if (f.key === 'title') title = String(v ?? '');
      else if (f.key === 'description') description = String(v ?? '');
      else if (f.write_target === 'custom_field') custom_fields[f.key] = v;
    }
    if (!title.trim()) {
      Alert.alert('Create', 'Title is required.');
      return;
    }
    try {
      await createArtifact(orgSlug, projectId, {
        artifact_type: artifactType,
        title: title.trim(),
        description,
        custom_fields,
      });
      router.replace('/(app)/(tabs)/backlog');
    } catch (e) {
      Alert.alert('Create', getErrorMessage(e, 'Failed'));
    }
  }

  if (manifestQuery.isPending && manifestQuery.data === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (manifestQuery.isError && manifestQuery.data === undefined) {
    const msg = getErrorMessage(manifestQuery.error, 'Failed to load manifest.');
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{msg}</Text>
        <Pressable style={styles.retryBtn} onPress={() => void manifestQuery.refetch()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={manifestQuery.isRefetching || formQuery.isRefetching}
          onRefresh={() => void Promise.all([manifestQuery.refetch(), formQuery.refetch()])}
        />
      }>
      <Text style={styles.label}>Artifact type</Text>
      {types.length === 0 ? (
        <Text style={styles.hint}>No artifact types in this manifest.</Text>
      ) : (
        <View style={styles.typeRow}>
          {types.map((t) => (
            <Pressable
              key={t.id}
              style={[styles.chip, artifactType === t.id && styles.chipActive]}
              onPress={() => setArtifactType(t.id)}>
              <Text>{t.name ?? t.id}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {formQuery.isError && formQuery.data === undefined && artifactType ? (
        <View style={styles.formError}>
          <Text style={styles.errorText}>
            {getErrorMessage(formQuery.error, 'Failed to load form.')}
          </Text>
          <Pressable style={styles.retryBtn} onPress={() => void formQuery.refetch()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : formQuery.isPending && artifactType ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : (
        <DynamicFormFields fields={formQuery.data?.fields ?? []} values={values} onChange={setValues} />
      )}

      <Pressable
        style={[styles.button, (!artifactType || types.length === 0) && styles.buttonDisabled]}
        onPress={() => void onCreate()}
        disabled={!artifactType || types.length === 0}>
        <Text style={[styles.buttonText, (!artifactType || types.length === 0) && styles.buttonTextDisabled]}>
          Create
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { textAlign: 'center', fontSize: 15, marginBottom: 12 },
  retryBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryBtnText: { color: '#fff', fontWeight: '600' },
  formError: { marginTop: 16 },
  hint: { fontSize: 14, opacity: 0.65, marginBottom: 12 },
  container: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#eee' },
  chipActive: { backgroundColor: '#bfdbfe' },
  button: {
    marginTop: 24,
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#93c5fd' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  buttonTextDisabled: { opacity: 0.85 },
});
