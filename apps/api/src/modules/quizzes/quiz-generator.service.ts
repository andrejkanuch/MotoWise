import { Injectable } from '@nestjs/common';

@Injectable()
export class QuizGeneratorService {
  // TODO: Implement Claude AI quiz generation
  async generateQuiz(_articleContent: string): Promise<unknown> {
    throw new Error('Quiz generation not yet implemented');
  }
}
