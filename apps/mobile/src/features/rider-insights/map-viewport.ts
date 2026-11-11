/**
 * Web Mercator as Mapbox draws it (512 px tiles): the camera that fits a set of
 * routes, and where a point lands under it. Shared by the live map, a static
 * image and the SVG routes drawn over either, so all of them line up.
 */

const TILE_SIZE = 512;
const MAX_ZOOM = 16;
/** Zoom for a region whose rides all start and end in one spot. */
const POINT_ZOOM = 13;
const EARTH_CIRCUMFERENCE_M = 40_075_016.686;

export interface Viewport {
  /** [lng, lat] */
  center: [number, number];
  zoom: number;
}

const mercX = (lng: number) => (lng + 180) / 360;
const mercY = (lat: number) => {
  const phi = (lat * Math.PI) / 180;
  return (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2;
};
const lngFromX = (x: number) => x * 360 - 180;
const latFromY = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;

/**
 * The center and zoom that fit `bounds` ([west, south, east, north]) inside a
 * `width` x `height` box with `padding` on every side. Computed on the device
 * so the live map, a static image and its SVG routes all share one camera.
 */
export function fitViewport(
  bounds: readonly number[],
  width: number,
  height: number,
  padding: number,
): Viewport {
  const [west, south, east, north] = bounds;
  const x0 = mercX(west);
  const x1 = mercX(east);
  const y0 = mercY(north);
  const y1 = mercY(south);
  const center: [number, number] = [lngFromX((x0 + x1) / 2), latFromY((y0 + y1) / 2)];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  if (dx === 0 && dy === 0) return { center, zoom: POINT_ZOOM };
  const scaleX = dx === 0 ? Number.POSITIVE_INFINITY : (width - 2 * padding) / (dx * TILE_SIZE);
  const scaleY = dy === 0 ? Number.POSITIVE_INFINITY : (height - 2 * padding) / (dy * TILE_SIZE);
  const zoom = Math.min(MAX_ZOOM, Math.max(0, Math.log2(Math.min(scaleX, scaleY))));
  return { center, zoom: Math.round(zoom * 100) / 100 };
}

/** A [lng, lat] point in a `width` x `height` box centred on the viewport. */
export function projectPoint(
  [lng, lat]: readonly [number, number],
  viewport: Viewport,
  width: number,
  height: number,
): [number, number] {
  const world = TILE_SIZE * 2 ** viewport.zoom;
  const x = (mercX(lng) - mercX(viewport.center[0])) * world + width / 2;
  const y = (mercY(lat) - mercY(viewport.center[1])) * world + height / 2;
  return [x, y];
}

/** Ground metres one logical pixel covers at the viewport's center. */
export function metersPerPixel(viewport: Viewport): number {
  const lat = (viewport.center[1] * Math.PI) / 180;
  return (EARTH_CIRCUMFERENCE_M * Math.cos(lat)) / (TILE_SIZE * 2 ** viewport.zoom);
}
