import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import {
  generateDiagnosticReportHTML,
  generateMaintenanceHistoryHTML,
  type PdfBike,
  type PdfDiagnostic,
  type PdfTask,
} from './pdf-template';

export type { PdfBike, PdfDiagnostic, PdfTask };

export async function exportMaintenanceHistory(bike: PdfBike, tasks: PdfTask[]): Promise<void> {
  const html = generateMaintenanceHistoryHTML(bike, tasks);
  const { uri } = await Print.printToFileAsync({ html });
  await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
}

export async function exportDiagnosticReport(
  diagnostic: PdfDiagnostic,
  bikeName: string,
): Promise<void> {
  const html = generateDiagnosticReportHTML(diagnostic, bikeName);
  const { uri } = await Print.printToFileAsync({ html });
  await shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
