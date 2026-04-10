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

const POPULAR_MAKES = new Set([
  'Honda',
  'Yamaha',
  'Kawasaki',
  'Suzuki',
  'Harley-Davidson',
  'BMW',
  'Ducati',
  'KTM',
  'Triumph',
  'Royal Enfield',
  'Indian',
  'Aprilia',
  'Husqvarna',
  'Moto Guzzi',
  'MV Agusta',
  'Benelli',
  'CFMoto',
  'Zero Motorcycles',
  'Can-Am',
  'Polaris',
  'Buell',
  'Norton',
  'BSA',
  'Vespa',
  'Piaggio',
  'SYM',
  'Kymco',
  'GasGas',
  'Beta',
  'Sherco',
  'TM Racing',
  'Husaberg',
  'Cagiva',
  'Bimota',
  'Energica',
  'LiveWire',
]);

const MS_PER_DAY = 86_400_000;
const MAKES_TTL = MS_PER_DAY; // 24 hours
const MODELS_TTL = MS_PER_DAY * 7; // 7 days
const RECALLS_TTL = MS_PER_DAY; // 24 hours (per MOT-142 spec)

@Injectable()
export class NhtsaService implements OnModuleInit {
  private static readonly MAX_MODELS_CACHE = 500;

  private readonly logger = new Logger(NhtsaService.name);
  private makesCache: CacheEntry<MotorcycleMakeDto[]> | null = null;
  private readonly modelsCache = new Map<string, CacheEntry<MotorcycleModelDto[]>>();
  private readonly recallsCache = new Map<string, CacheEntry<RecallDto[]>>();

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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let json: NhtsaMakeResponse;
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        this.logger.error(`NHTSA makes request failed: ${response.status}`);
        throw new ServiceUnavailableException('Failed to fetch motorcycle makes from NHTSA');
      }
      json = (await response.json()) as NhtsaMakeResponse;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ServiceUnavailableException('NHTSA API request timed out');
      }
      throw new ServiceUnavailableException('Failed to reach NHTSA API');
    } finally {
      clearTimeout(timeout);
    }

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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let json: NhtsaModelResponse;
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        this.logger.error(`NHTSA models request failed: ${response.status}`);
        throw new ServiceUnavailableException('Failed to fetch motorcycle models from NHTSA');
      }
      json = (await response.json()) as NhtsaModelResponse;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ServiceUnavailableException('NHTSA API request timed out');
      }
      throw new ServiceUnavailableException('Failed to reach NHTSA API');
    } finally {
      clearTimeout(timeout);
    }

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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let json: NhtsaRecallResponse;
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        // 404 from NHTSA means "no recalls found" — return empty cached result
        if (response.status === 404) {
          this.recallsCache.set(cacheKey, { data: [], expiresAt: Date.now() + RECALLS_TTL });
          return [];
        }
        this.logger.error(`NHTSA recalls request failed: ${response.status}`);
        throw new ServiceUnavailableException('Failed to fetch recalls from NHTSA');
      }
      json = (await response.json()) as NhtsaRecallResponse;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ServiceUnavailableException('NHTSA recalls request timed out');
      }
      throw new ServiceUnavailableException('Failed to reach NHTSA recalls API');
    } finally {
      clearTimeout(timeout);
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

    this.recallsCache.set(cacheKey, { data: recalls, expiresAt: Date.now() + RECALLS_TTL });
    return recalls;
  }
}
