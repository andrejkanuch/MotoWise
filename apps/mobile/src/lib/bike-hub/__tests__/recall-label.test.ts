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
    ['empty stays empty', '', ''],
    ['an all-acronym level stays in capitals', 'POWER TRAIN:DCT:TCM ECU', 'TCM ECU'],
    ['the new acronyms', 'FUEL SYSTEM:EVAP:PCM WIRING', 'PCM wiring'],
    ['a word with a digit is left alone', 'ELECTRICAL SYSTEM:12V BATTERY', '12V battery'],
    [
      'non-ASCII letters are sentence-cased too',
      'SYSTÈME ÉLECTRIQUE:ÉCLAIRAGE AVANT',
      'Éclairage avant',
    ],
    [
      'a generic last level falls back to the one before',
      'ELECTRICAL SYSTEM:WIRING:OTHER',
      'Wiring',
    ],
    ['"unknown" is generic too', 'POWER TRAIN:CVT:UNKNOWN', 'CVT'],
    ['an only-generic component keeps its words', 'UNKNOWN OR OTHER', 'Unknown or other'],
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
