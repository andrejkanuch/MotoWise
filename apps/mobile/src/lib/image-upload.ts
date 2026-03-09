import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

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

export async function uploadMaintenancePhoto(
  uri: string,
  userId: string,
  taskId: string,
): Promise<{ storagePath: string; fileSizeBytes: number }> {
  const compressedUri = await compressImage(uri);
  const base64 = await FileSystem.readAsStringAsync(compressedUri, {
    encoding: 'base64',
  });
  const filePath = `${userId}/${taskId}/${Date.now()}.webp`;
  const { error } = await supabase.storage
    .from('maintenance-photos')
    .upload(filePath, decode(base64), {
      contentType: 'image/webp',
      upsert: false,
    });
  if (error) throw error;
  const fileInfo = await FileSystem.getInfoAsync(compressedUri);
  return {
    storagePath: filePath,
    fileSizeBytes: fileInfo.exists ? (fileInfo.size ?? 0) : 0,
  };
}
