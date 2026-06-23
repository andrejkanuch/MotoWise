import { palette } from '@motovault/design-system';
import { CreateDocumentDocument, DocumentCategoriesDocument } from '@motovault/graphql';
import { MAX_FILES_PER_DOCUMENT } from '@motovault/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, FileText, Plus, RotateCw, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import {
  DocumentCategoryChips,
  DocumentExpiryField,
} from '../../../components/documents/document-form-fields';
import {
  generateDocumentId,
  type PickedDocument,
  pickDocuments,
  type UploadedDocumentFile,
  uploadDocumentFile,
} from '../../../lib/document-upload';
import { gqlFetcher } from '../../../lib/graphql-client';
import { scheduleDocumentExpiryReminder } from '../../../lib/notifications';
import { queryKeys } from '../../../lib/query-keys';
import { useAuthStore } from '../../../stores/auth.store';
import { useEditorialTheme } from '../../../theme/editorial';
import { triggerImpact, triggerNotification } from '../../../utils/haptics';
import { toISODateInput } from '../../../utils/trip-form-dates';

/** Per-file upload timeout so a stalled storage request can't pin a tray file in
 *  'uploading' forever (which would block Save, gated on allUploaded). On timeout
 *  the slot flips to 'error' (retryable); the orphaned object is reclaimed by the
 *  U13 reconciliation sweep. */
const UPLOAD_TIMEOUT_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('upload_timeout')), ms)),
  ]);
}

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
  const { t: theme, isDark } = useEditorialTheme();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user?.id);

  const [documentId] = useState(generateDocumentId);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<TrayFile[]>([]);

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
      const uploaded = await withTimeout(
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

  const removeFile = (key: string) => setFiles((prev) => prev.filter((f) => f.key !== key));
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

  const cardBg = theme.surface;
  const labelStyle = {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    color: theme.ink3,
    marginBottom: 8,
    marginLeft: 4,
  };

  return (
    <KeyboardAwareScrollView
      bottomOffset={20}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 24 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingTop: 8 }}>
        <Text style={{ fontFamily: 'InstrumentSerif-Regular', fontSize: 32, color: theme.ink }}>
          {t('documents.addTitle', { defaultValue: 'Add a document' })}
        </Text>
      </View>

      {/* File tray */}
      <View>
        <Text style={labelStyle}>{t('documents.filesLabel', { defaultValue: 'Files' })}</Text>
        <View style={{ gap: 8 }}>
          {files.map((f) => (
            <View
              key={f.key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                backgroundColor: cardBg,
                borderRadius: 12,
                borderCurve: 'continuous',
                padding: 12,
              }}
            >
              <FileText size={18} color={palette.primary400} strokeWidth={2} />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: theme.ink }}>
                {f.picked.name}
              </Text>
              {f.status === 'uploading' && (
                <ActivityIndicator size="small" color={palette.primary500} />
              )}
              {f.status === 'done' && (
                <Check size={16} color={palette.success500} strokeWidth={2.5} />
              )}
              {f.status === 'error' && (
                <Pressable onPress={() => retryFile(f)} hitSlop={8}>
                  <RotateCw size={16} color={palette.danger500} strokeWidth={2.5} />
                </Pressable>
              )}
              <Pressable onPress={() => removeFile(f.key)} hitSlop={8}>
                <X size={16} color={theme.ink3} strokeWidth={2.5} />
              </Pressable>
            </View>
          ))}

          <Pressable
            onPress={handleAddFiles}
            disabled={files.length >= MAX_FILES_PER_DOCUMENT}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderRadius: 12,
              borderCurve: 'continuous',
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: theme.line,
              paddingVertical: 14,
              opacity: files.length >= MAX_FILES_PER_DOCUMENT ? 0.5 : 1,
            }}
          >
            <Plus size={16} color={theme.warm} strokeWidth={2.5} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.warm }}>
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
      </View>

      {/* Title */}
      <View>
        <Text style={labelStyle}>{t('documents.titleLabel', { defaultValue: 'Title' })}</Text>
        <TextInput
          value={title}
          onChangeText={(v) => setTitle(v.slice(0, 200))}
          placeholder={t('documents.titlePlaceholder', {
            defaultValue: 'e.g. 2026 Insurance Policy',
          })}
          placeholderTextColor={theme.ink4}
          style={{
            backgroundColor: cardBg,
            borderRadius: 14,
            borderCurve: 'continuous',
            padding: 16,
            fontSize: 15,
            color: theme.ink,
          }}
        />
      </View>

      {/* Category chips */}
      <View>
        <Text style={labelStyle}>{t('documents.categoryLabel', { defaultValue: 'Category' })}</Text>
        <DocumentCategoryChips
          categories={categories}
          selectedId={categoryId}
          onSelect={setCategoryId}
          theme={theme}
        />
      </View>

      {/* Expiry (prompted for expiry-bearing categories, R9) */}
      <View>
        <Text style={labelStyle}>
          {t('documents.expiryLabel', { defaultValue: 'Expiry date' })}
          {promptsExpiry ? '' : ` (${t('common.optional', { defaultValue: 'optional' })})`}
        </Text>
        <DocumentExpiryField
          value={expiryDate}
          onChange={setExpiryDate}
          show={showDatePicker}
          setShow={setShowDatePicker}
          theme={theme}
        />
        {promptsExpiry && !expiryDate && (
          <Text style={{ fontSize: 12, color: palette.warning500, marginTop: 6, marginLeft: 4 }}>
            {t('documents.expiryPrompt', {
              defaultValue: 'No expiry set — this document won’t schedule a renewal reminder.',
            })}
          </Text>
        )}
      </View>

      {/* Note */}
      <View>
        <Text style={labelStyle}>{t('documents.noteLabel', { defaultValue: 'Note' })}</Text>
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
            backgroundColor: cardBg,
            borderRadius: 14,
            borderCurve: 'continuous',
            padding: 16,
            fontSize: 15,
            color: theme.ink,
            minHeight: 80,
          }}
        />
      </View>

      {/* Footer */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Pressable
          onPress={() => router.back()}
          style={{ paddingVertical: 16, paddingHorizontal: 12 }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: theme.ink2 }}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            triggerImpact();
            createMutation.mutate();
          }}
          disabled={!isValid || createMutation.isPending}
          style={{
            flex: 1,
            backgroundColor: isValid
              ? theme.warm
              : isDark
                ? palette.neutral700
                : palette.neutral300,
            borderRadius: 14,
            borderCurve: 'continuous',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 16,
            gap: 8,
          }}
        >
          <Check size={18} color={palette.white} strokeWidth={2.5} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: palette.white }}>
            {createMutation.isPending
              ? t('common.saving', { defaultValue: 'Saving...' })
              : t('documents.save', { defaultValue: 'Save document' })}
          </Text>
        </Pressable>
      </View>
    </KeyboardAwareScrollView>
  );
}
