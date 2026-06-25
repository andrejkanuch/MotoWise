import { Module } from '@nestjs/common';
import { RevalidationModule } from '../../common/revalidation/revalidation.module';
import { BlogResolver } from './blog.resolver';
import { BlogService } from './blog.service';

@Module({
  imports: [RevalidationModule],
  providers: [BlogResolver, BlogService],
})
export class BlogModule {}
