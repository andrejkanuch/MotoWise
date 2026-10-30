import { palette } from '@motovault/design-system';
import { ImageResponse } from 'next/og';
import { fetchRide } from '../../../lib/fetch-ride';
import { formatDistance, formatDuration } from '../../../lib/format-utils';

export const runtime = 'edge';
export const alt = 'MotoVault ride';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 3600;

// The OG renderer (Satori) cannot read CSS variables, so the card takes its
// colours from the sanctioned JS source: the Race Plate graphite ground, bone
// ink, copper for the figures.
const GROUND = palette.plateG0;
const PANEL = palette.plateG1;
const LINE = palette.plateG3;
const INK = palette.plateBone;
const INK_2 = palette.plateInk2;
const INK_3 = palette.plateInk3;
const FIGURE = palette.plateCopper;
// The site's two faces: the condensed display for the title and figures, the
// body face for every label (the root layout loads both from Google Fonts).
const DISPLAY = 'Barlow Condensed';
const BODY = 'Plus Jakarta Sans';

// An older WebKit UA makes Google Fonts answer with TrueType, which Satori reads.
const TTF_USER_AGENT =
  'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; en-us) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1';

interface OgFont {
  name: string;
  data: ArrayBuffer;
  weight: 500 | 700;
  style: 'normal';
}

/** One Google Fonts face as a Satori font; null when the fetch fails (Satori falls back). */
async function loadFont(family: string, weight: 500 | 700): Promise<OgFont | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}&display=swap`;
    const css = await fetch(cssUrl, {
      headers: { 'User-Agent': TTF_USER_AGENT },
      cache: 'force-cache',
    }).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return null;
    return { name: family, data: await res.arrayBuffer(), weight, style: 'normal' };
  } catch {
    return null;
  }
}

function loadFonts(): Promise<OgFont[]> {
  return Promise.all([loadFont(DISPLAY, 700), loadFont(BODY, 500)]).then((fonts) =>
    fonts.filter((f): f is OgFont => f !== null),
  );
}

/** "412.3 km" → ["412.3", "km"] so the unit can sit small beside the figure. */
function splitUnit(value: string): [string, string | null] {
  const match = value.match(/^(.*?)\s*([a-z%]+)$/i);
  return match ? [match[1], match[2]] : [value, null];
}

export default async function OGImage({ params }: { params: Promise<{ id: string }> }) {
  // Next 16: route params are async
  const { id } = await params;
  const [ride, fonts] = await Promise.all([fetchRide(id), loadFonts()]);

  const title = ride?.name ?? 'MotoVault ride';
  const figures: Array<{ label: string; value: string }> = [
    { label: 'Distance', value: ride?.distanceM ? formatDistance(ride.distanceM) : '--' },
    { label: 'Moving time', value: ride?.durationS ? formatDuration(ride.durationS) : '--' },
  ];
  const thumb = ride?.routeThumbnailUri ?? null;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        background: GROUND,
        color: INK,
        fontFamily: BODY,
        fontWeight: 500,
      }}
    >
      {thumb ? (
        <div
          style={{
            width: '46%',
            height: '100%',
            display: 'flex',
            background: PANEL,
            borderRight: `1px solid ${LINE}`,
            overflow: 'hidden',
          }}
        >
          {/* biome-ignore lint/performance/noImgElement: OG image rendering */}
          <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      ) : null}

      <div
        style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
        }}
      >
        <div style={{ display: 'flex', fontSize: 24, fontWeight: 500, color: INK_3 }}>
          Ride recorded with MotoVault
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontFamily: DISPLAY,
              fontSize: thumb ? 64 : 84,
              fontWeight: 700,
              lineHeight: 0.96,
              color: INK,
              maxWidth: thumb ? 560 : 1000,
            }}
          >
            {title}
          </div>

          <div style={{ display: 'flex', gap: 56, marginTop: 40 }}>
            {figures.map(({ label, value }) => {
              const [num, unit] = splitUnit(value);
              return (
                <div key={label} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      fontFamily: DISPLAY,
                      fontWeight: 700,
                      fontSize: 72,
                      lineHeight: 1,
                      color: FIGURE,
                    }}
                  >
                    {num}
                    {unit ? (
                      <span style={{ fontSize: 36, color: INK_2, marginLeft: 8 }}>{unit}</span>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', fontSize: 22, color: INK_3, marginTop: 10 }}>
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            fontFamily: DISPLAY,
            fontSize: 28,
            fontWeight: 700,
            color: INK,
          }}
        >
          MotoVault
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts,
    },
  );
}
