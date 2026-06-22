import { palette } from '@motovault/design-system';
import { GetDocumentSignedUrlDocument } from '@motovault/graphql';
import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Pdf from 'react-native-pdf';
import { gqlFetcher } from '../../lib/graphql-client';

export interface ViewerFile {
  id: string;
  mimeType: string;
}

interface DocumentViewerProps {
  documentId: string;
  files: ViewerFile[];
  isDark: boolean;
}

interface LocalFile {
  id: string;
  mimeType: string;
  uri: string | null;
  error: boolean;
}

/**
 * Full-screen, JS-disabled in-app viewer for a document's file(s) (R13).
 *
 * A document has 1..N files, so this is a horizontal swipe gallery with a
 * "1 of N" counter (no chrome for single-file docs). On open we sign + download
 * every file to a private per-document cache directory and render from the local
 * `file://` uri — PDFs via react-native-pdf (no webview/JS), images via
 * expo-image. All cached bytes are deleted on unmount (no decrypted bytes
 * persisted beyond the session, R19).
 */
export function DocumentViewer({ documentId, files, isDark }: DocumentViewerProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<LocalFile[]>(() =>
    files.map((f) => ({ id: f.id, mimeType: f.mimeType, uri: null, error: false })),
  );
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(0);
  const cacheDirRef = useRef<Directory | null>(null);

  const downloadFile = useCallback(async (file: ViewerFile, dir: Directory): Promise<string> => {
    // Re-sign per open (the TTL window starts here); download to local cache.
    const { getDocumentSignedUrl } = await gqlFetcher(GetDocumentSignedUrlDocument, {
      fileId: file.id,
      download: false,
    });
    const downloaded = await File.downloadFileAsync(getDocumentSignedUrl, dir);
    return downloaded.uri;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const dir = new Directory(Paths.cache, 'doc-vault', documentId);
    cacheDirRef.current = dir;
    if (!dir.exists) dir.create({ intermediates: true });

    (async () => {
      for (const file of files) {
        try {
          const uri = await downloadFile(file, dir);
          if (cancelled) return;
          setItems((prev) => prev.map((it) => (it.id === file.id ? { ...it, uri } : it)));
        } catch {
          if (cancelled) return;
          setItems((prev) => prev.map((it) => (it.id === file.id ? { ...it, error: true } : it)));
        }
      }
    })();

    return () => {
      cancelled = true;
      // Wipe all decrypted bytes for this document on unmount.
      try {
        if (dir.exists) dir.delete();
      } catch {
        // best-effort
      }
    };
  }, [documentId, files, downloadFile]);

  /** Re-sign + re-download a file whose signed URL lapsed before it was viewed. */
  const retry = useCallback(
    async (file: ViewerFile) => {
      const dir = cacheDirRef.current;
      if (!dir) return;
      setItems((prev) => prev.map((it) => (it.id === file.id ? { ...it, error: false } : it)));
      try {
        const uri = await downloadFile(file, dir);
        setItems((prev) => prev.map((it) => (it.id === file.id ? { ...it, uri } : it)));
      } catch {
        setItems((prev) => prev.map((it) => (it.id === file.id ? { ...it, error: true } : it)));
      }
    },
    [downloadFile],
  );

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const multi = files.length > 1;

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? palette.neutral950 : palette.neutral900 }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={onLayout}
        onScroll={onScroll}
        scrollEventThrottle={16}
        scrollEnabled={multi}
        style={{ flex: 1 }}
      >
        {items.map((item) => (
          <View key={item.id} style={{ width: width || '100%', flex: 1 }}>
            {item.error ? (
              <Pressable
                onPress={() => retry(item)}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Text style={{ color: palette.neutral300, fontSize: 14, fontWeight: '600' }}>
                  {t('documents.viewerRetry', { defaultValue: 'Tap to retry' })}
                </Text>
              </Pressable>
            ) : !item.uri ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={palette.primary400} />
              </View>
            ) : item.mimeType === 'application/pdf' ? (
              <Pdf
                source={{ uri: item.uri }}
                trustAllCerts={false}
                style={{ flex: 1, width: width || undefined, backgroundColor: 'transparent' }}
                onError={() => retry(item)}
              />
            ) : (
              <Image
                source={{ uri: item.uri }}
                contentFit="contain"
                style={{ flex: 1 }}
                onError={() => retry(item)}
              />
            )}
          </View>
        ))}
      </ScrollView>

      {multi && (
        <View
          style={{
            position: 'absolute',
            bottom: 24,
            alignSelf: 'center',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            borderCurve: 'continuous',
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
        >
          <Text style={{ color: palette.white, fontSize: 13, fontWeight: '600' }}>
            {t('documents.viewerCounter', {
              defaultValue: '{{current}} of {{total}}',
              current: page + 1,
              total: files.length,
            })}
          </Text>
        </View>
      )}
    </View>
  );
}
