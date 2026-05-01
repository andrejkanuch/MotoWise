import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { generateDiagnosticReportHTML, type PdfDiagnostic } from './pdf-template';

export type { PdfDiagnostic };

export async function exportDiagnosticReport(
  diagnostic: PdfDiagnostic,
  bikeName: string,
): Promise<void> {
  const html = generateDiagnosticReportHTML(diagnostic, bikeName);
  const { uri } = await Print.printToFileAsync({ html });
  await shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
