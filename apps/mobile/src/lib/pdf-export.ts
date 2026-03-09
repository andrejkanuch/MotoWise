import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { generateMaintenanceHistoryHTML, type PdfBike, type PdfTask } from './pdf-template';

export type { PdfBike, PdfTask };

export async function exportMaintenanceHistory(bike: PdfBike, tasks: PdfTask[]): Promise<void> {
  const html = generateMaintenanceHistoryHTML(bike, tasks);
  const { uri } = await Print.printToFileAsync({ html });
  await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
}
