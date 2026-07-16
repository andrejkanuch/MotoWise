/**
 * Odometer / mileage unit contract — the single guard that every place which
 * renders or persists mileage speaks the SAME canonical-km contract:
 *
 *   Storage is always kilometres. Display unit derives from the user's global
 *   measurement system. Convert km -> display on read, input -> km on write
 *   (rounded, because the columns are INTEGER).
 *
 * See docs/plans/odometer-unit-normalization.md. This is table-driven across
 * both systems so a regression in any conversion site (garage, CarPlay, PDF,
 * maintenance form, interval preview, ride sync) fails here.
 */
import {
  metersToKm,
  mileageFromDisplayUnit,
  mileageToDisplayUnit,
  mileageUnitLabel,
} from '@motovault/types';
import { buildBikeStatus } from '../features/carplay/carplay-bike-status';
import { generateMaintenanceHistoryHTML } from '../lib/pdf-template';
import { convertIntervalDistance, intervalDistanceUnit } from '../utils/maintenance-interval';
import { buildTaskUpdateInput } from '../utils/maintenance-task-form';

// Canonical fixture: 16093 km == 10000 mi (each rounds to the other).
const KM = 16093;
const DISPLAY = { metric: 16093, imperial: 10000 } as const;
const LABEL = { metric: 'km', imperial: 'mi' } as const;

describe('odometer/mileage unit contract (canonical km)', () => {
  describe.each(['metric', 'imperial'] as const)('%s user', (system) => {
    const display = DISPLAY[system];
    const unit = LABEL[system];

    it('unit label matches the measurement system', () => {
      expect(mileageUnitLabel(system)).toBe(unit);
    });

    it('READ: km -> display unit', () => {
      expect(Math.round(mileageToDisplayUnit(KM, system))).toBe(display);
    });

    it('WRITE: typed display value -> canonical km (integer)', () => {
      const km = Math.round(mileageFromDisplayUnit(display, system));
      expect(km).toBe(KM);
      expect(Number.isInteger(km)).toBe(true);
    });

    it('CarPlay bike-status renders the odometer in the display unit', () => {
      const model = buildBikeStatus(
        {
          moving: false,
          bike: { make: 'Yamaha', model: 'MT-07', currentMileage: KM, recallCount: 0 },
          tasks: [],
        },
        system,
      );
      const mileageRow = model.rows.find((r) => r.title === 'Mileage');
      expect(mileageRow?.detail).toBe(`${display.toLocaleString()} ${unit}`);
    });

    it('maintenance edit form persists targetMileage as km', () => {
      const input = buildTaskUpdateInput(
        {
          title: 'Oil change',
          description: '',
          notes: '',
          targetMileage: String(display),
          priority: 'medium',
          dueDateISO: null,
        },
        system,
      );
      expect(input.targetMileage).toBe(KM);
    });

    it('maintenance-history PDF renders mileage in the display unit', () => {
      const html = generateMaintenanceHistoryHTML(
        { make: 'Yamaha', model: 'MT-07', year: 2022, mileageUnit: 'km', currentMileage: KM },
        [
          {
            title: 'Service',
            status: 'completed',
            priority: 'medium',
            photoCount: 0,
            completedAt: '2026-01-10',
            completedMileage: KM,
          },
        ],
        system,
      );
      expect(html).toContain(`${display.toLocaleString()} ${unit}`);
    });
  });

  describe('maintenance interval preview (interval_km is km)', () => {
    it('metric shows the km interval as-is', () => {
      expect(convertIntervalDistance(10000, 'metric')).toBe(10000);
      expect(intervalDistanceUnit('metric')).toBe('km');
    });
    it('imperial converts the km interval to miles', () => {
      expect(convertIntervalDistance(16093, 'imperial')).toBe(10000);
      expect(intervalDistanceUnit('imperial')).toBe('mi');
    });
  });

  describe('ride sync (rides store meters; odometer is km)', () => {
    it('converts meters -> km before advancing the odometer', () => {
      expect(metersToKm(16_093_000)).toBeCloseTo(16093, 0);
      expect(metersToKm(1000)).toBe(1);
    });
  });

  describe('write -> read round-trip is display-preserving', () => {
    it.each([
      0, 1, 12345, 87654, 250000,
    ])('imperial %s mi survives the km round-trip (±1)', (miles) => {
      const km = Math.round(mileageFromDisplayUnit(miles, 'imperial'));
      expect(Math.round(mileageToDisplayUnit(km, 'imperial'))).toBe(miles);
    });
    it.each([0, 5000, 169340])('metric %s km is stored verbatim', (km) => {
      expect(Math.round(mileageFromDisplayUnit(km, 'metric'))).toBe(km);
      expect(Math.round(mileageToDisplayUnit(km, 'metric'))).toBe(km);
    });
  });
});
