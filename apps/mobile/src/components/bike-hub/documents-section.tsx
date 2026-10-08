import {
  DeleteDocumentDocument,
  DocumentCategoriesDocument,
  type DocumentsByMotorcycleQuery,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { type Href, router } from 'expo-router';
import { FileText, Pin } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useMotorcycleDocuments } from '../../hooks/use-motorcycle-documents';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { type DocumentExpiryLevel, documentExpiryStatus } from '../../lib/document-expiry';
import { gqlFetcher } from '../../lib/graphql-client';
import { cancelDocumentNotifications } from '../../lib/notifications';
import { queryKeys } from '../../lib/query-keys';
import { QUERY_META } from '../../lib/query-meta';
import { triggerImpact, triggerNotification } from '../../utils/haptics';
import { LoadError } from './load-error';
import { HubCard } from './ui/hub-card';
import { RowBody } from './ui/list-row';
import { RowChevron } from './ui/row-chevron';
import { SectionHeader } from './ui/section-header';
import {
  HUB_FONT,
  HUB_RADIUS,
  HUB_ROW_SUB_LINES,
  HUB_TOUCH_TARGET,
  type HubCopyKey,
  hub,
} from './ui/tokens';

type DocumentItem = DocumentsByMotorcycleQuery['documents'][number];

/** Group key of the one list shown when the categories failed to load. */
const UNGROUPED = 'ungrouped';

interface DocumentsSectionProps {
  motorcycleId: string;
  // Retained for caller compatibility; the section always renders on the hub's dark ground.
  isDark?: boolean;
  bikeName?: string;
}

export function DocumentsSection({ motorcycleId, bikeName }: DocumentsSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showHidden, setShowHidden] = useState(false);

  // Both keys are shared with the Overview, which opts out of the global alert;
  // this section opts out too and shows its own error with Retry (below), so a
  // cold open on this segment with the API down raises no system alert and never
  // reads a failed load as "No documents yet".
  const {
    documents,
    isLoading,
    isError: documentsError,
    refetch: refetchDocuments,
  } = useMotorcycleDocuments(motorcycleId, { meta: QUERY_META.OWN_ERROR_UI });

  const categoriesQuery = useQuery({
    queryKey: queryKeys.documents.categories(true),
    queryFn: () => gqlFetcher(DocumentCategoriesDocument, { includeHidden: true }),
    meta: QUERY_META.OWN_ERROR_UI,
  });
  const categoryData = categoriesQuery.data;
  const categoriesError = categoriesQuery.isError && !categoryData;
  // Only the documents failing hides the list. Without categories the rows still
  // show, ungrouped — a pinned insurance card must be reachable at the roadside
  // even when the category list is down.
  const loadFailed = documentsError;
  const retryLoad = () => {
    refetchDocuments();
    if (categoriesError) void categoriesQuery.refetch();
  };

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
  // Without categories, one ungrouped list (nothing is known to be hidden).
  const groups = useMemo(() => {
    if (categoriesError) {
      return documents.length > 0
        ? [{ categoryId: UNGROUPED, category: undefined, docs: documents }]
        : [];
    }
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
  }, [documents, categoryById, showHidden, categoriesError]);

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

  const addDocument = () => {
    router.push(
      `/(tabs)/(garage)/add-document?motorcycleId=${motorcycleId}&bikeName=${encodeURIComponent(
        bikeName ?? '',
      )}` as Href,
    );
  };

  const openCategories = () => {
    router.push('/(tabs)/(garage)/manage-document-categories' as Href);
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
    <View style={{ gap: 12 }}>
      {/* Adding a document is the segment's action pill; the header only manages categories. */}
      <View style={{ gap: 8 }}>
        <SectionHeader
          label={t('documents.title')}
          count={!loadFailed && !isLoading && documents.length > 0 ? documents.length : undefined}
          action={{
            label: t('bikeHub.bikeSegment.categories'),
            accessibilityLabel: t('documents.manageCategories'),
            onPress: openCategories,
          }}
        />

        {loadFailed && (
          <LoadError
            testID="documents-load-error"
            message={t('bikeHub.papers.loadError')}
            onRetry={retryLoad}
          />
        )}

        {!loadFailed && isLoading && (
          <HubCard style={{ padding: 32, alignItems: 'center' }}>
            <ActivityIndicator color={hub.dim} accessibilityLabel={t('common.loading')} />
          </HubCard>
        )}

        {!loadFailed && !isLoading && documents.length === 0 && (
          <Animated.View entering={FadeInUp.duration(250)}>
            <HubCard
              onPress={addDocument}
              accessibilityLabel={`${t('documents.empty')}. ${t('documents.emptyHint')}`}
              style={{ paddingVertical: 24, paddingHorizontal: 16, alignItems: 'center', gap: 4 }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  marginBottom: 8,
                  borderRadius: HUB_RADIUS.tile,
                  borderCurve: 'continuous',
                  backgroundColor: hub.raised,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileText size={20} color={hub.dim} strokeWidth={1.8} />
              </View>
              <Text
                style={{
                  fontFamily: HUB_FONT.sansSemiBold,
                  fontSize: 15,
                  lineHeight: 20,
                  color: hub.text,
                  textAlign: 'center',
                }}
              >
                {t('documents.empty')}
              </Text>
              <Text
                style={{
                  fontFamily: HUB_FONT.sans,
                  fontSize: 13,
                  lineHeight: 17,
                  color: hub.dim,
                  textAlign: 'center',
                }}
              >
                {t('documents.emptyHint')}
              </Text>
            </HubCard>
          </Animated.View>
        )}

        {!loadFailed && !isLoading && documents.length > 0 && categoriesError && (
          <LoadError
            testID="documents-categories-error"
            message={t('documents.categoriesLoadError')}
            onRetry={() => void categoriesQuery.refetch()}
            retryAccessibilityLabel={t('documents.categoriesRetryA11y')}
          />
        )}
      </View>

      {!loadFailed && !isLoading && documents.length > 0 && (
        <>
          {/* Pinned subsection — roadside fast-retrieval surface (R14) */}
          {pinned.length > 0 && (
            <DocumentGroup
              label={t('documents.pinned')}
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
              label={
                g.categoryId === UNGROUPED
                  ? t('documents.allDocuments')
                  : (g.category?.name ?? t('documents.uncategorized'))
              }
              docs={g.docs}
              category={g.category}
              categoryById={categoryById}
              onOpen={openDocument}
              onDelete={confirmDelete}
            />
          ))}

          {hasHiddenWithDocs && (
            <Pressable
              onPress={() => {
                triggerImpact();
                setShowHidden((p) => !p);
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: showHidden }}
              style={({ pressed }) => ({
                minHeight: HUB_TOUCH_TARGET,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text
                style={{ fontFamily: HUB_FONT.sansSemiBold, fontSize: 14, color: hub.copperText }}
              >
                {showHidden ? t('documents.hideHidden') : t('documents.showHidden')}
              </Text>
            </Pressable>
          )}
        </>
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
  return (
    <View style={{ gap: 8 }}>
      <SectionHeader
        label={label}
        count={docs.length}
        hint={category?.isHidden ? t('documents.hiddenTag') : undefined}
      />
      <HubCard style={{ overflow: 'hidden' }}>
        {docs.map((doc, index) => (
          <DocumentRow
            key={doc.id}
            doc={doc}
            promptsExpiry={category?.promptsExpiry ?? false}
            index={index}
            divider={index < docs.length - 1}
            onOpen={onOpen}
            onDelete={onDelete}
          />
        ))}
      </HubCard>
    </View>
  );
}

interface DocumentRowProps {
  doc: DocumentItem;
  promptsExpiry: boolean;
  index: number;
  divider: boolean;
  onOpen: (doc: DocumentItem) => void;
  onDelete: (doc: DocumentItem) => void;
}

/** Expiry level → how the row's status reads. Expired and soon are real status; a future date is plain. */
const EXPIRY_LOOK: Record<
  DocumentExpiryLevel,
  { key: HubCopyKey; color: string; tileBg: string; tileIcon: string }
> = {
  expired: {
    key: 'documents.expired',
    color: hub.late,
    tileBg: hub.tagCritBg,
    tileIcon: hub.late,
  },
  soon: {
    key: 'documents.expiresInDays',
    color: hub.soon,
    tileBg: hub.tagHighBg,
    tileIcon: hub.soon,
  },
  future: {
    key: 'documents.expiresOn',
    color: hub.dim,
    tileBg: hub.raised,
    tileIcon: hub.dim,
  },
};

function DocumentRow({ doc, promptsExpiry, index, divider, onOpen, onDelete }: DocumentRowProps) {
  const { t } = useTranslation();
  const status = documentExpiryStatus(doc.expiryDate ?? null);
  const look = status ? EXPIRY_LOOK[status.level] : null;
  const showNoReminder = promptsExpiry && !doc.expiryDate;
  const files = t('documents.fileCount', { count: doc.files.length });
  const statusText =
    status && look ? t(look.key, { days: status.days, date: doc.expiryDate }) : null;
  const meta = [files, showNoReminder ? t('documents.noReminder') : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Animated.View entering={FadeInUp.delay(Math.min(index, 5) * 50).duration(250)}>
      <Pressable
        testID={`document-row-${doc.id}`}
        onPress={() => onOpen(doc)}
        onLongPress={() => onDelete(doc)}
        accessibilityRole="button"
        accessibilityLabel={[
          doc.title,
          doc.isPinned ? t('documents.pinned') : null,
          statusText,
          meta,
        ]
          .filter(Boolean)
          .join(', ')}
        accessibilityActions={[{ name: 'activate' }, { name: 'delete', label: t('common.delete') }]}
        onAccessibilityAction={(event) =>
          event.nativeEvent.actionName === 'delete' ? onDelete(doc) : onOpen(doc)
        }
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
          paddingLeft: 14,
          paddingRight: 12,
          borderBottomWidth: divider ? 1 : 0,
          borderBottomColor: hub.hairline,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <RowBody
          icon={{
            icon: FileText,
            color: look?.tileIcon ?? hub.dim,
            background: look?.tileBg ?? hub.raised,
          }}
          title={doc.title}
          sub={
            <Text
              numberOfLines={HUB_ROW_SUB_LINES}
              style={{ fontFamily: HUB_FONT.sans, fontSize: 13, lineHeight: 16, color: hub.muted }}
            >
              {statusText && look ? (
                <Text style={{ color: look.color }}>{`${statusText} · `}</Text>
              ) : null}
              {meta}
            </Text>
          }
          trailing={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {doc.isPinned ? <Pin size={14} color={hub.muted} strokeWidth={2} /> : null}
              <RowChevron />
            </View>
          }
        />
      </Pressable>
    </Animated.View>
  );
}
