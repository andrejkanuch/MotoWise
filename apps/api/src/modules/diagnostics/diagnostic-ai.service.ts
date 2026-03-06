import { Injectable } from '@nestjs/common';

@Injectable()
export class DiagnosticAiService {
  // TODO: Implement Claude Vision API diagnostic analysis
  async analyzeDiagnosticPhoto(_imageData: Buffer, _context: unknown): Promise<unknown> {
    throw new Error('Diagnostic AI not yet implemented');
  }
}
