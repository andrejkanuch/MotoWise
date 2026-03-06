import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { Quiz, QuizAttempt } from './models/quiz.model';

@Injectable()
export class QuizzesService {
  constructor(
    @Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient,
    @Inject(SUPABASE_USER) private readonly userClient: SupabaseClient,
  ) {}

  async findByArticle(articleId: string): Promise<Quiz | null> {
    const { data, error } = await this.adminClient
      .from('quizzes')
      .select('*')
      .eq('article_id', articleId)
      .single();

    if (error || !data) return null;
    return {
      id: data.id,
      articleId: data.article_id,
      questions: data.questions_json as any,
      generatedAt: data.generated_at,
    };
  }

  async submitAttempt(
    userId: string,
    input: { quizId: string; answers: number[] },
  ): Promise<QuizAttempt> {
    const quiz = await this.adminClient
      .from('quizzes')
      .select('questions_json')
      .eq('id', input.quizId)
      .single();
    if (!quiz.data) throw new Error('Quiz not found');

    const questions = quiz.data.questions_json as any[];
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

    if (error || !data) throw new Error('Failed to submit quiz attempt');
    return {
      id: data.id,
      quizId: data.quiz_id,
      score: data.score,
      totalQuestions: data.total_questions,
      completedAt: data.completed_at,
    };
  }
}
