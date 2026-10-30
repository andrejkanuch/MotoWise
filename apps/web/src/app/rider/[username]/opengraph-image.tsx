import { palette } from '@motovault/design-system';
import { ImageResponse } from 'next/og';
import { fetchProfile } from '../../../lib/fetch-profile';
import { formatDistance } from '../../../lib/format-utils';

export const runtime = 'edge';
export const alt = 'Rider profile';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 3600;

// The OG renderer (Satori) cannot read CSS variables, so the card takes its
// colours from the sanctioned JS source: the Race Plate graphite ground, bone
// ink, copper for the figures.
const GROUND = palette.plateG0;
const PANEL = palette.plateG2;
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

/** "1.2k km" → ["1.2k", "km"] so the unit sits small beside the figure. */
function splitUnit(value: string): [string, string | null] {
  const match = value.match(/^(.*?)\s*([a-z%]+)$/i);
  return match ? [match[1], match[2]] : [value, null];
}

export default async function OGImage({ params }: { params: Promise<{ username: string }> }) {
  // Next 16: route params are async
  const { username } = await params;
  const [profile, fonts] = await Promise.all([fetchProfile(username), loadFonts()]);

  const displayName = profile?.displayName ?? profile?.publicUsername ?? username;
  const publicUsername = profile?.publicUsername ?? username;
  const totalRides = profile?.rideStats.totalRides ?? 0;
  const [distanceNum, distanceUnit] = splitUnit(
    formatDistance(profile?.rideStats.totalDistance ?? 0),
  );
  const city = profile?.city;
  const meta = [`@${publicUsername}`, city].filter(Boolean).join(' · ');
  const figures: Array<{ label: string; num: string; unit: string | null }> = [
    { label: 'Rides logged', num: String(totalRides), unit: null },
    { label: 'Distance ridden', num: distanceNum, unit: distanceUnit },
  ];

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '56px 64px',
        background: GROUND,
        color: INK,
        fontFamily: BODY,
        fontWeight: 500,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 104,
            height: 104,
            borderRadius: 52,
            background: PANEL,
            fontFamily: DISPLAY,
            fontSize: 48,
            fontWeight: 700,
            color: INK_2,
          }}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontFamily: DISPLAY,
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 0.96,
              color: INK,
            }}
          >
            {displayName}
          </div>
          <div style={{ display: 'flex', fontSize: 26, color: INK_3, marginTop: 12 }}>{meta}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 64 }}>
        {figures.map(({ label, num, unit }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                fontFamily: DISPLAY,
                fontWeight: 700,
                fontSize: 80,
                lineHeight: 1,
                color: FIGURE,
              }}
            >
              {num}
              {unit ? (
                <span style={{ fontSize: 40, color: INK_2, marginLeft: 8 }}>{unit}</span>
              ) : null}
            </div>
            <div style={{ display: 'flex', fontSize: 22, color: INK_3, marginTop: 10 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontSize: 24,
          color: INK_3,
        }}
      >
        <div style={{ display: 'flex' }}>Rides with MotoVault</div>
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
