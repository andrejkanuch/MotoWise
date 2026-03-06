import { z } from 'zod';

export const QuizQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).min(2).max(6),
  correctIndex: z.number().int().min(0),
  explanation: z.string(),
});
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export const QuizSchema = z.object({
  questions: z.array(QuizQuestionSchema),
});
export type Quiz = z.infer<typeof QuizSchema>;

export const SubmitQuizSchema = z.object({
  quizId: z.string().uuid(),
  answers: z.array(z.number().int().min(0)),
});
export type SubmitQuiz = z.infer<typeof SubmitQuizSchema>;
