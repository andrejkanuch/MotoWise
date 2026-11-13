import { BIKE_EDIT_SOURCE } from '@/config/routes';
import {
  BIKE_CAPTURE_LEVEL,
  BIKE_EDIT_FIELD,
  type BikeFormValues,
  bikeEditedProperties,
  changedBikeFields,
} from '../bike-edit-analytics';

const INITIAL: BikeFormValues = {
  nickname: 'Twin',
  year: '2022',
  make: 'Honda',
  model: '',
  mileage: '12000',
  isPrimary: true,
  photoUrl: null,
  purchasePrice: '',
  vin: '',
  variant: null,
};

describe('changedBikeFields', () => {
  it('is empty for an untouched form', () => {
    expect(changedBikeFields(INITIAL, { ...INITIAL })).toEqual([]);
  });

  it('names each changed field, never its value', () => {
    expect(
      changedBikeFields(INITIAL, {
        ...INITIAL,
        model: 'CB500F',
        mileage: '12500',
        photoUrl: 'https://example.test/p.jpg',
        vin: 'JH2PC40046M200000',
      }),
    ).toEqual([
      BIKE_EDIT_FIELD.MODEL,
      BIKE_EDIT_FIELD.MILEAGE,
      BIKE_EDIT_FIELD.PHOTO,
      BIKE_EDIT_FIELD.VIN,
    ]);
  });
});

describe('garage_bike_edited properties', () => {
  it('reports a make-only bike that gained a model, opened from the bike hub', () => {
    expect(
      bikeEditedProperties({
        initial: INITIAL,
        changed: [BIKE_EDIT_FIELD.YEAR, BIKE_EDIT_FIELD.MODEL],
        source: BIKE_EDIT_SOURCE.BIKE_HUB,
      }),
    ).toEqual({
      changed_fields: 'year,model',
      from_capture_level: BIKE_CAPTURE_LEVEL.MAKE,
      source: 'bike_hub',
      // The API does not report a schedule refresh yet (T23 adds it).
      schedule_refreshed_count: null,
    });
  });

  it('a bike with a model starts at model level; an unknown source reads as other', () => {
    expect(
      bikeEditedProperties({
        initial: { ...INITIAL, model: 'Africa Twin' },
        changed: [BIKE_EDIT_FIELD.NICKNAME],
        source: 'somewhere-else',
      }),
    ).toEqual(
      expect.objectContaining({
        from_capture_level: BIKE_CAPTURE_LEVEL.MODEL,
        source: BIKE_EDIT_SOURCE.OTHER,
      }),
    );
  });
});
