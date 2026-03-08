import { QuizQuestionSchema } from '@motolearn/types';
import type { Tables } from '@motolearn/types/database';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { Quiz, QuizAttempt } from './models/quiz.model';

@Injectable()
export class QuizzesService {
  constructor(@Inject(SUPABASE_USER) private readonly userClient: SupabaseClient) {}

  async findByArticle(articleId: string): Promise<Quiz | null> {
    const { data, error } = await this.userClient
      .from('quizzes')
      .select('*')
      .eq('article_id', articleId)
      .single();

    if (error || !data) return null;
    return this.mapQuizRow(data);
  }

  async submitAttempt(
    userId: string,
    input: { quizId: string; answers: number[] },
  ): Promise<QuizAttempt> {
    // Quiz read uses userClient — quizzes have SELECT USING (true) RLS policy.
    // Scoring happens server-side to prevent correct-answer leakage to clients.
    const quiz = await this.userClient
      .from('quizzes')
      .select('questions_json')
      .eq('id', input.quizId)
      .single();
    if (!quiz.data) throw new NotFoundException('Quiz not found');

    const questions = z.array(QuizQuestionSchema).parse(quiz.data.questions_json);
    const score = input.answers.reduce((acc, answer, i) => {
      return acc + (questions[i]?.correctIndex === answer ? 1 : 0);
    }, 0);

    const { data, error } = await this.userClient
      .from('quiz_attempts')
      .insert({
        user_id: userId,
        quiz_id: input.quizId,
        score,
        total_questions: questions.length,
        answers_json: input.answers,
      })
      .select()
      .single();

    if (error || !data) throw new InternalServerErrorException('Failed to submit quiz attempt');
    return this.mapAttemptRow(data);
  }

  private mapQuizRow(
    row: Pick<Tables<'quizzes'>, 'id' | 'article_id' | 'questions_json' | 'generated_at'>,
  ): Quiz {
    return {
      id: row.id,
      articleId: row.article_id,
      questions: z.array(QuizQuestionSchema).parse(row.questions_json),
      generatedAt: row.generated_at,
    };
  }

  private mapAttemptRow(
    row: Pick<
      Tables<'quiz_attempts'>,
      'id' | 'quiz_id' | 'score' | 'total_questions' | 'completed_at'
    >,
  ): QuizAttempt {
    return {
      id: row.id,
      quizId: row.quiz_id,
      score: row.score,
      totalQuestions: row.total_questions,
      completedAt: row.completed_at,
    };
  }
}
