import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  fetchArtifact,
  fetchPermittedTransitions,
  transitionArtifact,
  updateArtifact,
} from '@/src/api/artifacts';
import { getErrorMessage } from '@/src/api/client';
import { fetchFormSchema } from '@/src/api/formSchema';
import {
  createArtifactRelationship,
  deleteArtifactRelationship,
  fetchArtifactRelationships,
  fetchRelationshipTypeOptions,
} from '@/src/api/relationships';
import { fetchArtifactTraceabilitySummary } from '@/src/api/traceability';
import { DynamicFormFields, buildInitialValues, type FieldValues } from '@/src/components/DynamicFormFields';
import { useSessionStore } from '@/src/store/sessionStore';

export default function ArtifactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orgSlug = useSessionStore((s) => s.orgSlug)!;
  const projectId = useSessionStore((s) => s.projectId)!;
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fieldValues, setFieldValues] = useState<FieldValues>({});
  const [linkTargetId, setLinkTargetId] = useState('');
  const [linkRelKey, setLinkRelKey] = useState<string | null>(null);

  const artifactQuery = useQuery({
    queryKey: ['orgs', orgSlug, 'projects', projectId, 'artifacts', id],
    queryFn: () => fetchArtifact(orgSlug, projectId, id!),
    enabled: !!orgSlug && !!projectId && !!id,
  });

  const a = artifactQuery.data;
  const refetchArtifact = artifactQuery.refetch;

  const transitionsQuery = useQuery({
    queryKey: ['orgs', orgSlug, 'projects', projectId, 'artifacts', id, 'permitted-transitions'],
    queryFn: () => fetchPermittedTransitions(orgSlug, projectId, id!),
    enabled: !!orgSlug && !!projectId && !!id,
  });

  const relQuery = useQuery({
    queryKey: ['orgs', orgSlug, 'projects', projectId, 'artifacts', id, 'relationships'],
    queryFn: () => fetchArtifactRelationships(orgSlug, projectId, id!),
    enabled: !!orgSlug && !!projectId && !!id,
  });

  const relOptionsQuery = useQuery({
    queryKey: ['orgs', orgSlug, 'projects', projectId, 'artifacts', id, 'relationships', 'options'],
    queryFn: () => fetchRelationshipTypeOptions(orgSlug, projectId, id!),
    enabled: !!orgSlug && !!projectId && !!id,
  });

  const traceQuery = useQuery({
    queryKey: ['orgs', orgSlug, 'projects', projectId, 'artifacts', id, 'traceability-summary'],
    queryFn: () => fetchArtifactTraceabilitySummary(orgSlug, projectId, id!),
    enabled: !!orgSlug && !!projectId && !!id,
  });

  const editSchema = useQuery({
    queryKey: ['orgs', orgSlug, 'projects', projectId, 'form-schema', 'artifact', 'edit', a?.artifact_type],
    queryFn: () => fetchFormSchema(orgSlug, projectId, 'artifact', 'edit', a?.artifact_type),
    enabled: !!orgSlug && !!projectId && !!a?.artifact_type,
  });

  useEffect(() => {
    if (a) {
      setTitle(a.title);
      setDescription(a.description ?? '');
    }
  }, [a?.id, a?.title, a?.description]);

  useEffect(() => {
    const fields = editSchema.data?.fields ?? [];
    if (fields.length && a) {
      const init = buildInitialValues(fields);
      for (const f of fields) {
        if (f.write_target === 'custom_field' && a.custom_fields && f.key in a.custom_fields) {
          init[f.key] = a.custom_fields[f.key];
        }
      }
      setFieldValues(init);
    }
  }, [editSchema.data?.fields, a?.id, a?.custom_fields]);

  useEffect(() => {
    const opts = relOptionsQuery.data ?? [];
    if (opts.length && (linkRelKey == null || !opts.some((o) => o.key === linkRelKey))) {
      setLinkRelKey(opts[0]!.key);
    }
  }, [relOptionsQuery.data, linkRelKey]);

  const handleRefreshDetail = useCallback(() => {
    return Promise.all([
      artifactQuery.refetch(),
      transitionsQuery.refetch(),
      relQuery.refetch(),
      relOptionsQuery.refetch(),
      traceQuery.refetch(),
      editSchema.refetch(),
    ]);
  }, [artifactQuery, transitionsQuery, relQuery, relOptionsQuery, traceQuery, editSchema]);

  const detailRefreshing =
    artifactQuery.isRefetching ||
    transitionsQuery.isRefetching ||
    relQuery.isRefetching ||
    relOptionsQuery.isRefetching ||
    traceQuery.isRefetching ||
    editSchema.isRefetching;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const custom: Record<string, unknown> = { ...(a?.custom_fields ?? {}) };
      for (const f of editSchema.data?.fields ?? []) {
        if (f.write_target === 'custom_field' && f.key in fieldValues) {
          custom[f.key] = fieldValues[f.key];
        }
      }
      return updateArtifact(orgSlug, projectId, id!, {
        title,
        description,
        custom_fields: custom,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orgs', orgSlug, 'projects', projectId, 'artifacts'] });
      Alert.alert('Saved');
    },
    onError: (e) => {
      Alert.alert('Save', getErrorMessage(e, 'Failed'));
    },
  });

  const transitionMutation = useMutation({
    mutationFn: (payload: { new_state?: string; trigger?: string }) =>
      transitionArtifact(orgSlug, projectId, id!, {
        ...payload,
        expected_updated_at: a?.updated_at ?? null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orgs', orgSlug, 'projects', projectId, 'artifacts'] });
    },
    onError: (e) => {
      Alert.alert('Transition', getErrorMessage(e, 'Failed'));
    },
  });

  const deleteRelMutation = useMutation({
    mutationFn: (relationshipId: string) =>
      deleteArtifactRelationship(orgSlug, projectId, id!, relationshipId),
    onSuccess: () => void relQuery.refetch(),
  });

  const createRelMutation = useMutation({
    mutationFn: () =>
      createArtifactRelationship(orgSlug, projectId, id!, {
        target_artifact_id: linkTargetId.trim(),
        relationship_type: linkRelKey ?? '',
      }),
    onSuccess: () => {
      setLinkTargetId('');
      void relQuery.refetch();
      Alert.alert('Links', 'Link added.');
    },
    onError: (e) => {
      Alert.alert('Add link', getErrorMessage(e, 'Failed'));
    },
  });

  if (!id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Missing work item id.</Text>
        <Pressable style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (artifactQuery.isPending && artifactQuery.data === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (artifactQuery.isError && artifactQuery.data === undefined) {
    const msg = getErrorMessage(artifactQuery.error, 'Could not load this work item.');
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{msg}</Text>
        <Pressable style={styles.retryBtn} onPress={() => void refetchArtifact()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
        <Pressable style={[styles.secondaryBtn, styles.errorBack]} onPress={() => router.back()}>
          <Text>Close</Text>
        </Pressable>
      </View>
    );
  }

  if (!a) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Work item not found.</Text>
        <Pressable style={styles.retryBtn} onPress={() => void refetchArtifact()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={detailRefreshing} onRefresh={() => void handleRefreshDetail()} />
      }>
      <Text style={styles.key}>{a.artifact_key ?? a.id}</Text>
      <Text style={styles.type}>
        {a.artifact_type} · {a.state}
      </Text>

      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} />

      <Text style={styles.label}>Description</Text>
      <TextInput style={[styles.input, styles.multiline]} multiline value={description} onChangeText={setDescription} />

      {editSchema.data?.fields?.length ? (
        <>
          <Text style={[styles.label, styles.mt]}>Fields</Text>
          <DynamicFormFields fields={editSchema.data.fields} values={fieldValues} onChange={setFieldValues} />
        </>
      ) : null}

      <Pressable style={styles.primaryBtn} onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        <Text style={styles.primaryBtnText}>{saveMutation.isPending ? 'Saving…' : 'Save'}</Text>
      </Pressable>

      <Text style={[styles.section, styles.mt]}>Transitions</Text>
      <View style={styles.rowWrap}>
        {(transitionsQuery.data?.items ?? []).map((t) => (
          <Pressable
            key={`${t.trigger}-${t.to_state}`}
            style={styles.chip}
            onPress={() =>
              transitionMutation.mutate(
                t.trigger ? { trigger: t.trigger } : { new_state: t.to_state },
              )
            }>
            <Text>{t.label ?? t.to_state}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.section, styles.mt]}>Links (traceability)</Text>
      {(relQuery.data ?? []).map((r) => (
        <View key={r.id} style={styles.linkRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkLabel}>{r.display_label}</Text>
            <Text style={styles.linkMeta} numberOfLines={2}>
              {r.other_artifact_title} ({r.direction})
            </Text>
          </View>
          <Pressable onPress={() => deleteRelMutation.mutate(r.id)}>
            <Text style={styles.danger}>Remove</Text>
          </Pressable>
        </View>
      ))}
      <Text style={styles.label}>Target artifact ID</Text>
      <TextInput
        style={styles.input}
        value={linkTargetId}
        onChangeText={setLinkTargetId}
        placeholder="UUID of the other artifact"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={[styles.label, styles.mt]}>Link type</Text>
      <View style={styles.rowWrap}>
        {(relOptionsQuery.data ?? []).map((o) => (
          <Pressable
            key={o.key}
            style={[styles.chip, linkRelKey === o.key && styles.chipSelected]}
            onPress={() => setLinkRelKey(o.key)}>
            <Text style={linkRelKey === o.key ? styles.chipSelectedText : undefined}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        style={[styles.primaryBtn, styles.addLinkBtn]}
        onPress={() => {
          if (!linkTargetId.trim()) {
            Alert.alert('Add link', 'Enter target artifact ID.');
            return;
          }
          if (!linkRelKey) {
            Alert.alert('Add link', 'No link types available for this artifact.');
            return;
          }
          createRelMutation.mutate();
        }}
        disabled={createRelMutation.isPending || !(relOptionsQuery.data ?? []).length}>
        <Text style={styles.primaryBtnText}>{createRelMutation.isPending ? 'Adding…' : 'Add link'}</Text>
      </Pressable>
      <Text style={styles.hint}>
        Allowed keys: {(relOptionsQuery.data ?? []).map((o) => o.key).join(', ') || '—'}
      </Text>

      <Text style={[styles.section, styles.mt]}>Deployment / SCM summary</Text>
      {(traceQuery.data?.environments ?? []).length === 0 && (traceQuery.data?.scm_links ?? []).length === 0 ? (
        <Text style={styles.hint}>No traceability rows.</Text>
      ) : (
        <>
          {(traceQuery.data?.environments ?? []).map((e) => (
            <Text key={e.environment + e.last_occurred_at} style={styles.traceLine}>
              {e.environment}: {e.commit_sha ?? '—'}
            </Text>
          ))}
          {(traceQuery.data?.scm_links ?? []).map((l, i) => (
            <Text key={i} style={styles.traceLine} numberOfLines={2}>
              {l.provider}: {l.title ?? l.web_url}
            </Text>
          ))}
        </>
      )}

      <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
        <Text>Close</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { textAlign: 'center', fontSize: 15, marginBottom: 16 },
  retryBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryBtnText: { color: '#fff', fontWeight: '600' },
  errorBack: { marginTop: 16 },
  container: { padding: 16, paddingBottom: 40 },
  key: { fontSize: 13, opacity: 0.6 },
  type: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  section: { fontSize: 14, fontWeight: '700', marginTop: 16 },
  mt: { marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    fontSize: 16,
  },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '600' },
  secondaryBtn: { marginTop: 24, alignItems: 'center', padding: 12 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#e0e7ff',
    borderRadius: 16,
  },
  chipSelected: { backgroundColor: '#2563eb' },
  chipSelectedText: { color: '#fff', fontWeight: '600' },
  addLinkBtn: { marginTop: 12 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  linkLabel: { fontWeight: '600' },
  linkMeta: { fontSize: 13, opacity: 0.7, marginTop: 2 },
  danger: { color: '#b91c1c' },
  hint: { fontSize: 12, opacity: 0.55, marginTop: 8 },
  traceLine: { fontSize: 13, marginTop: 6 },
});
