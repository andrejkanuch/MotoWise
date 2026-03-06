import { describe, expect, it } from 'vitest';
import {
  CreateDiagnosticSchema,
  DiagnosticIssueSchema,
  DiagnosticResultSchema,
} from '../diagnostic';

const validIssue = {
  description: 'Worn brake pads',
  probability: 0.85,
};

const validResult = {
  part: 'Front Brakes',
  issues: [validIssue],
  severity: 'high',
  toolsNeeded: ['Socket wrench', 'Brake cleaner'],
  difficulty: 'moderate',
  nextSteps: ['Inspect pad thickness', 'Replace if under 2mm'],
  confidence: 0.9,
  relatedArticleId: '550e8400-e29b-41d4-a716-446655440000',
};

const validCreateDiagnostic = {
  motorcycleId: '550e8400-e29b-41d4-a716-446655440000',
};

describe('DiagnosticIssueSchema', () => {
  describe('happy path', () => {
    it('accepts a valid issue', () => {
      const result = DiagnosticIssueSchema.safeParse(validIssue);
      expect(result.success).toBe(true);
    });
  });

  describe('missing required fields', () => {
    it('rejects missing description', () => {
      const result = DiagnosticIssueSchema.safeParse({ probability: 0.5 });
      expect(result.success).toBe(false);
    });

    it('rejects missing probability', () => {
      const result = DiagnosticIssueSchema.safeParse({ description: 'Issue' });
      expect(result.success).toBe(false);
    });
  });

  describe('boundary values', () => {
    it('accepts probability of 0', () => {
      const result = DiagnosticIssueSchema.safeParse({ ...validIssue, probability: 0 });
      expect(result.success).toBe(true);
    });

    it('accepts probability of 1', () => {
      const result = DiagnosticIssueSchema.safeParse({ ...validIssue, probability: 1 });
      expect(result.success).toBe(true);
    });

    it('rejects probability below 0', () => {
      const result = DiagnosticIssueSchema.safeParse({ ...validIssue, probability: -0.1 });
      expect(result.success).toBe(false);
    });

    it('rejects probability above 1', () => {
      const result = DiagnosticIssueSchema.safeParse({ ...validIssue, probability: 1.1 });
      expect(result.success).toBe(false);
    });
  });

  describe('unknown fields stripped', () => {
    it('strips unknown fields', () => {
      const result = DiagnosticIssueSchema.safeParse({ ...validIssue, severity: 'high' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('severity');
      }
    });
  });
});

describe('DiagnosticResultSchema', () => {
  describe('happy path', () => {
    it('accepts a valid result', () => {
      const result = DiagnosticResultSchema.safeParse(validResult);
      expect(result.success).toBe(true);
    });

    it('accepts all severity levels', () => {
      for (const severity of ['low', 'medium', 'high', 'critical']) {
        const result = DiagnosticResultSchema.safeParse({ ...validResult, severity });
        expect(result.success).toBe(true);
      }
    });

    it('accepts all difficulty levels', () => {
      for (const difficulty of ['easy', 'moderate', 'hard', 'professional']) {
        const result = DiagnosticResultSchema.safeParse({ ...validResult, difficulty });
        expect(result.success).toBe(true);
      }
    });

    it('accepts null relatedArticleId', () => {
      const result = DiagnosticResultSchema.safeParse({ ...validResult, relatedArticleId: null });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.relatedArticleId).toBeNull();
      }
    });
  });

  describe('missing required fields', () => {
    const requiredFields = [
      'part',
      'issues',
      'severity',
      'toolsNeeded',
      'difficulty',
      'nextSteps',
      'confidence',
      'relatedArticleId',
    ];

    for (const field of requiredFields) {
      it(`rejects missing ${field}`, () => {
        const input = { ...validResult };
        delete (input as Record<string, unknown>)[field];
        const result = DiagnosticResultSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    }
  });

  describe('invalid enum/format', () => {
    it('rejects invalid severity', () => {
      const result = DiagnosticResultSchema.safeParse({ ...validResult, severity: 'urgent' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid difficulty', () => {
      const result = DiagnosticResultSchema.safeParse({ ...validResult, difficulty: 'beginner' });
      expect(result.success).toBe(false);
    });

    it('rejects non-UUID relatedArticleId', () => {
      const result = DiagnosticResultSchema.safeParse({
        ...validResult,
        relatedArticleId: 'not-uuid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('boundary values', () => {
    it('accepts confidence of 0', () => {
      const result = DiagnosticResultSchema.safeParse({ ...validResult, confidence: 0 });
      expect(result.success).toBe(true);
    });

    it('accepts confidence of 1', () => {
      const result = DiagnosticResultSchema.safeParse({ ...validResult, confidence: 1 });
      expect(result.success).toBe(true);
    });

    it('rejects confidence below 0', () => {
      const result = DiagnosticResultSchema.safeParse({ ...validResult, confidence: -0.01 });
      expect(result.success).toBe(false);
    });

    it('rejects confidence above 1', () => {
      const result = DiagnosticResultSchema.safeParse({ ...validResult, confidence: 1.01 });
      expect(result.success).toBe(false);
    });

    it('accepts empty arrays', () => {
      const result = DiagnosticResultSchema.safeParse({
        ...validResult,
        issues: [],
        toolsNeeded: [],
        nextSteps: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('unknown fields stripped', () => {
    it('strips unknown fields', () => {
      const result = DiagnosticResultSchema.safeParse({ ...validResult, estimatedCost: 150 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('estimatedCost');
      }
    });
  });
});

describe('CreateDiagnosticSchema', () => {
  describe('happy path', () => {
    it('accepts a valid create diagnostic input', () => {
      const result = CreateDiagnosticSchema.safeParse(validCreateDiagnostic);
      expect(result.success).toBe(true);
    });

    it('accepts with optional wizardAnswers', () => {
      const result = CreateDiagnosticSchema.safeParse({
        ...validCreateDiagnostic,
        wizardAnswers: { symptom: 'grinding noise', location: 'front' },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.wizardAnswers).toEqual({ symptom: 'grinding noise', location: 'front' });
      }
    });

    it('accepts with dataSharingOptedIn true', () => {
      const result = CreateDiagnosticSchema.safeParse({
        ...validCreateDiagnostic,
        dataSharingOptedIn: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dataSharingOptedIn).toBe(true);
      }
    });
  });

  describe('missing required fields', () => {
    it('rejects missing motorcycleId', () => {
      const result = CreateDiagnosticSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('invalid enum/format', () => {
    it('rejects non-UUID motorcycleId', () => {
      const result = CreateDiagnosticSchema.safeParse({ motorcycleId: 'abc-123' });
      expect(result.success).toBe(false);
    });
  });

  describe('default/optional behavior', () => {
    it('dataSharingOptedIn defaults to false', () => {
      const result = CreateDiagnosticSchema.safeParse(validCreateDiagnostic);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dataSharingOptedIn).toBe(false);
      }
    });

    it('wizardAnswers is undefined when omitted', () => {
      const result = CreateDiagnosticSchema.safeParse(validCreateDiagnostic);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.wizardAnswers).toBeUndefined();
      }
    });
  });

  describe('unknown fields stripped', () => {
    it('strips unknown fields', () => {
      const result = CreateDiagnosticSchema.safeParse({ ...validCreateDiagnostic, userId: 'abc' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('userId');
      }
    });
  });
});
