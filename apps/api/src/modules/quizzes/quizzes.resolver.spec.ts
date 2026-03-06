import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { QuizzesResolver } from './quizzes.resolver';
import type { QuizzesService } from './quizzes.service';

function createMockService() {
  return {
    findByArticle: vi.fn(),
    submitAttempt: vi.fn(),
  };
}

describe('QuizzesResolver', () => {
  let resolver: QuizzesResolver;
  let service: ReturnType<typeof createMockService>;
  const mockUser: AuthUser = { id: 'user-1', email: 'test@example.com', role: 'rider' };

  beforeEach(() => {
    service = createMockService();
    resolver = new QuizzesResolver(service as unknown as QuizzesService);
  });

  describe('quizByArticle', () => {
    it('should delegate to quizzesService.findByArticle with articleId', async () => {
      const expected = { id: 'quiz-1', articleId: 'art-1', questions: [] };
      service.findByArticle.mockResolvedValue(expected);

      const result = await resolver.quizByArticle('art-1');

      expect(service.findByArticle).toHaveBeenCalledWith('art-1');
      expect(result).toEqual(expected);
    });

    it('should return null when quiz not found', async () => {
      service.findByArticle.mockResolvedValue(null);

      const result = await resolver.quizByArticle('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('submitQuiz', () => {
    it('should delegate to quizzesService.submitAttempt with user id and input', async () => {
      const input = { quizId: 'quiz-1', answers: [{ questionId: 'q1', selectedOption: 0 }] };
      const expected = { id: 'attempt-1', score: 100 };
      service.submitAttempt.mockResolvedValue(expected);

      const result = await resolver.submitQuiz(mockUser, input as any);

      expect(service.submitAttempt).toHaveBeenCalledWith('user-1', input);
      expect(result).toEqual(expected);
    });
  });

  describe('decorator metadata', () => {
    it('should have GqlAuthGuard on quizByArticle', () => {
      const guards = Reflect.getMetadata('__guards__', QuizzesResolver.prototype.quizByArticle);
      expect(guards).toBeDefined();
      const hasAuthGuard = guards.some((g: any) => g === GqlAuthGuard || g.name === 'GqlAuthGuard');
      expect(hasAuthGuard).toBe(true);
    });

    it('should have GqlAuthGuard on submitQuiz', () => {
      const guards = Reflect.getMetadata('__guards__', QuizzesResolver.prototype.submitQuiz);
      expect(guards).toBeDefined();
      const hasAuthGuard = guards.some((g: any) => g === GqlAuthGuard || g.name === 'GqlAuthGuard');
      expect(hasAuthGuard).toBe(true);
    });

    it('should have ZodValidationPipe on submitQuiz input arg', () => {
      const params = Reflect.getMetadata('__routeArguments__', QuizzesResolver, 'submitQuiz');
      expect(params).toBeDefined();
      const paramValues = Object.values(params) as any[];
      const hasPipe = paramValues.some((p: any) =>
        p.pipes?.some((pipe: any) => pipe instanceof ZodValidationPipe),
      );
      expect(hasPipe).toBe(true);
    });
  });
});
