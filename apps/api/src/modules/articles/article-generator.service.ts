import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ArticleGeneratorService {
  constructor(readonly _configService: ConfigService) {}

  // TODO: Implement Claude AI article generation
  async generateArticle(_topic: string): Promise<unknown> {
    throw new Error('Article generation not yet implemented');
  }
}
