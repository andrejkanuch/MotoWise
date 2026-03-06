import { beforeEach, describe, expect, it } from 'vitest';
import { createMockSupabaseClient } from '../../../test/helpers/supabase-mock';
import { QuizzesService } from './quizzes.service';

describe('QuizzesService', () => {
  let service: QuizzesService;
  let adminMock: ReturnType<typeof createMockSupabaseClient>;
  let userMock: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    adminMock = createMockSupabaseClient();
    userMock = createMockSupabaseClient();
    service = new QuizzesService(adminMock.client as any, userMock.client as any);
  });

  describe('findByArticle', () => {
    it('should return a quiz with parsed questions', async () => {
      const questionsJson = [
        {
          question: 'What PSI?',
          options: ['30', '32', '36', '40'],
          correctIndex: 2,
          explanation: '36 is correct',
        },
      ];

      userMock.queryBuilder.resolveWith({
        data: {
          id: 'q1',
          article_id: 'a1',
          questions_json: questionsJson,
          generated_at: '2025-01-01T00:00:00Z',
        },
        error: null,
      });

      const result = await service.findByArticle('a1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('q1');
      expect(result!.articleId).toBe('a1');
      expect(result!.questions).toHaveLength(1);
      expect(result!.questions[0].correctIndex).toBe(2);
      expect(userMock.client.from).toHaveBeenCalledWith('quizzes');
    });

    it('should return null when quiz not found', async () => {
      userMock.queryBuilder.resolveWith({
        data: null,
        error: { message: 'not found' },
      });

      const result = await service.findByArticle('missing');
      expect(result).toBeNull();
    });
  });

  describe('submitAttempt', () => {
    it('should score answers and return attempt', async () => {
      const questionsJson = [
        { question: 'Q1', options: ['A', 'B', 'C', 'D'], correctIndex: 0, explanation: 'A' },
        { question: 'Q2', options: ['A', 'B', 'C', 'D'], correctIndex: 2, explanation: 'C' },
        { question: 'Q3', options: ['A', 'B', 'C', 'D'], correctIndex: 1, explanation: 'B' },
      ];

      // First call: fetch quiz questions
      userMock.queryBuilder.resolveWith({
        data: { questions_json: questionsJson },
        error: null,
      });

      // We need to handle two sequential .single() calls.
      // After the first resolves, update the mock for the second call (insert attempt).
      const originalSingle = userMock.queryBuilder.single;
      let callCount = 0;
      originalSingle.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ data: { questions_json: questionsJson }, error: null });
        }
        return Promise.resolve({
          data: {
            id: 'qa1',
            quiz_id: 'q1',
            score: 2,
            total_questions: 3,
            completed_at: '2025-01-01T12:00:00Z',
          },
          error: null,
        });
      });

      const result = await service.submitAttempt('u1', {
        quizId: 'q1',
        answers: [0, 2, 0], // correct, correct, wrong
      });

      expect(result.score).toBe(2);
      expect(result.totalQuestions).toBe(3);
      expect(result.quizId).toBe('q1');
    });

    it('should throw when quiz not found', async () => {
      userMock.queryBuilder.resolveWith({ data: null, error: null });

      await expect(
        service.submitAttempt('u1', { quizId: 'missing', answers: [0] }),
      ).rejects.toThrow('Quiz not found');
    });

    it('should throw when attempt insert fails', async () => {
      const questionsJson = [
        { question: 'Q1', options: ['A', 'B', 'C', 'D'], correctIndex: 0, explanation: 'A' },
      ];

      let callCount = 0;
      userMock.queryBuilder.single.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ data: { questions_json: questionsJson }, error: null });
        }
        return Promise.resolve({ data: null, error: { message: 'insert failed' } });
      });

      await expect(service.submitAttempt('u1', { quizId: 'q1', answers: [0] })).rejects.toThrow(
        'Failed to submit quiz attempt',
      );
    });
  });
});
