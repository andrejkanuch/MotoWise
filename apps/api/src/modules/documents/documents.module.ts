import { Module } from '@nestjs/common';
import { DocumentCategoriesService } from './categories.service';
import { DocumentFilesLoader, DocumentsByMotorcycleLoader } from './document.loader';
import { DocumentsResolver } from './documents.resolver';
import { DocumentsService } from './documents.service';

@Module({
  providers: [
    DocumentsResolver,
    DocumentsService,
    DocumentCategoriesService,
    DocumentFilesLoader,
    DocumentsByMotorcycleLoader,
  ],
  exports: [DocumentsService, DocumentsByMotorcycleLoader],
})
export class DocumentsModule {}
