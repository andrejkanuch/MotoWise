import { palette } from '@motovault/design-system';
import {
  AddDocumentCategoryDocument,
  DocumentCategoriesDocument,
  type DocumentCategoriesQuery,
  UpdateDocumentCategoryDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { Check, Eye, EyeOff, Pencil, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { useEditorialTheme } from '../../../theme/editorial';
import { triggerImpact } from '../../../utils/haptics';

type CategoryItem = DocumentCategoriesQuery['documentCategories'][number];

export default function ManageDocumentCategoriesScreen() {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const queryClient = useQueryClient();

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.documents.categories(true),
    queryFn: () => gqlFetcher(DocumentCategoriesDocument, { includeHidden: true }),
  });
  const categories = data?.documentCategories ?? [];
  const visible = categories.filter((c) => !c.isHidden);
  const hidden = categories.filter((c) => c.isHidden);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.documents.categoriesAll });
  };

  const addMutation = useMutation({
    mutationFn: (name: string) => gqlFetcher(AddDocumentCategoryDocument, { input: { name } }),
    onSuccess: () => {
      trackEvent(AnalyticsEvent.DOCUMENT_CATEGORY_ADDED, {});
      setNewName('');
      invalidate();
    },
    onError: () =>
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('documents.categoryAddFailed', { defaultValue: 'Failed to add category.' }),
      ),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; name?: string; isHidden?: boolean }) =>
      gqlFetcher(UpdateDocumentCategoryDocument, {
        id: vars.id,
        input: { name: vars.name, isHidden: vars.isHidden },
      }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
    onError: () =>
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('documents.categoryUpdateFailed', { defaultValue: 'Failed to update category.' }),
      ),
  });

  const renderRow = (c: CategoryItem) => {
    const isEditing = editingId === c.id;
    return (
      <View
        key={c.id}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: theme.surface,
          borderRadius: 12,
          borderCurve: 'continuous',
          paddingHorizontal: 14,
          paddingVertical: 12,
          opacity: c.isHidden ? 0.6 : 1,
        }}
      >
        {isEditing ? (
          <TextInput
            value={editName}
            onChangeText={(v) => setEditName(v.slice(0, 60))}
            autoFocus
            style={{ flex: 1, fontSize: 15, color: theme.ink }}
            onSubmitEditing={() => updateMutation.mutate({ id: c.id, name: editName.trim() })}
          />
        ) : (
          <Text style={{ flex: 1, fontSize: 15, color: theme.ink }}>{c.name}</Text>
        )}

        {isEditing ? (
          <Pressable
            onPress={() => updateMutation.mutate({ id: c.id, name: editName.trim() })}
            hitSlop={8}
          >
            <Check size={18} color={palette.success500} strokeWidth={2.5} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => {
              triggerImpact();
              setEditingId(c.id);
              setEditName(c.name);
            }}
            hitSlop={8}
          >
            <Pencil size={18} color={theme.ink3} strokeWidth={2} />
          </Pressable>
        )}

        <Pressable
          onPress={() => {
            triggerImpact();
            updateMutation.mutate({ id: c.id, isHidden: !c.isHidden });
          }}
          hitSlop={8}
        >
          {c.isHidden ? (
            <EyeOff size={18} color={theme.ink3} strokeWidth={2} />
          ) : (
            <Eye size={18} color={palette.primary400} strokeWidth={2} />
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: theme.warm }}>
                {t('common.done', { defaultValue: 'Done' })}
              </Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Add new */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TextInput
            value={newName}
            onChangeText={(v) => setNewName(v.slice(0, 60))}
            placeholder={t('documents.newCategoryPlaceholder', {
              defaultValue: 'New category name',
            })}
            placeholderTextColor={theme.ink4}
            style={{
              flex: 1,
              backgroundColor: theme.surface,
              borderRadius: 12,
              borderCurve: 'continuous',
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 15,
              color: theme.ink,
            }}
            onSubmitEditing={() => newName.trim() && addMutation.mutate(newName.trim())}
          />
          <Pressable
            onPress={() => newName.trim() && addMutation.mutate(newName.trim())}
            disabled={!newName.trim() || addMutation.isPending}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              borderCurve: 'continuous',
              backgroundColor: newName.trim() ? palette.primary500 : palette.neutral400,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={20} color={palette.white} strokeWidth={2.5} />
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator color={palette.primary500} />
        ) : (
          <>
            <View style={{ gap: 8 }}>{visible.map(renderRow)}</View>

            {hidden.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    color: theme.ink3,
                    marginLeft: 4,
                  }}
                >
                  {t('documents.hiddenCategories', { defaultValue: 'Hidden' })}
                </Text>
                {hidden.map(renderRow)}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}
