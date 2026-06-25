import { palette } from '@motovault/design-system';
import {
  DeleteDocumentDocument,
  DocumentCategoriesDocument,
  type DocumentsByMotorcycleQuery,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { type Href, router } from 'expo-router';
import { ChevronRight, FileText, Pin, Plus, Settings2 } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useMotorcycleDocuments } from '../../hooks/use-motorcycle-documents';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { documentExpiryStatus } from '../../lib/document-expiry';
import { gqlFetcher } from '../../lib/graphql-client';
import { cancelDocumentNotifications } from '../../lib/notifications';
import { queryKeys } from '../../lib/query-keys';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { triggerImpact, triggerNotification } from '../../utils/haptics';

type DocumentItem = DocumentsByMotorcycleQuery['documents'][number];

interface DocumentsSectionProps {
  motorcycleId: string;
  // Retained for caller compatibility; theming now comes from useEditorialTheme.
  isDark?: boolean;
  bikeName?: string;
}

export function DocumentsSection({ motorcycleId, bikeName }: DocumentsSectionProps) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const queryClient = useQueryClient();
  const [showHidden, setShowHidden] = useState(false);

  const { documents, isLoading } = useMotorcycleDocuments(motorcycleId);

  const { data: categoryData } = useQuery({
    queryKey: queryKeys.documents.categories(true),
    queryFn: () => gqlFetcher(DocumentCategoriesDocument, { includeHidden: true }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => gqlFetcher(DeleteDocumentDocument, { id }),
    onSuccess: (_res, id) => {
      const removed = documents.find((d) => d.id === id);
      trackEvent(AnalyticsEvent.DOCUMENT_DELETED, {
        file_count: removed?.files.length ?? 0,
        had_expiry: !!removed?.expiryDate,
        source: 'section',
      });
      triggerNotification(Haptics.NotificationFeedbackType.Success);
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

  const categories = categoryData?.documentCategories ?? [];
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const pinned = documents.filter((d) => d.isPinned);

  // Track engagement with the vault once per mount, with how many documents the
  // rider has on this bike (feeds the "how many documents are people saving" view).
  const sectionTrackedRef = useRef(false);
  useEffect(() => {
    if (isLoading || sectionTrackedRef.current) return;
    sectionTrackedRef.current = true;
    trackEvent(AnalyticsEvent.DOCUMENTS_SECTION_VIEWED, {
      document_count: documents.length,
      pinned_count: pinned.length,
    });
  }, [isLoading, documents.length, pinned.length]);

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
    triggerImpact();
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
            color: theme.ink,
          }}
        >
          {t('documents.title', { defaultValue: 'Documents' })}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={() => {
              triggerImpact();
              router.push('/(tabs)/(garage)/manage-document-categories' as Href);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              borderCurve: 'continuous',
              backgroundColor: theme.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Settings2 size={14} color={theme.warm} strokeWidth={2.5} />
          </Pressable>
          <Pressable
            onPress={() => {
              triggerImpact();
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
              backgroundColor: theme.warm,
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
            backgroundColor: theme.surface,
            borderRadius: 14,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: theme.line,
            padding: 32,
            alignItems: 'center',
          }}
        >
          <ActivityIndicator color={theme.warm} />
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
              backgroundColor: theme.surface,
              borderRadius: 14,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: theme.line,
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
                backgroundColor: tint(theme.warm, 0.12),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText size={22} color={theme.warm} strokeWidth={1.5} />
            </View>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: theme.ink,
                marginTop: 12,
              }}
            >
              {t('documents.empty', { defaultValue: 'No documents yet' })}
            </Text>
            <Text style={{ fontSize: 13, color: theme.ink3, marginTop: 4, textAlign: 'center' }}>
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
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.warm }}>
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
  category: { promptsExpiry: boolean; isHidden: boolean } | undefined;
  categoryById: Map<string, { name: string }>;
  onOpen: (doc: DocumentItem) => void;
  onDelete: (doc: DocumentItem) => void;
}

function DocumentGroup({ label, docs, category, onOpen, onDelete }: DocumentGroupProps) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: theme.ink3,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {label}
        </Text>
        <Text style={{ fontSize: 12, color: theme.ink4 }}>{docs.length}</Text>
        {category?.isHidden && (
          <Text style={{ fontSize: 11, color: theme.ink4, fontStyle: 'italic' }}>
            {t('documents.hiddenTag', { defaultValue: 'hidden' })}
          </Text>
        )}
      </View>
      <View style={{ gap: 6 }}>
        {docs.map((doc, index) => (
          <DocumentRow
            key={doc.id}
            doc={doc}
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
  promptsExpiry: boolean;
  index: number;
  onOpen: (doc: DocumentItem) => void;
  onDelete: (doc: DocumentItem) => void;
}

function DocumentRow({ doc, promptsExpiry, index, onOpen, onDelete }: DocumentRowProps) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
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
          backgroundColor: theme.surface,
          borderRadius: 12,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: theme.line,
          padding: 12,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            borderCurve: 'continuous',
            backgroundColor: tint(theme.warm, 0.12),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FileText size={18} color={theme.warm} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: theme.ink,
                flexShrink: 1,
              }}
            >
              {doc.title}
            </Text>
            {doc.isPinned && <Pin size={12} color={theme.warm} strokeWidth={2.5} />}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Text style={{ fontSize: 12, color: theme.ink3 }}>
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
              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.ink4 }}>
                · {t('documents.noReminder', { defaultValue: 'No reminder set' })}
              </Text>
            )}
          </View>
        </View>
        <ChevronRight size={18} color={theme.ink3} strokeWidth={2} />
      </Pressable>
    </Animated.View>
  );
}

/** Maps the shared expiry classification to a badge color + i18n key/opts so the
 * row renders t() directly. Classification thresholds live in lib/document-expiry. */
function expiryStatus(
  expiryDate: string | null,
): { color: string; key: string; opts: { defaultValue: string } & Record<string, unknown> } | null {
  const status = documentExpiryStatus(expiryDate);
  if (!status) return null;
  if (status.level === 'expired') {
    return {
      color: palette.danger500,
      key: 'documents.expired',
      opts: { defaultValue: 'Expired' },
    };
  }
  if (status.level === 'soon') {
    return {
      color: palette.warning500,
      key: 'documents.expiresInDays',
      opts: { defaultValue: 'Expires in {{days}}d', days: status.days },
    };
  }
  return {
    color: palette.neutral500,
    key: 'documents.expiresOn',
    opts: { defaultValue: 'Expires {{date}}', date: expiryDate as string },
  };
}
