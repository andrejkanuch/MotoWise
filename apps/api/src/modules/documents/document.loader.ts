import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { DocumentsService } from './documents.service';
import type { Document } from './models/document.model';
import type { DocumentFile } from './models/document-file.model';

/** Batches Document.files by documentId so document lists don't N+1. */
@Injectable({ scope: Scope.REQUEST })
export class DocumentFilesLoader {
  private readonly loader: DataLoader<string, DocumentFile[]>;

  constructor(private readonly documentsService: DocumentsService) {
    this.loader = new DataLoader<string, DocumentFile[]>(async (documentIds) => {
      const map = await this.documentsService.findFilesByDocumentIds([...documentIds]);
      return documentIds.map((id) => map.get(id) ?? []);
    });
  }

  load(documentId: string): Promise<DocumentFile[]> {
    return this.loader.load(documentId);
  }
}

/** Batches Motorcycle.documents by motorcycleId (U6) so bike lists don't N+1. */
@Injectable({ scope: Scope.REQUEST })
export class DocumentsByMotorcycleLoader {
  private readonly loader: DataLoader<string, Document[]>;

  constructor(private readonly documentsService: DocumentsService) {
    this.loader = new DataLoader<string, Document[]>(async (motorcycleIds) => {
      const map = await this.documentsService.findByMotorcycleIds([...motorcycleIds]);
      return motorcycleIds.map((id) => map.get(id) ?? []);
    });
  }

  load(motorcycleId: string): Promise<Document[]> {
    return this.loader.load(motorcycleId);
  }
}
