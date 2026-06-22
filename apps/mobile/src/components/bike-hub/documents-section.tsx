import { palette } from '@motovault/design-system';
import {
  DeleteDocumentDocument,
  DocumentCategoriesDocument,
  DocumentsByMotorcycleDocument,
  type DocumentsByMotorcycleQuery,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { type Href, router } from 'expo-router';
import { ChevronRight, FileText, Pin, Plus, Settings2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { gqlFetcher } from '../../lib/graphql-client';
import { cancelDocumentNotifications } from '../../lib/notifications';
import { queryKeys } from '../../lib/query-keys';

type DocumentItem = DocumentsByMotorcycleQuery['documents'][number];

interface DocumentsSectionProps {
  motorcycleId: string;
  isDark: boolean;
  bikeName?: string;
}

const NEAR_EXPIRY_DAYS = 30;

export function DocumentsSection({ motorcycleId, isDark, bikeName }: DocumentsSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showHidden, setShowHidden] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.documents.byMotorcycle(motorcycleId),
    queryFn: () => gqlFetcher(DocumentsByMotorcycleDocument, { motorcycleId }),
  });

  const { data: categoryData } = useQuery({
    queryKey: queryKeys.documents.categories(true),
    queryFn: () => gqlFetcher(DocumentCategoriesDocument, { includeHidden: true }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => gqlFetcher(DeleteDocumentDocument, { id }),
    onSuccess: (_res, id) => {
      if (process.env.EXPO_OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      cancelDocumentNotifications(id).catch(() => {});
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.byMotorcycle(motorcycleId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.expiring });
    },
    onError: () => {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('documents.deleteFailed', { defaultValue: 'Failed to delete document.' }),
      );
    },
  });

  const documents = data?.documents ?? [];
  const categories = categoryData?.documentCategories ?? [];
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const pinned = documents.filter((d) => d.isPinned);

  // Group documents by category; hidden-category groups appear only when toggled (R7).
  const groups = useMemo(() => {
    const byCat = new Map<string, DocumentItem[]>();
    for (const doc of documents) {
      const list = byCat.get(doc.categoryId) ?? [];
      list.push(doc);
      byCat.set(doc.categoryId, list);
    }
    return Array.from(byCat.entries())
      .map(([categoryId, docs]) => ({
        categoryId,
        category: categoryById.get(categoryId),
        docs,
      }))
      .filter((g) => showHidden || !g.category?.isHidden)
      .sort((a, b) => (a.category?.name ?? '').localeCompare(b.category?.name ?? ''));
  }, [documents, categoryById, showHidden]);

  const hasHiddenWithDocs = useMemo(
    () => documents.some((d) => categoryById.get(d.categoryId)?.isHidden),
    [documents, categoryById],
  );

  const cardBg = isDark ? palette.neutral800 : palette.white;

  const confirmDelete = (doc: DocumentItem) => {
    const fileCount = doc.files.length;
    Alert.alert(
      t('documents.deleteTitle', { defaultValue: 'Delete document?' }),
      t('documents.deleteMessage', {
        defaultValue: 'This permanently deletes "{{title}}" and its {{count}} file(s).',
        title: doc.title,
        count: fileCount,
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: () => deleteMutation.mutate(doc.id),
        },
      ],
    );
  };

  const openDocument = (doc: DocumentItem) => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // String href cast (new routes aren't in the generated typed-routes until the
    // dev server regenerates them); params travel as query string.
    router.push(
      `/(tabs)/(garage)/document/${doc.id}?motorcycleId=${motorcycleId}&bikeName=${encodeURIComponent(
        bikeName ?? '',
      )}` as Href,
    );
  };

  return (
    <View style={{ paddingHorizontal: 20 }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: '700',
            color: isDark ? palette.neutral50 : palette.neutral950,
          }}
        >
          {t('documents.title', { defaultValue: 'Documents' })}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={() => {
              if (process.env.EXPO_OS === 'ios')
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(tabs)/(garage)/manage-document-categories' as Href);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              borderCurve: 'continuous',
              backgroundColor: isDark ? palette.neutral700 : palette.neutral200,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Settings2 size={14} color={palette.primary400} strokeWidth={2.5} />
          </Pressable>
          <Pressable
            onPress={() => {
              if (process.env.EXPO_OS === 'ios')
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(
                `/(tabs)/(garage)/add-document?motorcycleId=${motorcycleId}&bikeName=${encodeURIComponent(
                  bikeName ?? '',
                )}` as Href,
              );
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              borderCurve: 'continuous',
              backgroundColor: palette.primary500,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={16} color={palette.white} strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>

      {isLoading && (
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 14,
            borderCurve: 'continuous',
            padding: 32,
            alignItems: 'center',
          }}
        >
          <ActivityIndicator color={palette.primary500} />
        </View>
      )}

      {!isLoading && documents.length === 0 && (
        <Animated.View entering={FadeInUp.duration(300)}>
          <Pressable
            onPress={() =>
              router.push(
                `/(tabs)/(garage)/add-document?motorcycleId=${motorcycleId}&bikeName=${encodeURIComponent(
                  bikeName ?? '',
                )}` as Href,
              )
            }
            style={{
              backgroundColor: cardBg,
              borderRadius: 14,
              borderCurve: 'continuous',
              padding: 24,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                borderCurve: 'continuous',
                backgroundColor: isDark ? palette.neutral800 : palette.neutral100,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText size={22} color={palette.neutral400} strokeWidth={1.5} />
            </View>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: isDark ? palette.neutral200 : palette.neutral800,
                marginTop: 12,
              }}
            >
              {t('documents.empty', { defaultValue: 'No documents yet' })}
            </Text>
            <Text
              style={{ fontSize: 13, color: palette.neutral500, marginTop: 4, textAlign: 'center' }}
            >
              {t('documents.emptyHint', {
                defaultValue: 'Store insurance, registration, title, and service records.',
              })}
            </Text>
          </Pressable>
        </Animated.View>
      )}

      {!isLoading && documents.length > 0 && (
        <View style={{ gap: 16 }}>
          {/* Pinned subsection — roadside fast-retrieval surface (R14) */}
          {pinned.length > 0 && (
            <DocumentGroup
              label={t('documents.pinned', { defaultValue: 'Pinned' })}
              docs={pinned}
              isDark={isDark}
              cardBg={cardBg}
              category={undefined}
              categoryById={categoryById}
              onOpen={openDocument}
              onDelete={confirmDelete}
            />
          )}

          {groups.map((g) => (
            <DocumentGroup
              key={g.categoryId}
              label={g.category?.name ?? t('documents.uncategorized', { defaultValue: 'Other' })}
              docs={g.docs}
              isDark={isDark}
              cardBg={cardBg}
              category={g.category}
              categoryById={categoryById}
              onOpen={openDocument}
              onDelete={confirmDelete}
            />
          ))}

          {hasHiddenWithDocs && (
            <Pressable
              onPress={() => setShowHidden((p) => !p)}
              style={{ paddingVertical: 8, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: palette.primary500 }}>
                {showHidden
                  ? t('documents.hideHidden', { defaultValue: 'Hide hidden categories' })
                  : t('documents.showHidden', { defaultValue: 'Show hidden categories' })}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

interface DocumentGroupProps {
  label: string;
  docs: DocumentItem[];
  isDark: boolean;
  cardBg: string;
  category: { promptsExpiry: boolean; isHidden: boolean } | undefined;
  categoryById: Map<string, { name: string }>;
  onOpen: (doc: DocumentItem) => void;
  onDelete: (doc: DocumentItem) => void;
}

function DocumentGroup({
  label,
  docs,
  isDark,
  cardBg,
  category,
  onOpen,
  onDelete,
}: DocumentGroupProps) {
  const { t } = useTranslation();
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: isDark ? palette.neutral400 : palette.neutral500,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {label}
        </Text>
        <Text style={{ fontSize: 12, color: palette.neutral400 }}>{docs.length}</Text>
        {category?.isHidden && (
          <Text style={{ fontSize: 11, color: palette.neutral400, fontStyle: 'italic' }}>
            {t('documents.hiddenTag', { defaultValue: 'hidden' })}
          </Text>
        )}
      </View>
      <View style={{ gap: 6 }}>
        {docs.map((doc, index) => (
          <DocumentRow
            key={doc.id}
            doc={doc}
            isDark={isDark}
            cardBg={cardBg}
            promptsExpiry={category?.promptsExpiry ?? false}
            index={index}
            onOpen={onOpen}
            onDelete={onDelete}
          />
        ))}
      </View>
    </View>
  );
}

interface DocumentRowProps {
  doc: DocumentItem;
  isDark: boolean;
  cardBg: string;
  promptsExpiry: boolean;
  index: number;
  onOpen: (doc: DocumentItem) => void;
  onDelete: (doc: DocumentItem) => void;
}

function DocumentRow({
  doc,
  isDark,
  cardBg,
  promptsExpiry,
  index,
  onOpen,
  onDelete,
}: DocumentRowProps) {
  const { t } = useTranslation();
  const status = expiryStatus(doc.expiryDate ?? null);
  const showNoReminder = promptsExpiry && !doc.expiryDate;

  return (
    <Animated.View entering={FadeInUp.delay(index * 50).duration(300)}>
      <Pressable
        onPress={() => onOpen(doc)}
        onLongPress={() => onDelete(doc)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: cardBg,
          borderRadius: 12,
          borderCurve: 'continuous',
          padding: 12,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            borderCurve: 'continuous',
            backgroundColor: isDark ? palette.neutral700 : palette.neutral100,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FileText size={18} color={palette.primary400} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: isDark ? palette.neutral100 : palette.neutral900,
                flexShrink: 1,
              }}
            >
              {doc.title}
            </Text>
            {doc.isPinned && <Pin size={12} color={palette.primary400} strokeWidth={2.5} />}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Text style={{ fontSize: 12, color: palette.neutral500 }}>
              {t('documents.fileCount', {
                defaultValue: '{{count}} file(s)',
                count: doc.files.length,
              })}
            </Text>
            {status && (
              <Text style={{ fontSize: 12, fontWeight: '700', color: status.color }}>
                · {t(status.key, status.opts)}
              </Text>
            )}
            {showNoReminder && (
              <Text style={{ fontSize: 12, fontWeight: '600', color: palette.neutral400 }}>
                · {t('documents.noReminder', { defaultValue: 'No reminder set' })}
              </Text>
            )}
          </View>
        </View>
        <ChevronRight size={18} color={palette.neutral400} strokeWidth={2} />
      </Pressable>
    </Animated.View>
  );
}

/** Expiry badge: red if past, amber within 30 days, neutral otherwise. Returns
 * the i18n key + interpolation options so the row renders t() directly. */
function expiryStatus(
  expiryDate: string | null,
): { color: string; key: string; opts: { defaultValue: string } & Record<string, unknown> } | null {
  if (!expiryDate) return null;
  const days = differenceInCalendarDays(parseISO(expiryDate), new Date());
  if (days < 0) {
    return {
      color: palette.danger500,
      key: 'documents.expired',
      opts: { defaultValue: 'Expired' },
    };
  }
  if (days <= NEAR_EXPIRY_DAYS) {
    return {
      color: palette.warning500,
      key: 'documents.expiresInDays',
      opts: { defaultValue: 'Expires in {{days}}d', days },
    };
  }
  return {
    color: palette.neutral500,
    key: 'documents.expiresOn',
    opts: { defaultValue: 'Expires {{date}}', date: expiryDate },
  };
}
