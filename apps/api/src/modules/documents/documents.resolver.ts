import {
  AddDocumentCategorySchema,
  CreateDocumentSchema,
  UpdateDocumentCategorySchema,
  UpdateDocumentSchema,
} from '@motovault/types';
import { Injectable, Scope, UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlThrottlerGuard } from '../../common/guards/gql-throttler.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { THROTTLE_PRESETS } from '../../config/constants';
import { DocumentCategoriesService } from './categories.service';
import { DocumentFilesLoader } from './document.loader';
import { DocumentsService } from './documents.service';
import { AddDocumentCategoryInput } from './dto/add-document-category.input';
import { CreateDocumentInput } from './dto/create-document.input';
import { UpdateDocumentInput } from './dto/update-document.input';
import { UpdateDocumentCategoryInput } from './dto/update-document-category.input';
import { Document } from './models/document.model';
import { DocumentCategory } from './models/document-category.model';
import { DocumentFile } from './models/document-file.model';

/** Default horizon for the garage soon-expiring aggregate (R11). */
const DEFAULT_EXPIRING_WINDOW_DAYS = 60;

@Resolver(() => Document)
@Injectable({ scope: Scope.REQUEST })
export class DocumentsResolver {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly categoriesService: DocumentCategoriesService,
    private readonly documentFilesLoader: DocumentFilesLoader,
  ) {}

  @Query(() => [Document])
  async documents(
    @CurrentUser() user: AuthUser,
    @Args('motorcycleId', ParseUUIDPipe) motorcycleId: string,
  ): Promise<Document[]> {
    return this.documentsService.findByMotorcycle(user.id, motorcycleId);
  }

  /** Soon-expiring documents across the rider's active bikes (garage alerts, R11). */
  @Query(() => [Document])
  async expiringDocuments(
    @CurrentUser() user: AuthUser,
    @Args('withinDays', { type: () => Int, nullable: true }) withinDays?: number,
  ): Promise<Document[]> {
    return this.documentsService.findExpiring(user.id, withinDays ?? DEFAULT_EXPIRING_WINDOW_DAYS);
  }

  @Query(() => [DocumentCategory])
  async documentCategories(
    @CurrentUser() user: AuthUser,
    @Args('includeHidden', { type: () => Boolean, nullable: true }) includeHidden?: boolean,
  ): Promise<DocumentCategory[]> {
    return this.categoriesService.list(user.id, includeHidden ?? false);
  }

  @Mutation(() => DocumentCategory)
  async addDocumentCategory(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(AddDocumentCategorySchema))
    input: AddDocumentCategoryInput,
  ): Promise<DocumentCategory> {
    return this.categoriesService.add(user.id, input);
  }

  @Mutation(() => DocumentCategory)
  async updateDocumentCategory(
    @CurrentUser() user: AuthUser,
    @Args('id', ParseUUIDPipe) id: string,
    @Args('input', new ZodValidationPipe(UpdateDocumentCategorySchema))
    input: UpdateDocumentCategoryInput,
  ): Promise<DocumentCategory> {
    return this.categoriesService.update(user.id, id, input);
  }

  /**
   * Explicit, throttled signing query — NOT a passive field resolver (a field
   * resolver would mint a URL per file on every list render and is awkward to
   * throttle). The returned URL is short-lived and never persisted.
   */
  @UseGuards(GqlThrottlerGuard)
  @Throttle({ default: THROTTLE_PRESETS.DOCUMENT_SIGN })
  @Query(() => String)
  async getDocumentSignedUrl(
    @CurrentUser() user: AuthUser,
    @Args('fileId', ParseUUIDPipe) fileId: string,
    @Args('download', { type: () => Boolean, nullable: true }) download?: boolean,
  ): Promise<string> {
    return this.documentsService.getSignedUrl(user.id, fileId, download ?? false);
  }

  @UseGuards(GqlThrottlerGuard)
  @Throttle({ default: THROTTLE_PRESETS.DOCUMENT_UPLOAD })
  @Mutation(() => Document)
  async createDocument(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateDocumentSchema)) input: CreateDocumentInput,
  ): Promise<Document> {
    return this.documentsService.create(user.id, input);
  }

  @Mutation(() => Document)
  async updateDocument(
    @CurrentUser() user: AuthUser,
    @Args('id', ParseUUIDPipe) id: string,
    @Args('input', new ZodValidationPipe(UpdateDocumentSchema)) input: UpdateDocumentInput,
  ): Promise<Document> {
    return this.documentsService.update(user.id, id, input);
  }

  @Mutation(() => Boolean)
  async deleteDocument(
    @CurrentUser() user: AuthUser,
    @Args('id', ParseUUIDPipe) id: string,
  ): Promise<boolean> {
    return this.documentsService.delete(user.id, id);
  }

  @ResolveField(() => [DocumentFile])
  async files(@Parent() document: Document): Promise<DocumentFile[]> {
    return this.documentFilesLoader.load(document.id);
  }
}
