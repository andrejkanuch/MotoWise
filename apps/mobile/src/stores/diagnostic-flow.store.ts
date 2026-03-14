import { create } from 'zustand';

export type Step = 1 | 2 | 3 | 4;
export type NavigationDirection = 'forward' | 'backward';
export type InputMode = 'wizard' | 'freetext';
export type Urgency = 'stranded' | 'soon' | 'preventive';

export interface ManualBikeInfo {
  type: string;
  year?: number;
  make?: string;
  model?: string;
}

export interface WizardAnswers {
  symptoms: string[];
  location: string[];
  timing: string[];
}

interface DiagnosticFlowState {
  currentStep: Step;
  navigationDirection: NavigationDirection;
  editingFromReview: boolean;

  selectedMotorcycleId: string | null;
  manualBikeInfo: ManualBikeInfo | null;
  showManualForm: boolean;

  inputMode: InputMode;
  wizardAnswers: WizardAnswers;
  wizardSubStep: number;
  freeTextDescription: string;

  photoUri: string | null;
  additionalNotes: string;
  urgency: Urgency | null;

  dataSharingOptedIn: boolean;
  isSubmitting: boolean;
  submitError: string | null;

  setStep: (step: Step) => void;
  goNext: () => void;
  goBack: () => void;
  goToStepFromReview: (step: Step) => void;
  backToReview: () => void;
  setSelectedMotorcycleId: (id: string | null) => void;
  setManualBikeInfo: (info: ManualBikeInfo | null) => void;
  setShowManualForm: (show: boolean) => void;
  setInputMode: (mode: InputMode) => void;
  setWizardAnswers: (answers: WizardAnswers) => void;
  setWizardSubStep: (step: number) => void;
  setFreeTextDescription: (text: string) => void;
  setPhotoUri: (uri: string | null) => void;
  setAdditionalNotes: (notes: string) => void;
  setUrgency: (urgency: Urgency | null) => void;
  setDataSharingOptedIn: (opted: boolean) => void;
  setIsSubmitting: (submitting: boolean) => void;
  setSubmitError: (error: string | null) => void;
  reset: () => void;
  hasAnyData: () => boolean;
}

const initialState = {
  currentStep: 1 as Step,
  navigationDirection: 'forward' as NavigationDirection,
  editingFromReview: false,
  selectedMotorcycleId: null as string | null,
  manualBikeInfo: null as ManualBikeInfo | null,
  showManualForm: false,
  inputMode: 'wizard' as InputMode,
  wizardAnswers: { symptoms: [], location: [], timing: [] } as WizardAnswers,
  wizardSubStep: 0,
  freeTextDescription: '',
  photoUri: null as string | null,
  additionalNotes: '',
  urgency: null as Urgency | null,
  dataSharingOptedIn: false,
  isSubmitting: false,
  submitError: null as string | null,
};

export const useDiagnosticFlowStore = create<DiagnosticFlowState>()((set, get) => ({
  ...initialState,

  setStep: (step) => set({ currentStep: step }),

  goNext: () =>
    set((s) => {
      const next = Math.min(s.currentStep + 1, 4) as Step;
      return { currentStep: next, navigationDirection: 'forward', editingFromReview: false };
    }),

  goBack: () =>
    set((s) => {
      const prev = Math.max(s.currentStep - 1, 1) as Step;
      return { currentStep: prev, navigationDirection: 'backward' };
    }),

  goToStepFromReview: (step) =>
    set({ currentStep: step, navigationDirection: 'backward', editingFromReview: true }),

  backToReview: () =>
    set({ currentStep: 4, navigationDirection: 'forward', editingFromReview: false }),

  setSelectedMotorcycleId: (id) => set({ selectedMotorcycleId: id, manualBikeInfo: null }),
  setManualBikeInfo: (info) => set({ manualBikeInfo: info, selectedMotorcycleId: null }),
  setShowManualForm: (show) => set({ showManualForm: show }),
  setInputMode: (mode) => set({ inputMode: mode }),
  setWizardAnswers: (answers) => set({ wizardAnswers: answers }),
  setWizardSubStep: (step) => set({ wizardSubStep: step }),
  setFreeTextDescription: (text) => set({ freeTextDescription: text }),
  setPhotoUri: (uri) => set({ photoUri: uri }),
  setAdditionalNotes: (notes) => set({ additionalNotes: notes }),
  setUrgency: (urgency) => set({ urgency: urgency }),
  setDataSharingOptedIn: (opted) => set({ dataSharingOptedIn: opted }),
  setIsSubmitting: (submitting) => set({ isSubmitting: submitting }),
  setSubmitError: (error) => set({ submitError: error }),

  reset: () => set({ ...initialState }),

  hasAnyData: () => {
    const s = get();
    return !!(
      s.selectedMotorcycleId ||
      s.manualBikeInfo ||
      s.freeTextDescription.trim() ||
      s.photoUri ||
      s.additionalNotes.trim() ||
      s.urgency ||
      s.wizardAnswers.symptoms.length > 0 ||
      s.wizardAnswers.location.length > 0 ||
      s.wizardAnswers.timing.length > 0
    );
  },
}));
