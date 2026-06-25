import { palette } from '@motovault/design-system';
import {
  AddDocumentCategoryDocument,
  DeleteDocumentCategoryDocument,
  DocumentCategoriesDocument,
  type DocumentCategoriesQuery,
  UpdateDocumentCategoryDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react-native';
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

// Sentinel the API raises (BadRequestException) when a category still has
// documents filed under it — documents.category_id is ON DELETE RESTRICT, so
// it cannot be removed until those documents are moved or deleted.
const CATEGORY_HAS_DOCUMENTS = 'CATEGORY_HAS_DOCUMENTS';

// The Manage Categories screen always renders the full set (including hidden).
const CATEGORIES_KEY = queryKeys.documents.categories(true);

export default function ManageDocumentCategoriesScreen() {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const queryClient = useQueryClient();

  const [newName, setNewName] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: () => gqlFetcher(DocumentCategoriesDocument, { includeHidden: true }),
  });
  const categories = data?.documentCategories ?? [];
  const visible = categories.filter((c) => !c.isHidden);
  const hidden = categories.filter((c) => c.isHidden);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.documents.categoriesAll });
  };

  // Optimistic cache helpers (TanStack Query "via the cache" pattern): cancel
  // in-flight refetches so they can't clobber the optimistic state, snapshot for
  // rollback, then mutate the cached list immediately so the row reacts on tap
  // instead of after a mutation + refetch round-trip.
  const optimistic = async (apply: (list: CategoryItem[]) => CategoryItem[]) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.documents.categoriesAll });
    const previous = queryClient.getQueryData<DocumentCategoriesQuery>(CATEGORIES_KEY);
    queryClient.setQueryData<DocumentCategoriesQuery>(CATEGORIES_KEY, (old) =>
      old ? { ...old, documentCategories: apply(old.documentCategories) } : old,
    );
    return previous;
  };

  const rollback = (previous?: DocumentCategoriesQuery) => {
    if (previous) queryClient.setQueryData(CATEGORIES_KEY, previous);
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

  const toggleMutation = useMutation({
    mutationFn: (vars: { id: string; isHidden: boolean }) =>
      gqlFetcher(UpdateDocumentCategoryDocument, {
        id: vars.id,
        input: { isHidden: vars.isHidden },
      }),
    onMutate: (vars) =>
      optimistic((list) =>
        list.map((c) => (c.id === vars.id ? { ...c, isHidden: vars.isHidden } : c)),
      ).then((previous) => ({ previous })),
    onError: (_err, _vars, ctx) => {
      rollback(ctx?.previous);
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('documents.categoryUpdateFailed', { defaultValue: 'Failed to update category.' }),
      );
    },
    onSettled: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => gqlFetcher(DeleteDocumentCategoryDocument, { id }),
    onMutate: (id) =>
      optimistic((list) => list.filter((c) => c.id !== id)).then((previous) => ({ previous })),
    onSuccess: () => trackEvent(AnalyticsEvent.DOCUMENT_CATEGORY_DELETED, {}),
    onError: (err, _id, ctx) => {
      rollback(ctx?.previous);
      const hasDocuments = err instanceof Error && err.message.includes(CATEGORY_HAS_DOCUMENTS);
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        hasDocuments
          ? t('documents.categoryHasDocuments', {
              defaultValue: 'Move or remove its documents before deleting this category.',
            })
          : t('documents.categoryDeleteFailed', { defaultValue: 'Failed to delete category.' }),
      );
    },
    onSettled: invalidate,
  });

  const confirmDelete = (c: CategoryItem) => {
    triggerImpact();
    Alert.alert(
      t('documents.deleteCategoryTitle', { defaultValue: 'Delete category?' }),
      t('documents.deleteCategoryMessage', {
        name: c.name,
        defaultValue: `"${c.name}" will be permanently removed.`,
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: () => deleteMutation.mutate(c.id),
        },
      ],
    );
  };

  const renderRow = (c: CategoryItem) => (
    <View
      key={c.id}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: theme.surface,
        borderRadius: 12,
        borderCurve: 'continuous',
        paddingHorizontal: 14,
        paddingVertical: 12,
        opacity: c.isHidden ? 0.6 : 1,
      }}
    >
      <Text style={{ flex: 1, fontSize: 15, color: theme.ink }}>{c.name}</Text>

      <Pressable
        onPress={() => {
          triggerImpact();
          toggleMutation.mutate({ id: c.id, isHidden: !c.isHidden });
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={
          c.isHidden
            ? t('documents.showCategory', { defaultValue: 'Show category' })
            : t('documents.hideCategory', { defaultValue: 'Hide category' })
        }
      >
        {c.isHidden ? (
          <EyeOff size={18} color={theme.ink3} strokeWidth={2} />
        ) : (
          <Eye size={18} color={palette.primary400} strokeWidth={2} />
        )}
      </Pressable>

      <Pressable
        onPress={() => confirmDelete(c)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('documents.deleteCategory', { defaultValue: 'Delete category' })}
      >
        <Trash2 size={18} color={palette.danger500} strokeWidth={2} />
      </Pressable>
    </View>
  );

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
