import { Injectable, Logger, type OnModuleInit, ServiceUnavailableException } from '@nestjs/common';

interface NhtsaMakeResponse {
  Results: Array<{ MakeId: number; MakeName: string }>;
}

interface NhtsaModelResponse {
  Results: Array<{ Model_ID: number; Model_Name: string }>;
}

interface NhtsaRecallRawResult {
  NHTSACampaignNumber?: string;
  ReportReceivedDate?: string;
  Component?: string;
  Summary?: string;
  Consequence?: string;
  Remedy?: string;
}

interface NhtsaRecallResponse {
  Count?: number;
  Message?: string;
  results?: NhtsaRecallRawResult[];
  Results?: NhtsaRecallRawResult[];
}

export interface RecallDto {
  campaignNumber: string;
  reportDate: string;
  component: string;
  summary: string;
  consequence: string;
  remedy: string;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export interface MotorcycleMakeDto {
  makeId: number;
  makeName: string;
  isPopular: boolean;
}

export interface MotorcycleModelDto {
  modelId: number;
  modelName: string;
}

// NHTSA vPIC returns MakeName in ALL CAPS — match exactly
const POPULAR_MAKES = new Set([
  'HONDA',
  'YAMAHA',
  'KAWASAKI',
  'SUZUKI',
  'HARLEY-DAVIDSON',
  'BMW',
  'DUCATI',
  'KTM',
  'TRIUMPH',
  'ROYAL ENFIELD',
  'INDIAN MOTORCYCLE',
  'APRILIA',
  'HUSQVARNA',
  'MOTO GUZZI',
  'MV AGUSTA',
  'BENELLI',
  'CFMOTO',
  'ZERO MOTORCYCLES',
  'CAN-AM',
  'POLARIS',
  'BUELL',
  'NORTON',
  'BSA',
  'VESPA',
  'PIAGGIO',
  'SYM',
  'KYMCO',
  'GASGAS',
  'BETA',
  'SHERCO',
  'TM RACING',
  'HUSABERG',
  'CAGIVA',
  'BIMOTA',
  'ENERGICA',
  'LIVEWIRE',
]);

const MS_PER_DAY = 86_400_000;
const MAKES_TTL = MS_PER_DAY; // 24 hours
const MODELS_TTL = MS_PER_DAY * 7; // 7 days
const RECALLS_TTL = MS_PER_DAY; // 24 hours (per MOT-142 spec)

@Injectable()
export class NhtsaService implements OnModuleInit {
  private static readonly MAX_MODELS_CACHE = 500;
  // P2-112: Cap recall cache to prevent unbounded memory growth from
  // attackers spraying unique VINs through the motorcycleRecalls query.
  private static readonly MAX_RECALLS_CACHE = 1_000;

  private readonly logger = new Logger(NhtsaService.name);
  private makesCache: CacheEntry<MotorcycleMakeDto[]> | null = null;
  private readonly modelsCache = new Map<string, CacheEntry<MotorcycleModelDto[]>>();
  private readonly recallsCache = new Map<string, CacheEntry<RecallDto[]>>();

  /**
   * Shared NHTSA fetch: 10s abort-timeout, non-ok → log + ServiceUnavailable,
   * abort → timeout message, network failure → unreachable message. Extracted
   * from the three near-identical fetch blocks below.
   *
   * `on404` lets a caller treat HTTP 404 as a sentinel value (NHTSA returns 404
   * for "no recalls found") instead of an error — when omitted, 404 falls
   * through to the generic non-ok branch.
   */
  private async fetchJson<T>(
    url: string,
    messages: { notOkLog: string; notOkThrow: string; timeout: string; unreachable: string },
    on404?: () => T,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        // NHTSA's recalls endpoint returns 400 (not 404) with a valid
        // "Results returned successfully" body (Count: 0) when a make/model/year
        // has no matching recalls — extremely common for motorcycles. Vehicles
        // that DO have recalls return 200, so treating 400/404 as "none found"
        // (for callers that opt in via on404) never drops real recalls.
        if ((response.status === 404 || response.status === 400) && on404) {
          return on404();
        }
        this.logger.error(`${messages.notOkLog}: ${response.status}`);
        throw new ServiceUnavailableException(messages.notOkThrow);
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ServiceUnavailableException(messages.timeout);
      }
      throw new ServiceUnavailableException(messages.unreachable);
    } finally {
      clearTimeout(timeout);
    }
  }

  async onModuleInit() {
    try {
      await this.getMakes();
      this.logger.log('NHTSA makes cache warmed');
    } catch (e) {
      this.logger.warn('Failed to warm NHTSA cache', e);
    }
  }

  async getMakes(): Promise<MotorcycleMakeDto[]> {
    if (this.makesCache && Date.now() < this.makesCache.expiresAt) {
      return this.makesCache.data;
    }

    const url =
      'https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/motorcycle?format=json';

    const json = await this.fetchJson<NhtsaMakeResponse>(url, {
      notOkLog: 'NHTSA makes request failed',
      notOkThrow: 'Failed to fetch motorcycle makes from NHTSA',
      timeout: 'NHTSA API request timed out',
      unreachable: 'Failed to reach NHTSA API',
    });

    const makes: MotorcycleMakeDto[] = json.Results.map((r) => ({
      makeId: r.MakeId,
      makeName: r.MakeName,
      isPopular: POPULAR_MAKES.has(r.MakeName),
    }));

    const popular = makes
      .filter((m) => m.isPopular)
      .sort((a, b) => a.makeName.localeCompare(b.makeName));
    const rest = makes
      .filter((m) => !m.isPopular)
      .sort((a, b) => a.makeName.localeCompare(b.makeName));
    const sorted = [...popular, ...rest];

    this.makesCache = { data: sorted, expiresAt: Date.now() + MAKES_TTL };
    return sorted;
  }

  async getModels(makeId: number, year: number): Promise<MotorcycleModelDto[]> {
    const cacheKey = `${makeId}-${year}`;
    const cached = this.modelsCache.get(cacheKey);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeIdYear/makeId/${makeId}/modelyear/${year}/vehicletype/motorcycle?format=json`;

    const json = await this.fetchJson<NhtsaModelResponse>(url, {
      notOkLog: 'NHTSA models request failed',
      notOkThrow: 'Failed to fetch motorcycle models from NHTSA',
      timeout: 'NHTSA API request timed out',
      unreachable: 'Failed to reach NHTSA API',
    });

    const models: MotorcycleModelDto[] = json.Results.map((r) => ({
      modelId: r.Model_ID,
      modelName: r.Model_Name,
    })).sort((a, b) => a.modelName.localeCompare(b.modelName));

    if (this.modelsCache.size >= NhtsaService.MAX_MODELS_CACHE) {
      const oldestKey = this.modelsCache.keys().next().value;
      if (oldestKey) this.modelsCache.delete(oldestKey);
    }
    this.modelsCache.set(cacheKey, { data: models, expiresAt: Date.now() + MODELS_TTL });
    return models;
  }

  // ==========================================
  // Safety recalls (MOT-142)
  // ==========================================

  /**
   * Fetch open NHTSA recall campaigns for a motorcycle.
   *
   * Prefers VIN-based lookup (more precise). Falls back to make/model/year if no VIN.
   * Results are cached for 24h per cache key to stay well within NHTSA's rate guidelines.
   */
  async getRecalls(params: {
    vin?: string;
    make?: string;
    model?: string;
    year?: number;
  }): Promise<RecallDto[]> {
    const { vin, make, model, year } = params;
    const cacheKey = vin ? `vin:${vin}` : `mmy:${make ?? ''}|${model ?? ''}|${year ?? ''}`;

    const cached = this.recallsCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    let url: string;
    if (vin) {
      url = `https://api.nhtsa.gov/recalls/recallsByVin?vin=${encodeURIComponent(vin)}`;
    } else if (make && model && year) {
      url = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;
    } else {
      throw new ServiceUnavailableException(
        'Need either a VIN or make/model/year to check for recalls',
      );
    }

    // 404 from NHTSA means "no recalls found" — cache + return an empty result.
    const json = await this.fetchJson<NhtsaRecallResponse | null>(
      url,
      {
        notOkLog: 'NHTSA recalls request failed',
        notOkThrow: 'Failed to fetch recalls from NHTSA',
        timeout: 'NHTSA recalls request timed out',
        unreachable: 'Failed to reach NHTSA recalls API',
      },
      () => null,
    );

    if (json === null) {
      this.recallsCache.set(cacheKey, { data: [], expiresAt: Date.now() + RECALLS_TTL });
      return [];
    }

    const rawResults = json.results ?? json.Results ?? [];
    const recalls: RecallDto[] = rawResults.map((r) => ({
      campaignNumber: r.NHTSACampaignNumber ?? '—',
      reportDate: r.ReportReceivedDate ?? '',
      component: r.Component ?? '',
      summary: r.Summary ?? '',
      consequence: r.Consequence ?? '',
      remedy: r.Remedy ?? '',
    }));

    // P2-112: Enforce cache size cap before adding new entries
    if (this.recallsCache.size >= NhtsaService.MAX_RECALLS_CACHE) {
      const oldestKey = this.recallsCache.keys().next().value;
      if (oldestKey) this.recallsCache.delete(oldestKey);
    }
    this.recallsCache.set(cacheKey, { data: recalls, expiresAt: Date.now() + RECALLS_TTL });
    return recalls;
  }
}
