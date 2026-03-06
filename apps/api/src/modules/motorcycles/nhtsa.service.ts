import { Injectable, Logger, type OnModuleInit, ServiceUnavailableException } from '@nestjs/common';

interface NhtsaMakeResponse {
  Results: Array<{ MakeId: number; MakeName: string }>;
}

interface NhtsaModelResponse {
  Results: Array<{ Model_ID: number; Model_Name: string }>;
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

@Injectable()
export class NhtsaService implements OnModuleInit {
  private static readonly MAX_MODELS_CACHE = 500;

  private readonly logger = new Logger(NhtsaService.name);
  private makesCache: CacheEntry<MotorcycleMakeDto[]> | null = null;
  private readonly modelsCache = new Map<string, CacheEntry<MotorcycleModelDto[]>>();

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
}
