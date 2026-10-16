import { MeasurementSystem } from '@motovault/types';
import { Logger } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import type { AiBudgetService } from '../ai-budget/ai-budget.service';
import type { MotorcyclesService } from '../motorcycles/motorcycles.service';
import type { UsersService } from '../users/users.service';
import type { DiagnosticAiService } from './diagnostic-ai.service';
import type { DiagnosticContextBuilder } from './diagnostic-context.builder';
import { BIKE_CONTEXT_SCOPE } from './diagnostic-context.format';
import { DiagnosticsResolver } from './diagnostics.resolver';
import type { DiagnosticsService } from './diagnostics.service';
import type { SubmitDiagnosticInput } from './dto/submit-diagnostic.input';

const USER = { id: 'user-1' } as AuthUser;
const BIKE_ID = '11111111-1111-4111-8111-111111111111';
const DIAGNOSTIC_ID = 'diag-1';
const BIKE_CONTEXT = 'Completed services (newest first):\n- 2026-06-01 | Stator replaced';

describe('DiagnosticsResolver.submitDiagnostic bike context', () => {
  const diagnosticsService = {
    create: vi.fn(),
    findById: vi.fn(),
  };
  const diagnosticAiService = { analyze: vi.fn() };
  const motorcyclesService = { findById: vi.fn() };
  const contextBuilder = { build: vi.fn() };
  const usersService = { findById: vi.fn() };
  const aiBudgetService = { enforceFeatureLimit: vi.fn() };

  let resolver: DiagnosticsResolver;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    diagnosticsService.create.mockResolvedValue({ id: DIAGNOSTIC_ID });
    diagnosticsService.findById.mockResolvedValue({ id: DIAGNOSTIC_ID });
    motorcyclesService.findById.mockResolvedValue({
      id: BIKE_ID,
      make: 'Harley-Davidson',
      model: 'Dyna Wide Glide',
      year: 1999,
      currentMileage: 41_000,
      variant: 'FXDWG',
    });
    usersService.findById.mockResolvedValue({
      preferences: {},
      measurementSystem: MeasurementSystem.IMPERIAL,
    });
    contextBuilder.build.mockResolvedValue(BIKE_CONTEXT);

    resolver = new DiagnosticsResolver(
      diagnosticsService as unknown as DiagnosticsService,
      diagnosticAiService as unknown as DiagnosticAiService,
      motorcyclesService as unknown as MotorcyclesService,
      contextBuilder as unknown as DiagnosticContextBuilder,
      usersService as unknown as UsersService,
      aiBudgetService as unknown as AiBudgetService,
    );
  });

  const submit = (overrides: Partial<SubmitDiagnosticInput>) =>
    resolver.submitDiagnostic(USER, {
      dataSharingOptedIn: false,
      includeMaintenanceHistory: false,
      freeTextDescription: 'Battery not charging',
      ...overrides,
    } as SubmitDiagnosticInput);

  const sentBikeContext = () => diagnosticAiService.analyze.mock.calls[0][3].bikeContext;

  it('sends the full bike history when the new consent flag is on', async () => {
    // Act
    await submit({
      motorcycleId: BIKE_ID,
      includeBikeHistory: true,
      includeMaintenanceHistory: true,
    });

    // Assert
    expect(contextBuilder.build).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER.id,
        motorcycleId: BIKE_ID,
        currentDiagnosticId: DIAGNOSTIC_ID,
        scope: BIKE_CONTEXT_SCOPE.FULL,
        measurementSystem: MeasurementSystem.IMPERIAL,
        currentMileage: 41_000,
        symptoms: expect.objectContaining({ freeTextDescription: 'Battery not charging' }),
      }),
    );
    expect(sentBikeContext()).toBe(BIKE_CONTEXT);
  });

  it('limits an older app that only sends the maintenance-history flag to the maintenance scope', async () => {
    await submit({ motorcycleId: BIKE_ID, includeMaintenanceHistory: true });

    expect(contextBuilder.build).toHaveBeenCalledWith(
      expect.objectContaining({ scope: BIKE_CONTEXT_SCOPE.MAINTENANCE }),
    );
  });

  it.each([
    ['both flags off', { includeMaintenanceHistory: false }],
    ['the new flag explicitly off', { includeBikeHistory: false, includeMaintenanceHistory: true }],
  ])('sends no bike history with %s', async (_label, flags) => {
    await submit({ motorcycleId: BIKE_ID, ...flags });

    expect(contextBuilder.build).not.toHaveBeenCalled();
    expect(sentBikeContext()).toBeUndefined();
  });

  it('sends no bike history for a manually described bike', async () => {
    await submit({
      manualBikeInfo: { type: 'cruiser', make: 'Harley-Davidson' },
      includeBikeHistory: true,
    });

    expect(contextBuilder.build).not.toHaveBeenCalled();
    expect(sentBikeContext()).toBeUndefined();
  });
});
