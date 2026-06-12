import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

const WEBP_CONTENT_TYPE = 'image/webp';
const BIKE_PHOTOS_BUCKET = 'bike-photos';
const MAINTENANCE_PHOTOS_BUCKET = 'maintenance-photos';

export async function pickImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (result.canceled) return null;
  return result.assets[0].uri;
}

export async function takePhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return null;
  const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
  if (result.canceled) return null;
  return result.assets[0].uri;
}

export async function compressImage(uri: string, maxWidth = 1200): Promise<string> {
  const result = await manipulateAsync(uri, [{ resize: { width: maxWidth } }], {
    compress: 0.7,
    format: SaveFormat.WEBP,
  });
  return result.uri;
}

/**
 * Compress an image and read it back as raw bytes ready for Supabase Storage.
 *
 * Reads via expo-file-system's `File.bytes()` (a native byte read) instead of
 * `fetch(uri).arrayBuffer()` — the latter is unreliable on React Native/Hermes
 * and can silently resolve to a 0-byte buffer, producing an empty upload.
 */
async function readImageBytes(uri: string): Promise<Uint8Array> {
  const compressedUri = await compressImage(uri);
  return new File(compressedUri).bytes();
}

/**
 * Upload a bike's hero photo to Supabase Storage and return its public URL.
 *
 * Pass `motorcycleId` for an existing bike (canonical per-bike path). During
 * onboarding the bike row does not exist yet, so omit it — the object is keyed
 * by user only (`{userId}/onboarding/hero.webp`) and the returned URL is handed
 * to `complete_onboarding`, which stores it as `primary_photo_url` on creation.
 * Bucket RLS only requires the first path segment to match the uid; motorcycleId
 * is a UUID, so it never collides with the literal `onboarding` segment.
 */
export async function uploadBikePhoto(
  uri: string,
  userId: string,
  motorcycleId?: string,
): Promise<{ publicUrl: string }> {
  const bytes = await readImageBytes(uri);
  const filePath = `${userId}/${motorcycleId ?? 'onboarding'}/hero.webp`;
  const { error } = await supabase.storage.from(BIKE_PHOTOS_BUCKET).upload(filePath, bytes, {
    contentType: WEBP_CONTENT_TYPE,
    upsert: true,
  });
  if (error) throw error;
  const {
    data: { publicUrl },
  } = supabase.storage.from(BIKE_PHOTOS_BUCKET).getPublicUrl(filePath);
  // Append cache-buster so CDN/expo-image shows the new image after re-upload.
  return { publicUrl: `${publicUrl}?t=${Date.now()}` };
}

export async function uploadMaintenancePhoto(
  uri: string,
  userId: string,
  taskId: string,
): Promise<{ storagePath: string; fileSizeBytes: number }> {
  const bytes = await readImageBytes(uri);
  const filePath = `${userId}/${taskId}/${Date.now()}.webp`;
  const { error } = await supabase.storage.from(MAINTENANCE_PHOTOS_BUCKET).upload(filePath, bytes, {
    contentType: WEBP_CONTENT_TYPE,
    upsert: false,
  });
  if (error) throw error;
  return {
    storagePath: filePath,
    fileSizeBytes: bytes.byteLength,
  };
}

/**
 * Upload a receipt photo for an expense.
 *
 * Reuses the existing 'maintenance-photos' bucket with an `expenses/` path prefix
 * so we inherit the same RLS policies (uid must match the first folder segment).
 * MOT-143
 */
export async function uploadExpensePhoto(
  uri: string,
  userId: string,
  expenseId: string,
): Promise<{ storagePath: string; fileSizeBytes: number }> {
  const bytes = await readImageBytes(uri);
  const filePath = `${userId}/expenses/${expenseId}/${Date.now()}.webp`;
  const { error } = await supabase.storage.from(MAINTENANCE_PHOTOS_BUCKET).upload(filePath, bytes, {
    contentType: WEBP_CONTENT_TYPE,
    upsert: false,
  });
  if (error) throw error;
  return {
    storagePath: filePath,
    fileSizeBytes: bytes.byteLength,
  };
}
