import { recallComponentLabel, recallComponentLabels } from '../recall-label';

describe('recallComponentLabel', () => {
  it.each([
    [
      'the most specific level, sentence case',
      'FUEL SYSTEM, GASOLINE:DELIVERY:FUEL PUMP',
      'Fuel pump',
    ],
    ['a single level keeps its comma', 'FUEL SYSTEM, GASOLINE', 'Fuel system, gasoline'],
    ['spaces around the separator are trimmed', 'ELECTRICAL SYSTEM: ECU', 'ECU'],
    ['acronyms keep their capitals', 'SERVICE BRAKES, HYDRAULIC:ANTILOCK:ABS MODULE', 'ABS module'],
    ['slashes are kept', 'LATCHES/LOCKS/LINKAGES', 'Latches/locks/linkages'],
    ['a trailing separator falls back to the last named level', 'SUSPENSION:FRONT:', 'Front'],
    ['mixed case is normalised', 'Steering:Handlebar', 'Handlebar'],
    ['blank stays blank', '   ', ''],
  ])('%s: %s → %s', (_label, component, expected) => {
    expect(recallComponentLabel(component)).toBe(expected);
  });
});

describe('recallComponentLabels', () => {
  it('drops blanks and repeats, keeping the first-seen order', () => {
    expect(
      recallComponentLabels([
        'FUEL SYSTEM, GASOLINE:DELIVERY:FUEL PUMP',
        '',
        'ELECTRICAL SYSTEM: ECU',
        'FUEL SYSTEM, DIESEL:DELIVERY:FUEL PUMP',
      ]),
    ).toEqual(['Fuel pump', 'ECU']);
  });
});
