import { type BikeStatusBike, type BikeStatusInput, buildBikeStatus } from '../carplay-bike-status';

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

const bike: BikeStatusBike = {
  nickname: 'Africa Twin',
  make: 'Honda',
  model: 'CRF1100L',
  currentMileage: 16_000,
  recallCount: 0,
};

const base: BikeStatusInput = {
  moving: false,
  bike,
  tasks: [{ title: 'Oil change', dueDate: daysFromNow(12), priority: 'high', status: 'pending' }],
  latestFuel: { filledAt: '2026-06-28T10:00:00.000Z', fuelLitres: 18.4 },
};

describe('buildBikeStatus', () => {
  it('collapses to a single "Stop to refresh" row while moving (R20)', () => {
    const model = buildBikeStatus({ ...base, moving: true }, 'metric');
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0].title).toBe('Stop to refresh');
  });

  it('shows a single "No bike set" row when there is no active bike', () => {
    const model = buildBikeStatus({ ...base, bike: null }, 'metric');
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0].title).toBe('No bike set');
  });

  it('builds the four status rows for an active bike', () => {
    const model = buildBikeStatus(base, 'metric');
    expect(model.title).toBe('Bike');
    expect(model.rows.map((r) => r.title)).toEqual(['Next service', 'Mileage', 'Recalls', 'Fuel']);
  });

  it('picks the most-urgent (overdue) task for next service', () => {
    const model = buildBikeStatus(
      {
        ...base,
        tasks: [
          { title: 'Chain lube', dueDate: daysFromNow(20), priority: 'low', status: 'pending' },
          { title: 'Brake pads', dueDate: daysFromNow(-3), priority: 'high', status: 'pending' },
        ],
      },
      'metric',
    );
    const nextService = model.rows.find((r) => r.title === 'Next service');
    expect(nextService?.detail).toContain('Brake pads');
    expect(nextService?.detail).toContain('overdue');
  });

  it('ignores completed tasks and dashes next service when none are active', () => {
    const model = buildBikeStatus(
      {
        ...base,
        tasks: [{ title: 'Done', dueDate: daysFromNow(-1), priority: 'high', status: 'completed' }],
      },
      'metric',
    );
    expect(model.rows.find((r) => r.title === 'Next service')?.detail).toBe('—');
  });

  it('shows recall count when > 0 and a safe state at 0', () => {
    expect(
      buildBikeStatus({ ...base, bike: { ...bike, recallCount: 3 } }, 'metric').rows.find(
        (r) => r.title === 'Recalls',
      )?.detail,
    ).toBe('3');
    expect(buildBikeStatus(base, 'metric').rows.find((r) => r.title === 'Recalls')?.detail).toBe(
      'None',
    );
  });

  it('formats mileage in the selected measurement system', () => {
    expect(buildBikeStatus(base, 'metric').rows.find((r) => r.title === 'Mileage')?.detail).toMatch(
      /km$/,
    );
    expect(
      buildBikeStatus(base, 'imperial').rows.find((r) => r.title === 'Mileage')?.detail,
    ).toMatch(/mi$/);
  });

  it('dashes missing mileage and fuel rather than showing 0 / NaN', () => {
    const model = buildBikeStatus(
      { ...base, bike: { ...bike, currentMileage: null }, latestFuel: null },
      'metric',
    );
    expect(model.rows.find((r) => r.title === 'Mileage')?.detail).toBe('—');
    expect(model.rows.find((r) => r.title === 'Fuel')?.detail).toBe('—');
  });
});
