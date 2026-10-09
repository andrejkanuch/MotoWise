import { useTranslation } from 'react-i18next';
import type { ViewStyle } from 'react-native';
import { getBrandDna } from '../../config/brand-dna';
import { BikePlate, PLATE_SIZE, PLATE_STATE, type PlateSize } from '../ui/bike-plate';

/** A rider's first bike is plate 01 — the same number it wears in the garage. */
const FIRST_PLATE_NUMBER = '01';
const NO_VALUE = '—';

/** Split a brand-DNA interval ("10,000 km") into the plate's figure and unit. */
export function splitServiceInterval(interval: string | undefined): {
  figure: string;
  unit?: string;
} {
  if (!interval) return { figure: NO_VALUE };
  const at = interval.lastIndexOf(' ');
  return at > 0
    ? { figure: interval.slice(0, at), unit: interval.slice(at + 1) }
    : { figure: interval };
}

interface OnboardingBikePlateProps {
  make: string;
  model?: string | null;
  year?: number | null;
  size?: PlateSize;
  style?: ViewStyle;
  testID?: string;
}

/**
 * The rider's bike as a plate — the onboarding "aha". Appears the moment the
 * make is known in bike setup and is carried through reveal, maintenance and
 * commitment so the rider watches one object being set up. A new bike starts
 * ready; the figure is the make's service interval.
 */
export function OnboardingBikePlate({
  make,
  model,
  year,
  size = PLATE_SIZE.HERO,
  style,
  testID,
}: OnboardingBikePlateProps) {
  const { t } = useTranslation();
  const interval = splitServiceInterval(getBrandDna(make)?.serviceInterval);
  const name = [make, model].filter(Boolean).join(' ');
  const identity = year ? `${name} · ${year}` : name;
  const caption = t('onboarding.obRevealSpecInterval');

  return (
    <BikePlate
      state={PLATE_STATE.READY}
      size={size}
      figure={interval.figure}
      unit={interval.unit}
      caption={caption}
      stateLabel={t('home.readyLabel')}
      plateNumber={FIRST_PLATE_NUMBER}
      identity={identity}
      style={style}
      testID={testID}
      accessibilityLabel={`${identity}. ${caption} ${interval.figure} ${interval.unit ?? ''}`}
    />
  );
}
