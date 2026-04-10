import { File, Paths } from 'expo-file-system/next';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import {
  generateDiagnosticReportHTML,
  generateMaintenanceHistoryHTML,
  type PdfBike,
  type PdfDiagnostic,
  type PdfExportOptions,
  type PdfTask,
} from './pdf-template';

export type { PdfBike, PdfDiagnostic, PdfExportOptions, PdfTask };

/**
 * Build a filesystem-safe filename: MotoVault_{Make}{Model}_ServiceHistory_{YYYY-MM-DD}.pdf
 */
function sanitize(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').slice(0, 32);
}

function buildMaintenanceFilename(bike: PdfBike): string {
  const makeModel = `${sanitize(bike.make)}${sanitize(bike.model)}`;
  const date = new Date().toISOString().slice(0, 10);
  return `MotoVault_${makeModel || 'Motorcycle'}_ServiceHistory_${date}.pdf`;
}

/**
 * MOT-141: Export maintenance history as PDF and trigger the native share sheet.
 *
 * @param options optional date range filter + label shown on the PDF header
 */
export async function exportMaintenanceHistory(
  bike: PdfBike,
  tasks: PdfTask[],
  options: PdfExportOptions = {},
): Promise<void> {
  const html = generateMaintenanceHistoryHTML(bike, tasks, options);
  const { uri: tmpUri } = await Print.printToFileAsync({ html });

  // Rename the auto-generated file to a human-friendly name before sharing.
  // expo-print returns something like file:///.../Print/xxxxx.pdf — we copy it
  // to the cache dir with our chosen filename so the share sheet picks it up.
  let finalUri = tmpUri;
  try {
    const filename = buildMaintenanceFilename(bike);
    const dest = new File(Paths.cache, filename);
    if (dest.exists) dest.delete();
    const tmp = new File(tmpUri);
    tmp.copy(dest);
    finalUri = dest.uri;
  } catch {
    // If copy fails for any reason, fall back to the temp uri.
    finalUri = tmpUri;
  }

  await shareAsync(finalUri, {
    UTI: 'com.adobe.pdf',
    mimeType: 'application/pdf',
    dialogTitle: 'Share Maintenance History',
  });
}

export async function exportDiagnosticReport(
  diagnostic: PdfDiagnostic,
  bikeName: string,
): Promise<void> {
  const html = generateDiagnosticReportHTML(diagnostic, bikeName);
  const { uri } = await Print.printToFileAsync({ html });
  await shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
