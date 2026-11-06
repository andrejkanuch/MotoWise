import { ArgumentMetadata, BadRequestException, Logger, PipeTransform } from '@nestjs/common';
import { type ZodSchema, type z } from 'zod';

/** Issues logged per rejection; one bad array can carry hundreds. */
const MAX_LOGGED_ISSUES = 10;

function describeIssues(issues: readonly z.core.$ZodIssue[]): string {
  const shown = issues
    .slice(0, MAX_LOGGED_ISSUES)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
  const more = issues.length - shown.length;
  return more > 0 ? `${shown.join('; ')}; +${more} more` : shown.join('; ');
}

export class ZodValidationPipe implements PipeTransform {
  private readonly logger = new Logger(ZodValidationPipe.name);

  constructor(private schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    if (value === null || value === undefined) return value;
    const result = this.schema.safeParse(value);
    if (!result.success) {
      // Full issue paths: `flatten().fieldErrors` keeps only the top-level key, so
      // a bad nested field logged as `{"waypoints":["Invalid"]}` and the ride-sync
      // rejections behind MOTO-VAULT-REACT-NATIVE-3Z/-40 could not be traced.
      this.logger.warn(`Validation failed: ${describeIssues(result.error.issues)}`);
      throw new BadRequestException('Please check your input and try again.');
    }
    return result.data;
  }
}
