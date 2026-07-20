/**
 * Node replica of the mobile `compressReceiptImage` profile (KTD-8) for the U1 spike.
 *
 * The mobile app compresses via `expo-image-manipulator` (a native module, not
 * runnable in Node), so this reproduces the SAME profile with `sharp`:
 *
 *   Gallery profile (compressImage):        width 1200,  WebP quality 0.70  ← too lossy for invoice text
 *   Receipt profile (compressReceiptImage): width 1920+, WebP quality ~0.85 (mild)  ← what the spike must use
 *
 * `withoutEnlargement` mirrors the intent of "≥1920px" — never upscale a small
 * source, only cap large phone photos down to a 1920px long edge. Resizing on
 * the longest edge (fit: 'inside') matches how a portrait receipt photo is
 * downscaled on device.
 */
import sharp from 'sharp';

/** Receipt compression profile — MUST stay in sync with mobile `compressReceiptImage` (KTD-8). */
export const RECEIPT_COMPRESSION = {
  maxLongEdgePx: 1920,
  webpQuality: 85, // "mild" — sharp uses 0–100; mobile 0.85 maps here
} as const;

export interface CompressedImage {
  base64: string;
  bytes: number;
  width: number;
  height: number;
}

export async function compressReceiptImage(inputPath: string): Promise<CompressedImage> {
  const pipeline = sharp(inputPath, { failOn: 'none' })
    .rotate() // honour EXIF orientation, as the device manipulator does
    .resize({
      width: RECEIPT_COMPRESSION.maxLongEdgePx,
      height: RECEIPT_COMPRESSION.maxLongEdgePx,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: RECEIPT_COMPRESSION.webpQuality });

  const buffer = await pipeline.toBuffer();
  const meta = await sharp(buffer).metadata();

  return {
    base64: buffer.toString('base64'),
    bytes: buffer.byteLength,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
  };
}
