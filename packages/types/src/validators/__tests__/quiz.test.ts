import { describe, expect, it } from 'vitest';
import { QuizQuestionSchema, QuizSchema, SubmitQuizSchema } from '../quiz';

const validQuestion = {
  question: 'What oil weight is standard for most sportbikes?',
  options: ['5W-30', '10W-40', '20W-50'],
  correctIndex: 1,
  explanation: '10W-40 is the most commonly recommended weight.',
};

const validQuiz = { questions: [validQuestion] };

const validSubmit = {
  quizId: '550e8400-e29b-41d4-a716-446655440000',
  answers: [1, 0, 2],
};

describe('QuizQuestionSchema', () => {
  describe('happy path', () => {
    it('accepts a valid question', () => {
      const result = QuizQuestionSchema.safeParse(validQuestion);
      expect(result.success).toBe(true);
    });
  });

  describe('missing required fields', () => {
    for (const field of ['question', 'options', 'correctIndex', 'explanation']) {
      it(`rejects missing ${field}`, () => {
        const input = { ...validQuestion };
        delete (input as Record<string, unknown>)[field];
        const result = QuizQuestionSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    }
  });

  describe('boundary values', () => {
    it('accepts options with exactly 2 items (minimum)', () => {
      const result = QuizQuestionSchema.safeParse({ ...validQuestion, options: ['A', 'B'] });
      expect(result.success).toBe(true);
    });

    it('rejects options with fewer than 2 items', () => {
      const result = QuizQuestionSchema.safeParse({ ...validQuestion, options: ['A'] });
      expect(result.success).toBe(false);
    });

    it('accepts options with exactly 6 items (maximum)', () => {
      const result = QuizQuestionSchema.safeParse({
        ...validQuestion,
        options: ['A', 'B', 'C', 'D', 'E', 'F'],
      });
      expect(result.success).toBe(true);
    });

    it('rejects options with more than 6 items', () => {
      const result = QuizQuestionSchema.safeParse({
        ...validQuestion,
        options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      });
      expect(result.success).toBe(false);
    });

    it('accepts correctIndex of 0', () => {
      const result = QuizQuestionSchema.safeParse({ ...validQuestion, correctIndex: 0 });
      expect(result.success).toBe(true);
    });

    it('rejects negative correctIndex', () => {
      const result = QuizQuestionSchema.safeParse({ ...validQuestion, correctIndex: -1 });
      expect(result.success).toBe(false);
    });

    it('rejects non-integer correctIndex', () => {
      const result = QuizQuestionSchema.safeParse({ ...validQuestion, correctIndex: 1.5 });
      expect(result.success).toBe(false);
    });
  });

  describe('unknown fields stripped', () => {
    it('strips unknown fields', () => {
      const result = QuizQuestionSchema.safeParse({
        ...validQuestion,
        hint: 'Think about viscosity',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('hint');
      }
    });
  });
});

describe('QuizSchema', () => {
  describe('happy path', () => {
    it('accepts a valid quiz', () => {
      const result = QuizSchema.safeParse(validQuiz);
      expect(result.success).toBe(true);
    });

    it('accepts quiz with multiple questions', () => {
      const result = QuizSchema.safeParse({
        questions: [validQuestion, { ...validQuestion, question: 'Second question?' }],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.questions).toHaveLength(2);
      }
    });
  });

  describe('missing required fields', () => {
    it('rejects missing questions', () => {
      const result = QuizSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('boundary values', () => {
    it('accepts empty questions array', () => {
      const result = QuizSchema.safeParse({ questions: [] });
      expect(result.success).toBe(true);
    });
  });
});

describe('SubmitQuizSchema', () => {
  describe('happy path', () => {
    it('accepts a valid submission', () => {
      const result = SubmitQuizSchema.safeParse(validSubmit);
      expect(result.success).toBe(true);
    });
  });

  describe('missing required fields', () => {
    it('rejects missing quizId', () => {
      const result = SubmitQuizSchema.safeParse({ answers: [0] });
      expect(result.success).toBe(false);
    });

    it('rejects missing answers', () => {
      const result = SubmitQuizSchema.safeParse({ quizId: validSubmit.quizId });
      expect(result.success).toBe(false);
    });
  });

  describe('invalid enum/format', () => {
    it('rejects non-UUID quizId', () => {
      const result = SubmitQuizSchema.safeParse({ ...validSubmit, quizId: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });

    it('rejects negative answer values', () => {
      const result = SubmitQuizSchema.safeParse({ ...validSubmit, answers: [-1] });
      expect(result.success).toBe(false);
    });

    it('rejects non-integer answer values', () => {
      const result = SubmitQuizSchema.safeParse({ ...validSubmit, answers: [1.5] });
      expect(result.success).toBe(false);
    });
  });

  describe('boundary values', () => {
    it('accepts empty answers array', () => {
      const result = SubmitQuizSchema.safeParse({ ...validSubmit, answers: [] });
      expect(result.success).toBe(true);
    });

    it('accepts answer value of 0', () => {
      const result = SubmitQuizSchema.safeParse({ ...validSubmit, answers: [0] });
      expect(result.success).toBe(true);
    });
  });

  describe('unknown fields stripped', () => {
    it('strips unknown fields', () => {
      const result = SubmitQuizSchema.safeParse({ ...validSubmit, score: 100 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('score');
      }
    });
  });
});
