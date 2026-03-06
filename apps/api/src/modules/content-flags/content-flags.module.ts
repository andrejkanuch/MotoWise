import { Module } from '@nestjs/common';
import { ContentFlagsResolver } from './content-flags.resolver';
import { ContentFlagsService } from './content-flags.service';

@Module({
  providers: [ContentFlagsResolver, ContentFlagsService],
})
export class ContentFlagsModule {}
