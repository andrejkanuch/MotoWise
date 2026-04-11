import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { HealthReport } from './models/health-report.model';
import type { ReportData } from './pdf/report-template';

const SIGNED_URL_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours
const STORAGE_BUCKET = 'reports';

/** Local row interface matching bike_health_reports DB columns from migration 00056 */
interface HealthReportRow {
  id: string;
  user_id: string;
  bike_id: string;
  status: string;
  pdf_signed_url: string | null;
  pdf_storage_path: string | null;
  iap_transaction_id: string | null;
  purchased_at: string;
  download_expires_at: string | null;
}

/** Shape returned by the motorcycles select in generateReport */
interface BikeRow {
  make: string;
  model: string;
  year: number;
  nickname: string | null;
  current_mileage: number | null;
  mileage_unit: string | null;
}

/** Shape returned by the maintenance_tasks select */
interface TaskRow {
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
}

/** Shape returned by the expenses select */
interface ExpenseRow {
  amount: number;
}

@Injectable()
export class HealthReportsService {
  private readonly logger = new Logger(HealthReportsService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
  ) {}

  /**
   * Generate a bike health report PDF.
   * 1. Verify bike ownership via SUPABASE_USER (RLS)
   * 2. Gather bike data, maintenance tasks, expenses
   * 3. Render PDF via @react-pdf/renderer
   * 4. Upload to Supabase Storage
   * 5. Create signed URL and DB record
   */
  async generateReport(userId: string, bikeId: string): Promise<HealthReport> {
    // 1. Verify bike ownership with RLS-scoped client
    const { data: bike, error: bikeError } = await this.supabase
      .from('motorcycles')
      .select('id, make, model, year, nickname, current_mileage, mileage_unit')
      .eq('id', bikeId)
      .eq('user_id', userId)
      .single();

    if (bikeError || !bike) {
      throw new ForbiddenException('Motorcycle not found or not owned by user');
    }

    const typedBike = bike as unknown as BikeRow;

    // 2. Find existing pending report (created by RevenueCat webhook on purchase)
    const { data: report, error: reportError } = await this.supabaseAdmin
      .from('bike_health_reports')
      .select()
      .eq('user_id', userId)
      .eq('bike_id', bikeId)
      .eq('status', 'pending')
      .order('purchased_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reportError) {
      throw new InternalServerErrorException('Failed to check health report purchase status');
    }

    if (!report) {
      throw new ForbiddenException(
        'No valid purchase found. Please purchase a Health Report first.',
      );
    }

    const typedReport = report as unknown as HealthReportRow;
    const reportId = typedReport.id;

    try {
      // 3. Gather data for the report using admin (cross-table reads)
      const [tasksResult, expensesResult] = await Promise.all([
        this.supabaseAdmin
          .from('maintenance_tasks')
          .select('title, status, priority, due_date, completed_at')
          .eq('motorcycle_id', bikeId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        this.supabaseAdmin
          .from('expenses')
          .select('amount')
          .eq('motorcycle_id', bikeId)
          .is('deleted_at', null),
      ]);

      const tasks = ((tasksResult.data ?? []) as unknown as TaskRow[]).map((t) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.due_date ?? undefined,
        completedAt: t.completed_at ?? undefined,
      }));

      const expenses = (expensesResult.data ?? []) as unknown as ExpenseRow[];
      const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount ?? 0), 0);

      const reportData: ReportData = {
        bike: {
          make: typedBike.make,
          model: typedBike.model,
          year: typedBike.year,
          nickname: typedBike.nickname ?? undefined,
          currentMileage: typedBike.current_mileage ?? undefined,
          mileageUnit: typedBike.mileage_unit ?? undefined,
        },
        tasks,
        generatedAt: new Date().toISOString(),
        totalExpenses: totalExpenses > 0 ? totalExpenses : undefined,
      };

      // 4. Render PDF
      const pdfBuffer = await this.renderPdf(reportData);

      // 5. Upload to Supabase Storage
      const timestamp = Date.now();
      const storagePath = `${userId}/${bikeId}/${timestamp}.pdf`;

      const { error: uploadError } = await this.supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (uploadError) {
        throw new InternalServerErrorException(`Failed to upload PDF: ${uploadError.message}`);
      }

      // 6. Create signed URL
      const { data: signedUrlData, error: signedUrlError } = await this.supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

      if (signedUrlError || !signedUrlData) {
        throw new InternalServerErrorException('Failed to create signed URL');
      }

      // 7. Update report record as completed
      const { data: updatedReport, error: updateError } = await this.supabaseAdmin
        .from('bike_health_reports')
        .update({
          status: 'completed',
          pdf_storage_path: storagePath,
          pdf_signed_url: signedUrlData.signedUrl,
          download_expires_at: new Date(
            Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000,
          ).toISOString(),
        })
        .eq('id', reportId)
        .select()
        .single();

      if (updateError || !updatedReport) {
        throw new InternalServerErrorException('Failed to update health report record');
      }

      return this.mapRow(updatedReport as unknown as HealthReportRow);
    } catch (error) {
      // Mark report as failed
      await this.supabaseAdmin
        .from('bike_health_reports')
        .update({ status: 'failed' })
        .eq('id', reportId);

      throw error;
    }
  }

  async getMyReports(userId: string): Promise<HealthReport[]> {
    const { data, error } = await this.supabase
      .from('bike_health_reports')
      .select('*')
      .eq('user_id', userId)
      .order('purchased_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException('Failed to fetch health reports');
    }

    // Refresh signed URLs for completed reports
    const reports = await Promise.all(
      (data ?? []).map(async (row) => {
        const typedRow = row as unknown as HealthReportRow;
        const report = this.mapRow(typedRow);
        if (report.status === 'completed' && typedRow.pdf_storage_path) {
          const { data: signedUrlData } = await this.supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(typedRow.pdf_storage_path, SIGNED_URL_EXPIRY_SECONDS);
          if (signedUrlData) {
            report.pdfUrl = signedUrlData.signedUrl;
          }
        }
        return report;
      }),
    );

    return reports;
  }

  /**
   * Validate that an IAP transaction ID exists and hasn't been used for another report.
   * Called by RevenueCat webhook handler before creating a report record.
   */
  async validatePurchase(iapTransactionId: string): Promise<boolean> {
    if (!iapTransactionId) {
      throw new BadRequestException('Missing IAP transaction ID');
    }

    const { data: existing, error } = await this.supabaseAdmin
      .from('bike_health_reports')
      .select('id')
      .eq('iap_transaction_id', iapTransactionId)
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to validate purchase: ${error.message}`);
      throw new InternalServerErrorException('Failed to validate purchase');
    }

    if (existing) {
      throw new ConflictException('Transaction already used for a health report');
    }

    return true;
  }

  /**
   * Create a pending report record from a validated IAP purchase.
   * Called by RevenueCat webhook handler for NON_RENEWING_PURCHASE events.
   */
  async createFromPurchase(
    userId: string,
    motorcycleId: string | null,
    iapTransactionId: string,
  ): Promise<void> {
    await this.validatePurchase(iapTransactionId);

    const { error } = await this.supabaseAdmin.from('bike_health_reports').insert({
      user_id: userId,
      bike_id: motorcycleId,
      iap_transaction_id: iapTransactionId,
      status: 'pending',
      purchased_at: new Date().toISOString(),
    });

    if (error) {
      this.logger.error(`Failed to create report from purchase: ${error.message}`);
      throw new InternalServerErrorException('Failed to create health report from purchase');
    }

    this.logger.log(`Created pending health report for user ${userId} via IAP ${iapTransactionId}`);
  }

  private async renderPdf(data: ReportData): Promise<Buffer> {
    try {
      // Dynamic import — @react-pdf/renderer may not be installed yet
      const { renderToBuffer } = await import('@react-pdf/renderer');
      const { ReportTemplate } = await import('./pdf/report-template.js');
      const React = await import('react');

      const doc = React.createElement(ReportTemplate, { data });
      const buffer = await renderToBuffer(doc as never);
      return Buffer.from(buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`PDF rendering failed: ${message}`);
      throw new InternalServerErrorException(
        '@react-pdf/renderer is not installed or PDF rendering failed. ' +
          'Install it with: pnpm --filter api add @react-pdf/renderer react',
      );
    }
  }

  private mapRow(row: HealthReportRow): HealthReport {
    return {
      id: row.id,
      userId: row.user_id,
      motorcycleId: row.bike_id,
      status: row.status,
      pdfUrl: row.pdf_signed_url ?? undefined,
      iapTransactionId: row.iap_transaction_id ?? undefined,
      createdAt: row.purchased_at,
      completedAt: row.download_expires_at ?? undefined,
    };
  }
}
