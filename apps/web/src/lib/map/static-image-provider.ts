/**
 * Provider abstraction for static map image generation.
 * Decouples route hero images from any single tile vendor (MOT-147 ADR pending).
 */

export interface StaticImageParams {
  polyline: string;
  width: number;
  height: number;
  padding?: number;
}

export interface StaticImageProvider {
  buildUrl(params: StaticImageParams): string;
}

/**
 * Stadia Maps Static API — free tier, no vendor lock-in.
 * Docs: https://docs.stadiamaps.com/guides/static-maps/
 *
 * Requires STADIA_API_KEY env var for production usage.
 * The path is rendered from a Google-encoded polyline.
 */
class StadiaStaticProvider implements StaticImageProvider {
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.STADIA_API_KEY ?? '';
  }

  buildUrl({ polyline, width, height, padding = 40 }: StaticImageParams): string {
    const params = new URLSearchParams({
      size: `${width}x${height}`,
      padding: String(padding),
    });

    if (this.apiKey) {
      params.set('api_key', this.apiKey);
    }

    // Stadia accepts encoded polyline via `path` param with `enc:` prefix
    return `https://tiles.stadiamaps.com/static/osm_bright.png?path=enc:${encodeURIComponent(polyline)}&${params.toString()}`;
  }
}

const MAP_TILE_PROVIDERS = {
  stadia: 'stadia',
} as const;

type MapTileProvider = (typeof MAP_TILE_PROVIDERS)[keyof typeof MAP_TILE_PROVIDERS];

export function getStaticImageProvider(): StaticImageProvider {
  const provider = (process.env.MAP_TILE_PROVIDER || 'stadia') as MapTileProvider;

  switch (provider) {
    case MAP_TILE_PROVIDERS.stadia:
      return new StadiaStaticProvider();
    default:
      return new StadiaStaticProvider();
  }
}
