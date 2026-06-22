import DateTimePicker from '@expo/ui/community/datetime-picker';
import { palette } from '@motovault/design-system';
import {
  DeleteDocumentDocument,
  DocumentCategoriesDocument,
  DocumentsByMotorcycleDocument,
  type DocumentsByMotorcycleQuery,
  UpdateDocumentDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseISO } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, Check, Pin, Trash2, X } from 'lucide-react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DocumentViewer } from '../../../../components/documents/document-viewer';
import { gqlFetcher } from '../../../../lib/graphql-client';
import {
  cancelDocumentNotifications,
  scheduleDocumentExpiryReminder,
} from '../../../../lib/notifications';
import { queryKeys } from '../../../../lib/query-keys';
import { useEditorialTheme } from '../../../../theme/editorial';
import { triggerImpact, triggerNotification } from '../../../../utils/haptics';
import { toISODateInput } from '../../../../utils/trip-form-dates';

type DocumentItem = DocumentsByMotorcycleQuery['documents'][number];

export default function DocumentDetailScreen() {
  const { t } = useTranslation();
  const { id, motorcycleId, bikeName } = useLocalSearchParams<{
    id: string;
    motorcycleId: string;
    bikeName?: string;
  }>();
  const { t: theme, isDark } = useEditorialTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.documents.byMotorcycle(motorcycleId),
    queryFn: () => gqlFetcher(DocumentsByMotorcycleDocument, { motorcycleId }),
  });
  const { data: categoryData } = useQuery({
    queryKey: queryKeys.documents.categories(false),
    queryFn: () => gqlFetcher(DocumentCategoriesDocument, { includeHidden: false }),
  });

  const doc: DocumentItem | undefined = data?.documents.find((d) => d.id === id);
  const categories = categoryData?.documentCategories ?? [];

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [note, setNote] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.documents.byMotorcycle(motorcycleId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.documents.expiring });
  };

  const beginEdit = () => {
    if (!doc) return;
    setTitle(doc.title);
    setCategoryId(doc.categoryId);
    setExpiryDate(doc.expiryDate ? parseISO(doc.expiryDate) : null);
    setNote(doc.note ?? '');
    setEditing(true);
  };

  const pinMutation = useMutation({
    mutationFn: (isPinned: boolean) =>
      gqlFetcher(UpdateDocumentDocument, { id, input: { isPinned } }),
    onSuccess: () => {
      triggerImpact();
      invalidate();
    },
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      gqlFetcher(UpdateDocumentDocument, {
        id,
        input: {
          title: title.trim(),
          categoryId: categoryId ?? undefined,
          expiryDate: expiryDate ? toISODateInput(expiryDate) : null,
          note: note.trim() || null,
        },
      }),
    onSuccess: async () => {
      triggerNotification(Haptics.NotificationFeedbackType.Success);
      // Reschedule reminders off the (possibly new) expiry — keyed off expiry only.
      if (expiryDate) {
        await scheduleDocumentExpiryReminder(
          { id, title: title.trim(), expiryDate: toISODateInput(expiryDate), motorcycleId },
          bikeName ?? '',
        ).catch(() => {});
      } else {
        await cancelDocumentNotifications(id).catch(() => {});
      }
      invalidate();
      setEditing(false);
    },
    onError: () => {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('documents.updateFailed', { defaultValue: 'Failed to update document.' }),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => gqlFetcher(DeleteDocumentDocument, { id }),
    onSuccess: () => {
      triggerNotification(Haptics.NotificationFeedbackType.Success);
      cancelDocumentNotifications(id).catch(() => {});
      invalidate();
      router.back();
    },
    onError: () => {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('documents.deleteFailed', { defaultValue: 'Failed to delete document.' }),
      );
    },
  });

  const confirmDelete = () => {
    if (!doc) return;
    Alert.alert(
      t('documents.deleteTitle', { defaultValue: 'Delete document?' }),
      t('documents.deleteMessage', {
        defaultValue: 'This permanently deletes "{{title}}" and its {{count}} file(s).',
        title: doc.title,
        count: doc.files.length,
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: () => deleteMutation.mutate(),
        },
      ],
    );
  };

  if (isLoading || !doc) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDark ? palette.neutral950 : palette.neutral50,
        }}
      >
        {isLoading ? (
          <ActivityIndicator color={palette.primary500} />
        ) : (
          <Text style={{ color: theme.ink2 }}>
            {t('documents.notFound', { defaultValue: 'Document not found' })}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? palette.neutral950 : palette.neutral50 }}>
      {/* Top bar */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <X size={24} color={theme.ink} strokeWidth={2} />
        </Pressable>
        <Text
          numberOfLines={1}
          style={{ flex: 1, fontSize: 17, fontWeight: '700', color: theme.ink }}
        >
          {doc.title}
        </Text>
        <Pressable onPress={() => pinMutation.mutate(!doc.isPinned)} hitSlop={8}>
          <Pin
            size={22}
            color={doc.isPinned ? palette.primary500 : theme.ink3}
            fill={doc.isPinned ? palette.primary500 : 'transparent'}
            strokeWidth={2}
          />
        </Pressable>
        <Pressable onPress={confirmDelete} hitSlop={8}>
          <Trash2 size={22} color={palette.danger500} strokeWidth={2} />
        </Pressable>
      </View>

      {/* Viewer */}
      <View style={{ flex: 1 }}>
        <DocumentViewer
          documentId={doc.id}
          files={doc.files.map((f) => ({ id: f.id, mimeType: f.mimeType }))}
          isDark={isDark}
        />
      </View>

      {/* Metadata / edit panel */}
      <ScrollView
        style={{ maxHeight: 320 }}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {!editing ? (
          <View style={{ gap: 8 }}>
            {doc.expiryDate && (
              <Text style={{ fontSize: 14, color: theme.ink2 }}>
                {t('documents.expiresOn', {
                  defaultValue: 'Expires {{date}}',
                  date: doc.expiryDate,
                })}
              </Text>
            )}
            {doc.note ? <Text style={{ fontSize: 14, color: theme.ink2 }}>{doc.note}</Text> : null}
            <Pressable onPress={beginEdit} style={{ paddingVertical: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: palette.primary500 }}>
                {t('documents.editDetails', { defaultValue: 'Edit details' })}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            <TextInput
              value={title}
              onChangeText={(v) => setTitle(v.slice(0, 200))}
              placeholder={t('documents.titleLabel', { defaultValue: 'Title' })}
              placeholderTextColor={theme.ink4}
              style={{
                backgroundColor: theme.surface,
                borderRadius: 14,
                borderCurve: 'continuous',
                padding: 14,
                fontSize: 15,
                color: theme.ink,
              }}
            />

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {categories.map((c) => {
                const selected = categoryId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      triggerImpact();
                      setCategoryId(c.id);
                    }}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      borderCurve: 'continuous',
                      backgroundColor: selected ? `${palette.primary500}18` : theme.surface,
                      borderWidth: selected ? 1.5 : 1,
                      borderColor: selected ? palette.primary500 : theme.line,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: selected ? '700' : '500',
                        color: selected ? palette.primary500 : theme.ink2,
                      }}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View
              style={{
                backgroundColor: theme.surface,
                borderRadius: 14,
                borderCurve: 'continuous',
                overflow: 'hidden',
              }}
            >
              <Pressable
                onPress={() => setShowDatePicker((s) => !s)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                }}
              >
                <Calendar size={16} color={theme.warm} strokeWidth={2} />
                <Text style={{ flex: 1, fontSize: 15, color: theme.ink }}>
                  {expiryDate
                    ? expiryDate.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : t('documents.noExpiry', { defaultValue: 'No expiry' })}
                </Text>
                {expiryDate && (
                  <Pressable onPress={() => setExpiryDate(null)} hitSlop={8}>
                    <X size={16} color={theme.ink3} strokeWidth={2} />
                  </Pressable>
                )}
              </Pressable>
              {showDatePicker && (
                <View
                  style={{ borderTopWidth: 0.5, borderTopColor: theme.line, paddingHorizontal: 8 }}
                >
                  <DateTimePicker
                    value={expiryDate ?? new Date()}
                    mode="date"
                    display={process.env.EXPO_OS === 'ios' ? 'inline' : 'default'}
                    onChange={(event, selectedDate) => {
                      if (process.env.EXPO_OS === 'android') setShowDatePicker(false);
                      if (event.type === 'set' && selectedDate) setExpiryDate(selectedDate);
                    }}
                    style={process.env.EXPO_OS === 'ios' ? { height: 320 } : undefined}
                  />
                </View>
              )}
            </View>

            <TextInput
              value={note}
              onChangeText={(v) => setNote(v.slice(0, 2000))}
              placeholder={t('documents.notePlaceholder', {
                defaultValue: 'Plain text note (optional)',
              })}
              placeholderTextColor={theme.ink4}
              multiline
              textAlignVertical="top"
              style={{
                backgroundColor: theme.surface,
                borderRadius: 14,
                borderCurve: 'continuous',
                padding: 14,
                fontSize: 15,
                color: theme.ink,
                minHeight: 70,
              }}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setEditing(false)}
                style={{ paddingVertical: 14, paddingHorizontal: 12 }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.ink2 }}>
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => saveMutation.mutate()}
                disabled={title.trim().length === 0 || saveMutation.isPending}
                style={{
                  flex: 1,
                  backgroundColor: title.trim().length > 0 ? theme.warm : palette.neutral400,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 14,
                  gap: 8,
                }}
              >
                <Check size={16} color={palette.white} strokeWidth={2.5} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: palette.white }}>
                  {saveMutation.isPending
                    ? t('common.saving', { defaultValue: 'Saving...' })
                    : t('common.save', { defaultValue: 'Save' })}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
