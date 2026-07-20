import { Directory, File, Paths } from 'expo-file-system';
import { logger } from '../../lib/logger';

/**
 * Durable storage for captured receipt photos (R3 offline hero story).
 *
 * The camera/library returns a URI in the OS **cache** directory, which the
 * system may purge at any time (and reliably does on low storage / app kill).
 * Before we persist any pending scan record we copy the photo into the
 * **document** directory, which is safe from system deletion — so an
 * airplane-mode capture survives a force-kill and uploads on reconnect.
 *
 * Files are keyed by scanId so a retry of the same scan overwrites cleanly and
 * cleanup after a successful upload is a single deterministic delete.
 */

const DURABLE_DIR_NAME = 'receipt-scans';

/** The durable directory, created on first use (idempotent). */
function durableDir(): Directory {
  const dir = new Directory(Paths.document, DURABLE_DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

function durableFile(scanId: string): File {
  return new File(durableDir(), `${scanId}.jpg`);
}

/**
 * Copy a freshly-captured (cache) photo into the durable document directory.
 * Returns the durable `file://` URI. Overwrites any prior copy for this scanId.
 */
export function persistDurablePhoto(cacheUri: string, scanId: string): string {
  const dest = durableFile(scanId);
  if (dest.exists) dest.delete();
  new File(cacheUri).copySync(dest);
  return dest.uri;
}

/** The durable URI for a scan, or null if it no longer exists on disk. */
export function getDurablePhotoUri(scanId: string): string | null {
  const file = durableFile(scanId);
  return file.exists ? file.uri : null;
}

/** Best-effort cleanup of a durable photo once its scan is uploaded or abandoned. */
export function deleteDurablePhoto(scanId: string): void {
  try {
    const file = durableFile(scanId);
    if (file.exists) file.delete();
  } catch (err) {
    // Cleanup failure is non-fatal — the file is small and keyed by scanId, so a
    // later retry/overwrite reclaims it. Log rather than throw into the flow.
    logger.warn('receipt-scan: failed to delete durable photo', err);
  }
}
