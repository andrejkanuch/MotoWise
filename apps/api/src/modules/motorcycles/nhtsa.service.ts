import {
  Injectable,
  Logger,
  type OnModuleInit,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { UpstreamUnavailableException } from '../../common/exceptions/upstream-unavailable.exception';
import { buildCandidateModels } from './recall-model-matching';

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

/** vPIC DecodeVinValues — one flat row of decoded fields; blanks mean "unknown". */
interface NhtsaVinDecodeResponse {
  Results?: Array<{ Make?: string; Model?: string; ModelYear?: string }>;
}

/** What recallsByVehicle needs. Any field may be missing on a free-text bike. */
interface RecallVehicle {
  make?: string;
  model?: string;
  year?: number;
}

/** api.nhtsa.gov/products/vehicle/models — model names as filed in the recall DB. */
interface NhtsaProductsResponse {
  results?: Array<{ model?: string }>;
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
export const POPULAR_MAKES = new Set([
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

/** Upstream name on UpstreamUnavailableException (warn log, not Sentry). */
const UPSTREAM_NAME = 'NHTSA';

/** Per-attempt abort timeout for an NHTSA call. */
const DEFAULT_TIMEOUT_MS = 10_000;
/**
 * The recall-side model list only widens the recall query and is non-fatal,
 * so it gets a shorter budget: the whole recall chain must answer well inside
 * the app's ~30s request timeout (MOTO-VAULT-NODE-NESTJS-T: 2 calls x 2
 * attempts x 10s = 40s, so the app gave up and re-sent the query).
 */
const RECALL_MODELS_TIMEOUT_MS = 5_000;
/** Pause before the single retry of a transient failure (5xx, connection error). */
const RETRY_BACKOFF_MS = 300;
/**
 * After an endpoint fails as down (timeout, unreachable, 5xx), calls to it
 * fail fast for this long instead of each paying the full timeout again.
 */
const OUTAGE_COOLDOWN_MS = 60_000;

/**
 * Outage-breaker key per NHTSA API. Explicit, not derived from the URL: vPIC
 * puts the VIN and make/year in the path, so a path key would open a separate
 * breaker per vehicle (never failing fast for the next VIN) and grow without
 * bound.
 */
const NHTSA_ENDPOINT = {
  makes: 'vpic:makes',
  models: 'vpic:models',
  decodeVin: 'vpic:decodeVin',
  recalls: 'nhtsa:recallsByVehicle',
  recallModels: 'nhtsa:products',
} as const;
type NhtsaEndpoint = (typeof NHTSA_ENDPOINT)[keyof typeof NHTSA_ENDPOINT];

/** HTTP statuses that mean "NHTSA is down / overloaded", not "our request is wrong". */
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR_FLOOR = 500;

/** How one fetch attempt failed: whether NHTSA itself is down, and whether a retry can help. */
interface AttemptFailure {
  error: ServiceUnavailableException;
  upstreamDown: boolean;
  retryable: boolean;
}

interface FetchJsonOptions<T> {
  /** Which NHTSA API the URL belongs to; the outage breaker is per API. */
  endpoint: NhtsaEndpoint;
  /**
   * Lets a caller treat HTTP 404/400 as a sentinel value (NHTSA answers those
   * for "no recalls found") instead of an error.
   */
  on404?: () => T;
  timeoutMs?: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

@Injectable()
export class NhtsaService implements OnModuleInit {
  private static readonly MAX_MODELS_CACHE = 500;
  // P2-112: Cap recall cache to prevent unbounded memory growth from
  // attackers spraying unique VINs through the motorcycleRecalls query.
  private static readonly MAX_RECALLS_CACHE = 1_000;

  private static readonly MAX_RECALL_MODELS_CACHE = 500;

  private static readonly MAX_VIN_DECODE_CACHE = 1_000;

  /** Shown to the rider (4xx passes its message through): the bike lacks the fields a lookup needs. */
  static readonly MISSING_VEHICLE_MESSAGE =
    'Add the model and year (or a VIN) to check this bike for recalls';

  /**
   * After serving stale data, re-arm the entry's expiry by this cooldown so at
   * most ~one request per window pays the upstream retry/timeout cost (up to
   * ~20s) during a sustained NHTSA outage.
   */
  private static readonly STALE_RETRY_COOLDOWN_MS = 60_000;

  private readonly logger = new Logger(NhtsaService.name);
  private makesCache: CacheEntry<MotorcycleMakeDto[]> | null = null;
  private readonly modelsCache = new Map<string, CacheEntry<MotorcycleModelDto[]>>();
  private readonly recallsCache = new Map<string, CacheEntry<RecallDto[]>>();
  private readonly recallModelsCache = new Map<string, CacheEntry<string[]>>();
  private readonly vinDecodeCache = new Map<string, CacheEntry<RecallVehicle>>();
  /** Recall lookups in progress per vehicle, so a client re-send joins the first call. */
  private readonly recallsInFlight = new Map<string, Promise<RecallDto[]>>();
  /** NHTSA API → epoch ms until which it is treated as down. */
  private readonly endpointOutageUntil = new Map<NhtsaEndpoint, number>();

  /**
   * Run an NHTSA fetch; on failure fall back to an expired cache entry when
   * one exists (re-arming its expiry by {@link STALE_RETRY_COOLDOWN_MS}),
   * otherwise rethrow. Makes/models barely change, so stale data beats
   * failing the add-bike flow with a 503 (MOTO-VAULT-NODE-NESTJS-4).
   */
  private async fetchWithStaleFallback<T, D>(
    fetchFresh: () => Promise<T>,
    stale: CacheEntry<D> | null | undefined,
    label: string,
  ): Promise<{ fresh: T } | { stale: D }> {
    try {
      return { fresh: await fetchFresh() };
    } catch (error) {
      // Only an NHTSA outage earns the stale fallback. Any other error means our
      // request is wrong; it must reach the client and Sentry, not hide behind
      // old data.
      if (stale && error instanceof UpstreamUnavailableException) {
        stale.expiresAt = Date.now() + NhtsaService.STALE_RETRY_COOLDOWN_MS;
        this.logger.warn(`NHTSA ${label} fetch failed — serving stale cache`);
        return { stale: stale.data };
      }
      throw error;
    }
  }

  /**
   * Shared NHTSA fetch with a per-attempt abort timeout.
   *
   * - 2xx → parsed JSON. 400/404 → `on404()` when the caller opts in.
   * - NHTSA down (timeout, connection error, 5xx, 429) →
   *   {@link UpstreamUnavailableException}: a 503 to the client, a warn log
   *   instead of a Sentry error, and the endpoint is short-circuited for
   *   {@link OUTAGE_COOLDOWN_MS} so later requests fail fast instead of each
   *   paying the timeout (MOTO-VAULT-NODE-NESTJS-T).
   * - Any other non-ok answer means our request is wrong → plain
   *   ServiceUnavailableException, which Sentry does capture.
   *
   * Connection errors and 5xx get one retry after a short backoff (they are
   * often blips). A timeout does not: an endpoint that hung for the whole
   * timeout is down, and a second wait only doubles the rider's wait.
   */
  private async fetchJson<T>(
    url: string,
    messages: { notOkLog: string; notOkThrow: string; timeout: string; unreachable: string },
    options: FetchJsonOptions<T>,
  ): Promise<T> {
    const { endpoint, on404, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
    const downUntil = this.endpointOutageUntil.get(endpoint);
    if (downUntil !== undefined && Date.now() < downUntil) {
      throw new UpstreamUnavailableException(UPSTREAM_NAME, messages.unreachable);
    }

    const maxAttempts = 2;
    for (let attempt = 1; ; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let failure: AttemptFailure;
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (response.ok) {
          const json = (await response.json()) as T;
          this.endpointOutageUntil.delete(endpoint);
          return json;
        }
        // NHTSA's recalls endpoint returns 400 (not 404) with a valid
        // "Results returned successfully" body (Count: 0) when a make/model/year
        // has no matching recalls — extremely common for motorcycles. Vehicles
        // that DO have recalls return 200, so treating 400/404 as "none found"
        // (for callers that opt in via on404) never drops real recalls.
        if ((response.status === 404 || response.status === 400) && on404) {
          this.endpointOutageUntil.delete(endpoint);
          return on404();
        }
        failure = this.classifyHttpFailure(response.status, messages);
      } catch (error) {
        const timedOut = error instanceof DOMException && error.name === 'AbortError';
        failure = {
          error: new UpstreamUnavailableException(
            UPSTREAM_NAME,
            timedOut ? messages.timeout : messages.unreachable,
          ),
          upstreamDown: true,
          retryable: !timedOut,
        };
      } finally {
        clearTimeout(timeout);
      }

      if (failure.retryable && attempt < maxAttempts) {
        await sleep(RETRY_BACKOFF_MS);
        continue;
      }
      if (failure.upstreamDown) {
        this.endpointOutageUntil.set(endpoint, Date.now() + OUTAGE_COOLDOWN_MS);
      }
      throw failure.error;
    }
  }

  private classifyHttpFailure(
    status: number,
    messages: { notOkLog: string; notOkThrow: string },
  ): AttemptFailure {
    const upstreamDown = status >= HTTP_SERVER_ERROR_FLOOR || status === HTTP_TOO_MANY_REQUESTS;
    if (upstreamDown) {
      this.logger.warn(`${messages.notOkLog}: ${status}`);
      return {
        error: new UpstreamUnavailableException(UPSTREAM_NAME, messages.notOkThrow),
        upstreamDown,
        retryable: true,
      };
    }
    this.logger.error(`${messages.notOkLog}: ${status}`);
    return {
      error: new ServiceUnavailableException(messages.notOkThrow),
      upstreamDown,
      retryable: false,
    };
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

    const result = await this.fetchWithStaleFallback(
      () =>
        this.fetchJson<NhtsaMakeResponse>(
          url,
          {
            notOkLog: 'NHTSA makes request failed',
            notOkThrow: 'Failed to fetch motorcycle makes from NHTSA',
            timeout: 'NHTSA API request timed out',
            unreachable: 'Failed to reach NHTSA API',
          },
          { endpoint: NHTSA_ENDPOINT.makes },
        ),
      this.makesCache,
      'makes',
    );
    if ('stale' in result) return result.stale;
    const json = result.fresh;

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

    const result = await this.fetchWithStaleFallback(
      () =>
        this.fetchJson<NhtsaModelResponse>(
          url,
          {
            notOkLog: 'NHTSA models request failed',
            notOkThrow: 'Failed to fetch motorcycle models from NHTSA',
            timeout: 'NHTSA API request timed out',
            unreachable: 'Failed to reach NHTSA API',
          },
          { endpoint: NHTSA_ENDPOINT.models },
        ),
      cached,
      `models ${cacheKey}`,
    );
    if ('stale' in result) return result.stale;
    const json = result.fresh;

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
   * NHTSA's public recalls API is keyed by make/model/year only — there is no
   * recall-by-VIN endpoint (`/recalls/recallsByVin` answers 403 "Missing
   * Authentication Token", API Gateway's unknown-route reply), so every VIN
   * lookup used to fail (MOTO-VAULT-NODE-NESTJS-3). A VIN now only fills the
   * make/model/year fields the rider left blank, via vPIC's VIN decoder.
   *
   * The lookup queries multiple model-name candidates because the recall
   * database files campaigns under homologation codes ("CRF1100") while we
   * store vPIC marketing names ("Africa Twin") — a single-name query would
   * silently miss real recalls (see recall-model-matching.ts).
   *
   * A bike with no model or year and no decodable VIN cannot be checked: that
   * is a 422 the client explains, not an upstream outage
   * (MOTO-VAULT-NODE-NESTJS-R). Results are cached for 24h per vehicle.
   */
  async getRecalls(params: {
    vin?: string;
    make?: string;
    model?: string;
    year?: number;
  }): Promise<RecallDto[]> {
    const { make, model, year } = await this.resolveRecallVehicle(params);
    if (!make || !model || !year) {
      throw new UnprocessableEntityException(NhtsaService.MISSING_VEHICLE_MESSAGE);
    }

    const cacheKey = `mmy:${make.toUpperCase()}|${model.toUpperCase()}|${year}`;
    const cached = this.recallsCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    const inFlight = this.recallsInFlight.get(cacheKey);
    if (inFlight) return inFlight;

    const lookup = this.lookupRecalls(cacheKey, make, model, year, cached).finally(() =>
      this.recallsInFlight.delete(cacheKey),
    );
    this.recallsInFlight.set(cacheKey, lookup);
    return lookup;
  }

  /**
   * Upstream half of {@link getRecalls}. During an NHTSA outage an expired
   * cache entry is served instead of failing: recall campaigns are only ever
   * added, so yesterday's list is still true.
   *
   * When the recall-side model list could not be fetched, the answer may miss
   * campaigns filed under another model name. It is then merged with the
   * expired entry (if any) and cached only for {@link STALE_RETRY_COOLDOWN_MS},
   * so the full lookup runs again once the products API is back, instead of a
   * narrowed list being served as fresh for 24h.
   */
  private async lookupRecalls(
    cacheKey: string,
    make: string,
    model: string,
    year: number,
    stale: CacheEntry<RecallDto[]> | undefined,
  ): Promise<RecallDto[]> {
    const result = await this.fetchWithStaleFallback(
      () => this.fetchRecalls(make, model, year),
      stale,
      `recalls ${cacheKey}`,
    );
    if ('stale' in result) return result.stale;
    const { recalls: fresh, complete } = result.fresh;
    const recalls = complete ? fresh : mergeRecalls([fresh, stale?.data ?? []]);
    const ttl = complete ? RECALLS_TTL : NhtsaService.STALE_RETRY_COOLDOWN_MS;

    // P2-112: Enforce cache size cap before adding new entries
    if (this.recallsCache.size >= NhtsaService.MAX_RECALLS_CACHE) {
      const oldestKey = this.recallsCache.keys().next().value;
      if (oldestKey) this.recallsCache.delete(oldestKey);
    }
    this.recallsCache.set(cacheKey, { data: recalls, expiresAt: Date.now() + ttl });
    return recalls;
  }

  /**
   * Query every model-name candidate and merge the campaigns. `complete` is
   * false when the recall-side model list was unavailable, so only the stored
   * name and curated aliases were queried.
   */
  private async fetchRecalls(
    make: string,
    model: string,
    year: number,
  ): Promise<{ recalls: RecallDto[]; complete: boolean }> {
    const recallSide = await this.getRecallSideModels(make, year);
    const candidates = buildCandidateModels(make, model, recallSide.models);
    const perCandidate = await Promise.all(
      candidates.map((candidate) =>
        this.fetchRecallList(
          `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(candidate)}&modelYear=${year}`,
        ),
      ),
    );
    return { recalls: mergeRecalls(perCandidate), complete: recallSide.complete };
  }

  /**
   * The rider's own make/model/year win (they picked them from vPIC); a VIN
   * only fills the blanks. Decoding is skipped when nothing is blank.
   */
  private async resolveRecallVehicle(params: {
    vin?: string;
    make?: string;
    model?: string;
    year?: number;
  }): Promise<RecallVehicle> {
    const stored: RecallVehicle = {
      make: params.make?.trim() || undefined,
      model: params.model?.trim() || undefined,
      year: params.year || undefined,
    };
    const complete = stored.make && stored.model && stored.year;
    const vin = params.vin?.trim();
    if (complete || !vin) return stored;

    const decoded = await this.decodeVin(vin);
    return {
      make: stored.make ?? decoded.make,
      model: stored.model ?? decoded.model,
      year: stored.year ?? decoded.year,
    };
  }

  /**
   * vPIC VIN decode → make/model/year. A VIN vPIC answers but cannot decode
   * yields blank fields, so the caller reports "add model and year" (422).
   * A vPIC outage (timeout, 5xx, unreachable) is NOT a blank decode: the
   * UpstreamUnavailableException from fetchJson propagates, so the rider gets
   * the retryable 503 (logged at warn, not sent to Sentry). Only answered
   * decodes are cached.
   */
  private async decodeVin(vin: string): Promise<RecallVehicle> {
    const cacheKey = vin.toUpperCase();
    const cached = this.vinDecodeCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    const json = await this.fetchJson<NhtsaVinDecodeResponse>(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
      {
        notOkLog: 'NHTSA VIN decode request failed',
        notOkThrow: 'Failed to decode VIN with NHTSA',
        timeout: 'NHTSA VIN decode request timed out',
        unreachable: 'Failed to reach NHTSA vPIC API',
      },
      { endpoint: NHTSA_ENDPOINT.decodeVin },
    );
    const row = json.Results?.[0];
    const year = Number.parseInt(row?.ModelYear ?? '', 10);
    const decoded: RecallVehicle = {
      make: row?.Make?.trim() || undefined,
      model: row?.Model?.trim() || undefined,
      year: Number.isFinite(year) && year > 0 ? year : undefined,
    };

    if (this.vinDecodeCache.size >= NhtsaService.MAX_VIN_DECODE_CACHE) {
      const oldestKey = this.vinDecodeCache.keys().next().value;
      if (oldestKey) this.vinDecodeCache.delete(oldestKey);
    }
    this.vinDecodeCache.set(cacheKey, { data: decoded, expiresAt: Date.now() + MODELS_TTL });
    return decoded;
  }

  /** Run one recalls query and map the rows. 400/404 means "no recalls found". */
  private async fetchRecallList(url: string): Promise<RecallDto[]> {
    const json = await this.fetchJson<NhtsaRecallResponse | null>(
      url,
      {
        notOkLog: 'NHTSA recalls request failed',
        notOkThrow: 'Failed to fetch recalls from NHTSA',
        timeout: 'NHTSA recalls request timed out',
        unreachable: 'Failed to reach NHTSA recalls API',
      },
      { endpoint: NHTSA_ENDPOINT.recalls, on404: () => null },
    );
    if (json === null) return [];

    const rawResults = json.results ?? json.Results ?? [];
    return rawResults.map((r) => ({
      campaignNumber: r.NHTSACampaignNumber ?? '—',
      reportDate: r.ReportReceivedDate ?? '',
      component: r.Component ?? '',
      summary: r.Summary ?? '',
      consequence: r.Consequence ?? '',
      remedy: r.Remedy ?? '',
    }));
  }

  /**
   * Model names with recall records for a make/year, as filed in the recall
   * database (products API). Used to translate vPIC marketing names into the
   * names recallsByVehicle actually matches. Non-fatal: any failure returns no
   * models with `complete: false`, so the primary single-name lookup still runs
   * and the caller knows its answer may be narrowed.
   */
  private async getRecallSideModels(
    make: string,
    year: number,
  ): Promise<{ models: string[]; complete: boolean }> {
    const cacheKey = `${make.toUpperCase()}|${year}`;
    const cached = this.recallModelsCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return { models: cached.data, complete: true };
    }

    let models: string[];
    try {
      const url = `https://api.nhtsa.gov/products/vehicle/models?modelYear=${year}&make=${encodeURIComponent(make)}&issueType=r`;
      const json = await this.fetchJson<NhtsaProductsResponse | null>(
        url,
        {
          notOkLog: 'NHTSA recall-models request failed',
          notOkThrow: 'Failed to fetch recall model list from NHTSA',
          timeout: 'NHTSA recall-models request timed out',
          unreachable: 'Failed to reach NHTSA products API',
        },
        {
          endpoint: NHTSA_ENDPOINT.recallModels,
          on404: () => null,
          timeoutMs: RECALL_MODELS_TIMEOUT_MS,
        },
      );
      models = [...new Set((json?.results ?? []).map((r) => r.model ?? '').filter(Boolean))];
    } catch (err) {
      this.logger.warn(
        `Recall model list lookup failed for ${cacheKey} (non-fatal): ${(err as Error).message}`,
      );
      return { models: [], complete: false };
    }

    if (this.recallModelsCache.size >= NhtsaService.MAX_RECALL_MODELS_CACHE) {
      const oldestKey = this.recallModelsCache.keys().next().value;
      if (oldestKey) this.recallModelsCache.delete(oldestKey);
    }
    this.recallModelsCache.set(cacheKey, { data: models, expiresAt: Date.now() + RECALLS_TTL });
    return { models, complete: true };
  }
}

/**
 * Merge recall lists, one entry per campaign (first occurrence wins). NHTSA
 * returns one row per affected product, so the same campaign can appear
 * several times within AND across candidate queries.
 */
function mergeRecalls(lists: RecallDto[][]): RecallDto[] {
  const byCampaign = new Map<string, RecallDto>();
  for (const recall of lists.flat()) {
    if (!byCampaign.has(recall.campaignNumber)) {
      byCampaign.set(recall.campaignNumber, recall);
    }
  }
  return [...byCampaign.values()];
}
