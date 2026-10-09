import { CreateDocumentDocument, DocumentCategoriesDocument } from '@motovault/graphql';
import { MAX_FILES_PER_DOCUMENT } from '@motovault/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, FileText, Plus, RotateCw, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import {
  DocumentCategoryChips,
  DocumentExpiryField,
} from '../../../components/documents/document-form-fields';
import {
  FormCard,
  FormDivider,
  FormSection,
  inputTextStyle,
  ROW_DIVIDER_INSET,
  SHEET_CONTENT_STYLE,
  SHEET_CONTROL_HEIGHT,
  SHEET_PRIMARY_STATE,
  SheetFooter,
  SheetTitle,
} from '../../../components/ui/sheet-form';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import {
  generateDocumentId,
  type PickedDocument,
  pickDocuments,
  removeUploadedDocumentFile,
  UPLOAD_TIMEOUT_MS,
  type UploadedDocumentFile,
  uploadDocumentFile,
  withUploadTimeout,
} from '../../../lib/document-upload';
import { gqlFetcher } from '../../../lib/graphql-client';
import { scheduleDocumentExpiryReminder } from '../../../lib/notifications';
import { queryKeys } from '../../../lib/query-keys';
import { useAuthStore } from '../../../stores/auth.store';
import { useEditorialTheme } from '../../../theme/editorial';
import { radius, SYSTEM_WEIGHT, space, type } from '../../../theme/type';
import { triggerImpact, triggerNotification } from '../../../utils/haptics';
import { toISODateInput } from '../../../utils/trip-form-dates';

type FileStatus = 'uploading' | 'done' | 'error';

interface TrayFile {
  key: string;
  picked: PickedDocument;
  status: FileStatus;
  uploaded?: UploadedDocumentFile;
}

export default function AddDocumentScreen() {
  const { t } = useTranslation();
  const { motorcycleId, bikeName } = useLocalSearchParams<{
    motorcycleId: string;
    bikeName?: string;
  }>();
  const { t: theme } = useEditorialTheme();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user?.id);

  const [documentId] = useState(generateDocumentId);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<TrayFile[]>([]);

  // Track uploaded objects + whether the document was saved, so abandoning the
  // screen (or removing a file) cleans up bytes instead of orphaning them until
  // the daily reconciliation sweep. A ref mirrors state for the unmount cleanup.
  const filesRef = useRef<TrayFile[]>([]);
  filesRef.current = files;
  const savedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (savedRef.current) return;
      for (const f of filesRef.current) {
        if (f.uploaded) void removeUploadedDocumentFile(f.uploaded.storagePath);
      }
    };
  }, []);

  const { data: categoryData } = useQuery({
    queryKey: queryKeys.documents.categories(false),
    queryFn: () => gqlFetcher(DocumentCategoriesDocument, { includeHidden: false }),
  });
  const categories = categoryData?.documentCategories ?? [];
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const promptsExpiry = selectedCategory?.promptsExpiry ?? false;

  const uploadOne = async (key: string, picked: PickedDocument) => {
    if (!userId) return;
    try {
      const uploaded = await withUploadTimeout(
        uploadDocumentFile(picked, userId, motorcycleId, documentId),
        UPLOAD_TIMEOUT_MS,
      );
      setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, status: 'done', uploaded } : f)));
    } catch {
      setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, status: 'error' } : f)));
    }
  };

  const handleAddFiles = async () => {
    triggerImpact();
    const picked = await pickDocuments();
    if (picked.length === 0) return;
    const room = MAX_FILES_PER_DOCUMENT - files.length;
    const accepted = picked.slice(0, room);
    if (picked.length > room) {
      Alert.alert(
        t('documents.cap', { defaultValue: 'File limit' }),
        t('documents.capMessage', {
          defaultValue: 'A document can hold up to {{max}} files.',
          max: MAX_FILES_PER_DOCUMENT,
        }),
      );
    }
    const newItems: TrayFile[] = accepted.map((p, i) => ({
      key: `${Date.now()}-${i}`,
      picked: p,
      status: 'uploading',
    }));
    setFiles((prev) => [...prev, ...newItems]);
    for (const item of newItems) uploadOne(item.key, item.picked);
  };

  const removeFile = (key: string) => {
    setFiles((prev) => {
      const removed = prev.find((f) => f.key === key);
      // Already uploaded → reclaim its bytes now rather than waiting for the sweep.
      if (removed?.uploaded) void removeUploadedDocumentFile(removed.uploaded.storagePath);
      return prev.filter((f) => f.key !== key);
    });
  };
  const retryFile = (item: TrayFile) => {
    setFiles((prev) => prev.map((f) => (f.key === item.key ? { ...f, status: 'uploading' } : f)));
    uploadOne(item.key, item.picked);
  };

  const allUploaded = files.length > 0 && files.every((f) => f.status === 'done');
  const isValid = title.trim().length > 0 && !!categoryId && allUploaded;

  const createMutation = useMutation({
    mutationFn: () =>
      gqlFetcher(CreateDocumentDocument, {
        input: {
          documentId,
          motorcycleId,
          categoryId: categoryId as string,
          title: title.trim(),
          expiryDate: expiryDate ? toISODateInput(expiryDate) : undefined,
          note: note.trim() || undefined,
          // Only `done` files reach here (Save is gated on allUploaded).
          files: files.map((f) => f.uploaded).filter((u): u is UploadedDocumentFile => !!u),
        },
      }),
    onSuccess: async () => {
      // Mark saved so the unmount cleanup leaves the now-persisted objects alone.
      savedRef.current = true;
      const uploadedFiles = files
        .map((f) => f.uploaded)
        .filter((u): u is UploadedDocumentFile => !!u);
      trackEvent(AnalyticsEvent.DOCUMENT_ADDED, {
        file_count: uploadedFiles.length,
        mime_types: [...new Set(uploadedFiles.map((u) => u.mimeType))],
        category: selectedCategory?.name ?? null,
        category_prompts_expiry: promptsExpiry,
        has_expiry: !!expiryDate,
        has_note: note.trim().length > 0,
        total_bytes: uploadedFiles.reduce((sum, u) => sum + u.fileSizeBytes, 0),
      });
      triggerNotification(Haptics.NotificationFeedbackType.Success);
      if (expiryDate) {
        await scheduleDocumentExpiryReminder(
          {
            id: documentId,
            title: title.trim(),
            expiryDate: toISODateInput(expiryDate),
            motorcycleId,
          },
          bikeName ?? '',
        ).catch(() => {});
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.byMotorcycle(motorcycleId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.expiring });
      router.back();
    },
    onError: () => {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('documents.createFailed', { defaultValue: 'Failed to save document. Please try again.' }),
      );
    },
  });

  const optional = t('common.optional', { defaultValue: 'optional' });

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        bottomOffset={20}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={SHEET_CONTENT_STYLE}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SheetTitle>{t('documents.addTitle', { defaultValue: 'Add a document' })}</SheetTitle>

        {/* File tray */}
        <FormSection label={t('documents.filesLabel', { defaultValue: 'Files' })} card={false}>
          <View style={{ gap: space.xs }}>
            {files.length > 0 && (
              <FormCard>
                {files.map((f, index) => (
                  <View key={f.key}>
                    {index > 0 ? <FormDivider inset={ROW_DIVIDER_INSET} /> : null}
                    <View
                      style={{
                        minHeight: SHEET_CONTROL_HEIGHT,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: space.sm,
                        paddingHorizontal: space.md,
                      }}
                    >
                      <FileText size={18} color={theme.ink2} strokeWidth={2} />
                      <Text numberOfLines={1} style={[type.subhead, { flex: 1, color: theme.ink }]}>
                        {f.picked.name}
                      </Text>
                      {f.status === 'uploading' && (
                        <ActivityIndicator size="small" color={theme.ink3} />
                      )}
                      {f.status === 'done' && (
                        <Check size={16} color={theme.success} strokeWidth={2.5} />
                      )}
                      {f.status === 'error' && (
                        <Pressable
                          onPress={() => retryFile(f)}
                          hitSlop={12}
                          accessibilityRole="button"
                          accessibilityLabel={t('common.retry', { defaultValue: 'Retry' })}
                        >
                          <RotateCw size={16} color={theme.danger} strokeWidth={2.5} />
                        </Pressable>
                      )}
                      <Pressable
                        onPress={() => removeFile(f.key)}
                        hitSlop={12}
                        accessibilityRole="button"
                        accessibilityLabel={t('common.delete')}
                      >
                        <X size={16} color={theme.ink3} strokeWidth={2.5} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </FormCard>
            )}

            <Pressable
              onPress={handleAddFiles}
              disabled={files.length >= MAX_FILES_PER_DOCUMENT}
              accessibilityRole="button"
              style={{
                minHeight: SHEET_CONTROL_HEIGHT,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: space.xs,
                borderRadius: radius.card,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: theme.line2,
                opacity: files.length >= MAX_FILES_PER_DOCUMENT ? 0.5 : 1,
              }}
            >
              <Plus size={16} color={theme.warm2} strokeWidth={2.5} />
              <Text style={[type.subhead, SYSTEM_WEIGHT.semibold, { color: theme.warm2 }]}>
                {files.length === 0
                  ? t('documents.addFiles', { defaultValue: 'Add files' })
                  : t('documents.addMoreFiles', {
                      defaultValue: 'Add more ({{count}}/{{max}})',
                      count: files.length,
                      max: MAX_FILES_PER_DOCUMENT,
                    })}
              </Text>
            </Pressable>
          </View>
        </FormSection>

        <FormSection label={t('documents.titleLabel', { defaultValue: 'Title' })}>
          <TextInput
            value={title}
            onChangeText={(v) => setTitle(v.slice(0, 200))}
            placeholder={t('documents.titlePlaceholder', {
              defaultValue: 'e.g. 2026 Insurance Policy',
            })}
            placeholderTextColor={theme.ink4}
            style={[
              inputTextStyle(theme),
              { minHeight: SHEET_CONTROL_HEIGHT, paddingHorizontal: space.md },
            ]}
          />
        </FormSection>

        <FormSection
          label={t('documents.categoryLabel', { defaultValue: 'Category' })}
          card={false}
        >
          <DocumentCategoryChips
            categories={categories}
            selectedId={categoryId}
            onSelect={setCategoryId}
            theme={theme}
          />
        </FormSection>

        {/* Expiry (prompted for expiry-bearing categories, R9) */}
        <FormSection
          label={
            <>
              {t('documents.expiryLabel', { defaultValue: 'Expiry date' })}
              {promptsExpiry ? null : (
                <Text style={{ color: theme.ink4 }}>
                  {' · '}
                  {optional}
                </Text>
              )}
            </>
          }
          card={false}
        >
          <DocumentExpiryField
            value={expiryDate}
            onChange={setExpiryDate}
            show={showDatePicker}
            setShow={setShowDatePicker}
            theme={theme}
          />
          {promptsExpiry && !expiryDate && (
            <Text
              style={[
                type.caption,
                { color: theme.dueInk, marginTop: space.xs, marginLeft: space.xxs },
              ]}
            >
              {t('documents.expiryPrompt', {
                defaultValue: 'No expiry set — this document won’t schedule a renewal reminder.',
              })}
            </Text>
          )}
        </FormSection>

        <FormSection label={t('documents.noteLabel', { defaultValue: 'Note' })}>
          <TextInput
            value={note}
            onChangeText={(v) => setNote(v.slice(0, 2000))}
            placeholder={t('documents.notePlaceholder', {
              defaultValue: 'Plain text note (optional)',
            })}
            placeholderTextColor={theme.ink4}
            multiline
            textAlignVertical="top"
            style={[
              inputTextStyle(theme),
              { paddingHorizontal: space.md, paddingVertical: space.sm, minHeight: 88 },
            ]}
          />
        </FormSection>
      </KeyboardAwareScrollView>

      <SheetFooter
        primaryTestID="document-save"
        primaryState={
          isValid && !createMutation.isPending
            ? SHEET_PRIMARY_STATE.READY
            : SHEET_PRIMARY_STATE.DISABLED
        }
        primaryIcon={Check}
        primaryLabel={
          createMutation.isPending
            ? t('common.saving', { defaultValue: 'Saving...' })
            : t('documents.save', { defaultValue: 'Save document' })
        }
        onPrimary={() => {
          triggerImpact();
          createMutation.mutate();
        }}
        onCancel={() => router.back()}
      />
    </View>
  );
}
