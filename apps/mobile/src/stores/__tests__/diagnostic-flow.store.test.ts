// MOTO-VAULT-REACT-NATIVE-3Q: nothing in the diagnose flow required a problem, so a
// rider could tap Next -> Skip photo -> Analyze and the API answered BAD_REQUEST.
// hasProblemInput gates the Analyze button; pin it to the server's own schema so the
// two cannot drift apart.

import { SubmitDiagnosticSchema } from '@motovault/types';
import { useDiagnosticFlowStore } from '../diagnostic-flow.store';

const BIKE_ID = '00000000-0000-4000-8000-000000000001';
const PHOTO_BASE64 = 'a'.repeat(100);

// The payload new.tsx builds from the store, minus the async photo read.
function serverAccepts(): boolean {
  const s = useDiagnosticFlowStore.getState();
  const symptoms = s.wizardAnswers.symptoms.join(',');
  const location = s.wizardAnswers.location.join(',');
  const timing = s.wizardAnswers.timing.join(',');
  return SubmitDiagnosticSchema.safeParse({
    motorcycleId: BIKE_ID,
    photoBase64: s.photoUri ? PHOTO_BASE64 : undefined,
    freeTextDescription: s.freeTextDescription.trim() || undefined,
    additionalNotes: s.additionalNotes.trim() || undefined,
    wizardAnswers:
      symptoms || location || timing
        ? {
            symptoms: symptoms || undefined,
            location: location || undefined,
            timing: timing || undefined,
          }
        : undefined,
  }).success;
}

describe('diagnostic flow hasProblemInput', () => {
  beforeEach(() => useDiagnosticFlowStore.getState().reset());

  const cases: [string, () => void, boolean][] = [
    ['nothing entered', () => {}, false],
    [
      'whitespace-only description',
      () => useDiagnosticFlowStore.getState().setFreeTextDescription('   '),
      false,
    ],
    [
      'whitespace-only notes',
      () => useDiagnosticFlowStore.getState().setAdditionalNotes('  \n'),
      false,
    ],
    ['urgency alone', () => useDiagnosticFlowStore.getState().setUrgency('soon'), false],
    ['description', () => useDiagnosticFlowStore.getState().setFreeTextDescription('rattle'), true],
    ['notes', () => useDiagnosticFlowStore.getState().setAdditionalNotes('since rain'), true],
    ['photo', () => useDiagnosticFlowStore.getState().setPhotoUri('file:///p.jpg'), true],
    [
      'wizard option',
      () => useDiagnosticFlowStore.getState().toggleWizardOption('symptoms', 'dont_know'),
      true,
    ],
  ];

  it.each(cases)('%s', (_label, arrange, expected) => {
    arrange();
    expect(useDiagnosticFlowStore.getState().hasProblemInput()).toBe(expected);
    expect(serverAccepts()).toBe(expected);
  });
});
