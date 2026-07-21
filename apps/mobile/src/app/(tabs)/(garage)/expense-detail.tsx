import { palette, withAlpha } from '@motovault/design-system';
import {
  ExpensePhotosDocument,
  ExpensesByMotorcycleDocument,
  MaintenanceTasksByMotorcycleDocument,
  type MaintenanceTasksByMotorcycleQuery,
} from '@motovault/graphql';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type Href, router, useLocalSearchParams, useNavigation } from 'expo-router';
import {
  Calendar,
  ChevronRight,
  FileText,
  RotateCw,
  Tag,
  Trash2,
  Wrench,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { ExpensePhotoGallery } from '../../../components/expense-photo-gallery';
import { useCurrency } from '../../../hooks/use-currency';
import { useDeleteExpense } from '../../../hooks/use-delete-expense';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  getExpenseTitle,
  humanizeServiceType,
} from '../../../lib/expense-constants';
import { confirmDeleteExpenseAlert } from '../../../lib/expense-delete';
import { findExpenseInCache, flattenExpenses } from '../../../lib/find-expense-in-cache';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { useAuthStore } from '../../../stores/auth.store';
import { tint, useEditorialTheme } from '../../../theme/editorial';
import { triggerImpact } from '../../../utils/haptics';
import { localDateFromISODate } from '../../../utils/trip-form-dates';

// Card elevation shared across this screen's surfaces (light mode only; dark uses
// flat surfaces). Palette-token based per the no-hardcoded-colors rule.
const CARD_SHADOW = `0 1px 3px ${withAlpha(palette.black, 0.06)}`;

function paramString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default function ExpenseDetailScreen() {
  const { t } = useTranslation();
  const { t: theme, isDark } = useEditorialTheme();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user?.id);
  // Format money in the user's display currency — matches the expense list the
  // user arrived from (which uses useCurrency), avoiding a €→$ symbol mismatch.
  const { format: formatMoney } = useCurrency();

  const params = useLocalSearchParams<{
    expenseId: string;
    motorcycleId: string;
  }>();
  const expenseId = paramString(params.expenseId);
  const motorcycleId = paramString(params.motorcycleId);

  // Hydrate from ExpensesByMotorcycle cache (any year key), falling back to an
  // all-time fetch — never trust route params for amount/title (spoof/stale).
  const cachedHit = findExpenseInCache(queryClient, motorcycleId, expenseId);
  const expensesQuery = useQuery({
    queryKey: [...queryKeys.expenses.byMotorcycle(motorcycleId), 0],
    queryFn: () => gqlFetcher(ExpensesByMotorcycleDocument, { motorcycleId, year: 0 }),
    enabled: !!motorcycleId && !!expenseId,
    // Render-only seed from any cached year entry (placeholderData is NOT written
    // to this all-time [..., 0] cache slot), so a year-specific hit can't
    // masquerade as authoritative all-time data — the query still fetches and
    // owns year=0 itself. (CodeRabbit #175.)
    placeholderData: cachedHit?.data,
  });
  const expense =
    flattenExpenses(expensesQuery.data).find((item) => item.id === expenseId) ?? cachedHit?.expense;

  const amount = expense?.amount ?? 0;
  const category = expense?.category ?? 'other';
  const description = expense?.description ?? '';
  const itemName = expense?.itemName ?? '';
  const date = expense?.date ?? '';
  const maintenanceTaskId = expense?.maintenanceTaskId ?? '';

  const catColor = CATEGORY_COLORS[category] ?? palette.neutral500;
  const categoryLabel = t(`expenses.category_${category}`, {
    defaultValue: CATEGORY_LABELS[category] ?? category,
  });
  const title = getExpenseTitle({ itemName, description }, categoryLabel);

  // Receipt photos attached to this expense (MOT-143).
  const photosQuery = useQuery({
    queryKey: queryKeys.expensePhotos.byExpense(expenseId),
    queryFn: () => gqlFetcher(ExpensePhotosDocument, { expenseId }),
    enabled: !!expenseId && !!expense,
  });
  const photos = photosQuery.data?.expensePhotos ?? [];

  // Linked service record — seed from the hub's cached task list (no cold fetch
  // when warm). Still observe so orphaned FKs / loading / error are visible.
  const tasksQuery = useQuery({
    queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
    queryFn: () => gqlFetcher(MaintenanceTasksByMotorcycleDocument, { motorcycleId }),
    enabled: !!maintenanceTaskId && !!motorcycleId,
    initialData: () =>
      queryClient.getQueryData<MaintenanceTasksByMotorcycleQuery>(
        queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
      ),
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(queryKeys.maintenanceTasks.byMotorcycle(motorcycleId))
        ?.dataUpdatedAt,
  });
  const linkedTask = maintenanceTaskId
    ? tasksQuery.data?.maintenanceTasks.find((task) => task.id === maintenanceTaskId)
    : undefined;
  const lineItems = linkedTask?.lineItems ?? [];

  const deleteMutation = useDeleteExpense({
    motorcycleId,
    successHaptic: 'warning',
    onSuccess: async () => {
      if (navigation.isFocused()) {
        router.back();
      }
    },
  });

  const confirmDelete = () => {
    if (!expenseId || deleteMutation.isPending) return;
    triggerImpact();
    confirmDeleteExpenseAlert(t, {
      onConfirm: () => {
        if (deleteMutation.isPending) return;
        deleteMutation.mutate(expenseId);
      },
    });
  };

  const openServiceRecord = () => {
    if (!maintenanceTaskId) return;
    triggerImpact();
    trackEvent(AnalyticsEvent.EXPENSE_SERVICE_RECORD_OPENED, { category });
    const href: Href = {
      pathname: '/(tabs)/(garage)/bike-tasks',
      params: { motorcycleId, initialFilter: 'completed', expandTaskId: maintenanceTaskId },
    };
    router.push(href);
  };

  const cardBg = theme.surface;
  const parsedDate = localDateFromISODate(date);
  const dateLabel = parsedDate
    ? parsedDate.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  if (expensesQuery.isLoading && !expense) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDark ? palette.neutral950 : palette.neutral50,
        }}
      >
        <ActivityIndicator color={theme.warm} />
      </View>
    );
  }

  if (!expense) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: isDark ? palette.neutral950 : palette.neutral50,
          gap: 14,
        }}
      >
        <Text style={{ fontSize: 14, color: theme.ink2, textAlign: 'center' }}>
          {t('expenses.notFound', { defaultValue: 'Expense not found' })}
        </Text>
        {expensesQuery.isError ? (
          <Pressable
            onPress={() => expensesQuery.refetch()}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: 10,
              paddingHorizontal: 18,
              borderRadius: 12,
              borderCurve: 'continuous',
              backgroundColor: tint(theme.warm, 0.14),
            }}
          >
            <RotateCw size={15} color={theme.warm} strokeWidth={2.2} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.warm }}>
              {t('common.retry', { defaultValue: 'Retry' })}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48, gap: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Amount hero */}
      <Animated.View entering={FadeIn.duration(250)}>
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 16,
            borderCurve: 'continuous',
            padding: 20,
            marginTop: 8,
            boxShadow: isDark ? 'none' : CARD_SHADOW,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                borderCurve: 'continuous',
                backgroundColor: catColor,
              }}
            />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: catColor,
              }}
            >
              {categoryLabel}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 40,
              fontWeight: '800',
              color: theme.ink,
              letterSpacing: -1,
            }}
          >
            {formatMoney(amount)}
          </Text>
          <Text style={{ fontSize: 16, fontWeight: '600', color: theme.ink2, marginTop: 6 }}>
            {title}
          </Text>
        </View>
      </Animated.View>

      {/* Detail rows */}
      <Animated.View entering={FadeInDown.delay(50).duration(250)}>
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 14,
            borderCurve: 'continuous',
            overflow: 'hidden',
            boxShadow: isDark ? 'none' : CARD_SHADOW,
          }}
        >
          <DetailRow
            icon={<Calendar size={16} color={theme.warm} strokeWidth={2} />}
            label={t('expenses.date', { defaultValue: 'Date' })}
            value={dateLabel}
            isDark={isDark}
            theme={theme}
          />
          <DetailRow
            icon={<Tag size={16} color={theme.warm} strokeWidth={2} />}
            label={t('expenses.category', { defaultValue: 'Category' })}
            value={categoryLabel}
            isDark={isDark}
            theme={theme}
            last={!itemName?.trim() && !description?.trim()}
          />
          {!!itemName?.trim() && (
            <DetailRow
              icon={<FileText size={16} color={theme.warm} strokeWidth={2} />}
              label={t('expenses.itemName', { defaultValue: 'Item name' })}
              value={itemName.trim()}
              isDark={isDark}
              theme={theme}
              last={!description?.trim()}
            />
          )}
          {!!description?.trim() && (
            <DetailRow
              icon={<FileText size={16} color={theme.warm} strokeWidth={2} />}
              label={t('garage.tab_details', { defaultValue: 'Details' })}
              value={description.trim()}
              isDark={isDark}
              theme={theme}
              last
            />
          )}
        </View>
      </Animated.View>

      {/* Linked service record */}
      {!!maintenanceTaskId && (
        <Animated.View entering={FadeInDown.delay(100).duration(250)}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: theme.ink3,
              marginBottom: 8,
              marginLeft: 4,
            }}
          >
            {t('expenses.serviceRecord', { defaultValue: 'Service record' })}
          </Text>
          {tasksQuery.isLoading && !linkedTask ? (
            <View
              style={{
                backgroundColor: cardBg,
                borderRadius: 14,
                borderCurve: 'continuous',
                padding: 24,
                alignItems: 'center',
                boxShadow: isDark ? 'none' : CARD_SHADOW,
              }}
            >
              <ActivityIndicator color={theme.warm} />
            </View>
          ) : tasksQuery.isError && !linkedTask ? (
            <View
              style={{
                backgroundColor: cardBg,
                borderRadius: 14,
                borderCurve: 'continuous',
                padding: 16,
                gap: 12,
                alignItems: 'center',
                boxShadow: isDark ? 'none' : CARD_SHADOW,
              }}
            >
              <Text style={{ fontSize: 13, color: theme.ink2, textAlign: 'center' }}>
                {t('expenses.serviceRecordLoadFailed', {
                  defaultValue: 'Could not load the linked service record.',
                })}
              </Text>
              <Pressable
                onPress={() => tasksQuery.refetch()}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  backgroundColor: tint(theme.warm, 0.14),
                }}
              >
                <RotateCw size={14} color={theme.warm} strokeWidth={2.2} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.warm }}>
                  {t('common.retry', { defaultValue: 'Retry' })}
                </Text>
              </Pressable>
            </View>
          ) : linkedTask ? (
            <Pressable
              onPress={openServiceRecord}
              style={{
                backgroundColor: cardBg,
                borderRadius: 14,
                borderCurve: 'continuous',
                padding: 16,
                boxShadow: isDark ? 'none' : CARD_SHADOW,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    borderCurve: 'continuous',
                    backgroundColor: withAlpha(theme.warm, 0.15),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Wrench size={18} color={theme.warm} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: theme.ink }}>
                    {linkedTask.title}
                  </Text>
                  {!!linkedTask.completedAt && (
                    <Text style={{ fontSize: 12, color: theme.ink3, marginTop: 2 }}>
                      {new Date(linkedTask.completedAt).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                <ChevronRight size={18} color={theme.ink4} />
              </View>

              {lineItems.length > 0 && (
                <View
                  style={{
                    marginTop: 14,
                    paddingTop: 14,
                    borderTopWidth: 0.5,
                    borderTopColor: theme.line,
                    gap: 8,
                  }}
                >
                  {lineItems.map((item) => (
                    <View
                      key={item.id}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                    >
                      {item.serviceType && item.serviceType !== 'other' && (
                        <View
                          style={{
                            paddingVertical: 2,
                            paddingHorizontal: 7,
                            borderRadius: 7,
                            borderCurve: 'continuous',
                            backgroundColor: withAlpha(theme.warm, 0.15),
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '600', color: theme.warm }}>
                            {humanizeServiceType(item.serviceType)}
                          </Text>
                        </View>
                      )}
                      <Text style={{ flex: 1, fontSize: 13, color: theme.ink2 }} numberOfLines={1}>
                        {item.label}
                      </Text>
                      {item.lineTotal != null && (
                        <Text style={{ fontSize: 13, fontWeight: '600', color: theme.ink }}>
                          {formatMoney(item.lineTotal)}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: theme.warm,
                  marginTop: 14,
                }}
              >
                {t('expenses.viewServiceRecord', { defaultValue: 'View full service record' })}
              </Text>
            </Pressable>
          ) : (
            <View
              style={{
                backgroundColor: cardBg,
                borderRadius: 14,
                borderCurve: 'continuous',
                padding: 16,
                boxShadow: isDark ? 'none' : CARD_SHADOW,
              }}
            >
              <Text style={{ fontSize: 13, color: theme.ink2 }}>
                {t('expenses.serviceRecordUnavailable', {
                  defaultValue: 'Linked service record is no longer available.',
                })}
              </Text>
            </View>
          )}
        </Animated.View>
      )}

      {/* Receipt photos */}
      {!!expenseId && !!userId && (
        <Animated.View entering={FadeInDown.delay(150).duration(250)}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: theme.ink3,
              marginBottom: 8,
              marginLeft: 4,
            }}
          >
            {t('expenses.receipts', { defaultValue: 'Receipts' })}
          </Text>
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 14,
              borderCurve: 'continuous',
              padding: 12,
              boxShadow: isDark ? 'none' : CARD_SHADOW,
            }}
          >
            {photosQuery.isLoading && photos.length === 0 ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator color={theme.warm} />
              </View>
            ) : photosQuery.isError && photos.length === 0 ? (
              <View style={{ paddingVertical: 12, gap: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: theme.ink2, textAlign: 'center' }}>
                  {t('expenses.receiptsLoadFailed', {
                    defaultValue: 'Could not load receipt photos.',
                  })}
                </Text>
                <Pressable
                  onPress={() => photosQuery.refetch()}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    borderCurve: 'continuous',
                    backgroundColor: tint(theme.warm, 0.14),
                  }}
                >
                  <RotateCw size={14} color={theme.warm} strokeWidth={2.2} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: theme.warm }}>
                    {t('common.retry', { defaultValue: 'Retry' })}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <ExpensePhotoGallery
                expenseId={expenseId}
                userId={userId}
                motorcycleId={motorcycleId}
                photos={photos}
                isDark={isDark}
              />
            )}
          </View>
        </Animated.View>
      )}

      {/* Delete */}
      <Animated.View entering={FadeInDown.delay(200).duration(250)}>
        <Pressable
          onPress={confirmDelete}
          disabled={deleteMutation.isPending}
          accessibilityRole="button"
          accessibilityLabel={t('expenses.deleteExpense', { defaultValue: 'Delete expense' })}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 15,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: isDark
              ? withAlpha(palette.danger500, 0.14)
              : withAlpha(palette.danger500, 0.08),
            opacity: deleteMutation.isPending ? 0.7 : 1,
          }}
        >
          {deleteMutation.isPending ? (
            <ActivityIndicator color={palette.danger500} />
          ) : (
            <Trash2 size={16} color={palette.danger500} strokeWidth={2} />
          )}
          <Text style={{ fontSize: 15, fontWeight: '700', color: palette.danger500 }}>
            {deleteMutation.isPending
              ? t('common.deleting', { defaultValue: 'Deleting...' })
              : t('common.delete', { defaultValue: 'Delete' })}
          </Text>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

function DetailRow({
  icon,
  label,
  value,
  isDark,
  theme,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  isDark: boolean;
  theme: ReturnType<typeof useEditorialTheme>['t'];
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 0.5,
        borderBottomColor: theme.line,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          borderCurve: 'continuous',
          backgroundColor: isDark ? palette.primary900 : palette.primary50,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </View>
      <Text style={{ fontSize: 14, color: theme.ink3, width: 84 }}>{label}</Text>
      <Text
        style={{ flex: 1, fontSize: 14, fontWeight: '600', color: theme.ink, textAlign: 'right' }}
      >
        {value}
      </Text>
    </View>
  );
}
