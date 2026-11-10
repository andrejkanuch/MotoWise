import { type Href, router } from 'expo-router';
import { Fragment, type ReactNode } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { tint, useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { radius, SYSTEM_WEIGHT, type } from '@/theme/type';
import { isStackedRow } from '../locked-row';

/** Ride detail, opened from any ride on a detail page. */
const RIDE_DETAIL_PATHNAME = '/(modals)/ride-detail';
/** The `source` ride detail reports for its view event. */
const RIDE_DETAIL_SOURCE = 'rider_insights';
/** The plate figure stops growing here (DESIGN.md: plate capped at 1.2x font scale). */
const PLATE_MAX_FONT_SCALE = 1.2;
const RANK_WELL = 44;
const SWATCH = 12;
const SWATCH_RADIUS = 3;
const BUTTON_HEIGHT = 52;
const PRESS_TINT = 0.06;
const BAR_SEAM = 2;

/**
 * The ink strength of the four road bands, straight to tight, per scheme. The
 * light ramp is a step lighter so the straight band still reads on white.
 */
export function bandAlphas(isDark: boolean): readonly [number, number, number, number] {
  return isDark ? [0.16, 0.36, 0.62, 0.92] : [0.12, 0.3, 0.55, 0.88];
}

export function openRide(rideId: string): void {
  const href: Href = {
    pathname: RIDE_DETAIL_PATHNAME,
    params: { rideId, source: RIDE_DETAIL_SOURCE },
  };
  router.push(href);
}

/** The page's big figure with its sentence beside it: "26%  of your 2,141 routed km were twisty". */
export function DetailHero({ figure, line }: { figure: string | null; line: string }) {
  const { t } = useEditorialTheme();
  return (
    <View
      testID="detail-hero"
      accessible
      accessibilityLabel={[figure, line].filter(Boolean).join(' ')}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        columnGap: space.xs,
      }}
    >
      {figure ? (
        <Text style={[type.plate, { color: t.ink }]} maxFontSizeMultiplier={PLATE_MAX_FONT_SCALE}>
          {figure}
        </Text>
      ) : null}
      <Text style={[type.body, { color: t.ink2, flexShrink: 1 }]}>{line}</Text>
    </View>
  );
}

/** An inset grouped card: card step, radius 16, clips its rows. */
export function Card({ children, padded = false }: { children: ReactNode; padded?: boolean }) {
  const { t } = useEditorialTheme();
  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        overflow: 'hidden',
        padding: padded ? space.md : 0,
        gap: padded ? space.sm : 0,
      }}
    >
      {children}
    </View>
  );
}

/** A caption heading over its card. */
export function Section({ title, children }: { title?: string; children: ReactNode }) {
  const { t } = useEditorialTheme();
  return (
    <View style={{ gap: space.xs }}>
      {title ? (
        <Text
          accessibilityRole="header"
          style={[type.label, { color: t.ink3, marginHorizontal: space.md }]}
        >
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/** Rows in one card with hairlines between them, starting at the text column. */
export function RowList({ rows, inset }: { rows: ReactNode[]; inset: number }) {
  const { t } = useEditorialTheme();
  if (rows.length === 0) return null;
  return (
    <Card>
      {rows.map((row, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rows are rendered in a fixed order
        <Fragment key={i}>
          {i > 0 ? (
            <View style={{ height: 1, marginLeft: inset, backgroundColor: t.line }} />
          ) : null}
          {row}
        </Fragment>
      ))}
    </Card>
  );
}

/** Separator inset for rows that lead with a rank well. */
export const RANK_ROW_INSET = space.md + RANK_WELL + space.sm;
/** Separator inset for rows that lead with a band swatch. */
export const SWATCH_ROW_INSET = space.md + SWATCH + space.sm;

export function Footnote({ children }: { children: string }) {
  const { t } = useEditorialTheme();
  return (
    <Text style={[type.caption, { color: t.ink3, marginHorizontal: space.md }]}>{children}</Text>
  );
}

interface ValueRowProps {
  testID?: string;
  /** The leading mark: a rank well, a band swatch, a country oval. */
  leading?: ReactNode;
  title: string;
  caption?: string | null;
  value: string;
  unit?: string | null;
  /** The value is words ("Saturday mornings"), set in the system face, not as a figure. */
  textValue?: boolean;
  /** A row that opens rows under it: whether they show, for screen readers. */
  expanded?: boolean;
  onPress?: () => void;
}

/**
 * A grouped row with a title and caption, and a figure on the right. From font
 * scale 1.5 the figure moves under the text so neither is cut.
 */
export function ValueRow({
  testID,
  leading,
  title,
  caption,
  value,
  unit,
  textValue = false,
  expanded,
  onPress,
}: ValueRowProps) {
  const { t } = useEditorialTheme();
  const { fontScale } = useWindowDimensions();
  const stacked = isStackedRow(fontScale);
  return (
    <Pressable
      testID={testID}
      accessible
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      accessibilityLabel={[title, caption, unit ? `${value} ${unit}` : value]
        .filter(Boolean)
        .join(', ')}
      onPress={onPress}
      disabled={!onPress}
      android_ripple={onPress ? { color: t.line } : undefined}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        minHeight: BUTTON_HEIGHT,
        paddingVertical: space.xs,
        paddingHorizontal: space.md,
        backgroundColor:
          pressed && process.env.EXPO_OS === 'ios' ? tint(t.ink, PRESS_TINT) : 'transparent',
      })}
    >
      {leading}
      <View
        style={{
          flex: 1,
          minWidth: 0,
          flexDirection: stacked ? 'column' : 'row',
          alignItems: stacked ? 'flex-start' : 'center',
          gap: space.sm,
        }}
      >
        <View style={{ flex: stacked ? undefined : 1, minWidth: 0 }}>
          <Text style={[type.body, { color: t.ink }]}>{title}</Text>
          {caption ? <Text style={[type.caption, { color: t.ink3 }]}>{caption}</Text> : null}
        </View>
        <View style={{ alignItems: stacked ? 'flex-start' : 'flex-end' }}>
          <Text
            style={[
              textValue ? type.body : type.figureSmall,
              { color: textValue ? t.ink2 : t.ink },
            ]}
          >
            {value}
          </Text>
          {unit ? <Text style={[type.caption, { color: t.ink3 }]}>{unit}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

/** A ranked ride's leading well: its place in the list. */
export function RankWell({ rank }: { rank: number }) {
  const { t } = useEditorialTheme();
  return (
    <View
      style={{
        width: RANK_WELL,
        height: RANK_WELL,
        borderRadius: space.xs,
        borderCurve: 'continuous',
        backgroundColor: t.surface2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={[type.figureSmall, { color: t.ink2 }]}
        maxFontSizeMultiplier={PLATE_MAX_FONT_SCALE}
      >
        {String(rank)}
      </Text>
    </View>
  );
}

/** A band's swatch beside its name, with a keyline so the lightest band still shows. */
export function BandSwatch({ alpha }: { alpha: number }) {
  const { t } = useEditorialTheme();
  return (
    <View
      style={{
        width: SWATCH,
        height: SWATCH,
        borderRadius: SWATCH_RADIUS,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: t.line,
        backgroundColor: tint(t.ink, alpha),
      }}
    />
  );
}

interface ShareBarProps {
  testID: string;
  shares: readonly number[];
  alphas: readonly number[];
  height: number;
  /** The one summary a screen reader hears for the whole bar. */
  accessibilityLabel: string;
}

/** A horizontal bar of shares with 2pt seams; the shares are named in its label. */
export function ShareBar({ testID, shares, alphas, height, accessibilityLabel }: ShareBarProps) {
  const { t } = useEditorialTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{
        height,
        flexDirection: 'row',
        gap: BAR_SEAM,
        borderRadius: height / 2,
        borderCurve: 'continuous',
        overflow: 'hidden',
        backgroundColor: t.surface2,
      }}
    >
      {shares.map((share, i) =>
        share > 0 ? (
          <View
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed bands in a fixed order
            key={i}
            style={{ flex: share, backgroundColor: tint(t.ink, alphas[i] ?? 1) }}
          />
        ) : null,
      )}
    </View>
  );
}

/** The copper primary: "Unlock", or a quiet "Unlocking…" while a purchase lands. */
export function UnlockButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { t } = useEditorialTheme();
  return (
    <Pressable
      testID="detail-unlock"
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: BUTTON_HEIGHT,
        borderRadius: radius.control,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: space.md,
        backgroundColor: disabled ? t.surface3 : t.warm,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={[type.bodyStrong, { color: disabled ? t.ink4 : t.onWarm }]}>{label}</Text>
    </Pressable>
  );
}

/** A state card: not enough rides, computing, missing input, offline. Never a number. */
export function StateNotice({
  testID,
  title,
  body,
  action,
  onAction,
}: {
  testID: string;
  title?: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  const { t } = useEditorialTheme();
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: t.surface,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        padding: space.md,
        gap: space.xs,
      }}
    >
      {title ? <Text style={[type.bodyStrong, { color: t.ink }]}>{title}</Text> : null}
      <Text style={[type.subhead, { color: t.ink2 }]}>{body}</Text>
      {action && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          hitSlop={space.xs}
          style={{ alignSelf: 'flex-start', paddingTop: space.xxs }}
        >
          <Text style={[type.subhead, SYSTEM_WEIGHT.semibold, { color: t.warm2 }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
