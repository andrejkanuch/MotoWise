import { AddNotePhotoSchema, CreateNoteSchema, UpdateNoteSchema } from '@motovault/types';
import { Injectable, Scope } from '@nestjs/common';
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AddNotePhotoInput } from './dto/add-note-photo.input';
import { CreateNoteInput } from './dto/create-note.input';
import { UpdateNoteInput } from './dto/update-note.input';
import { Note } from './models/note.model';
import { NotePhoto } from './models/note-photo.model';
import { NotePhotosLoader } from './note-photos.loader';
import { NotesService } from './notes.service';

// No entitlement check anywhere in this module: logging is always free.
@Resolver(() => Note)
@Injectable({ scope: Scope.REQUEST })
export class NotesResolver {
  constructor(
    private readonly notesService: NotesService,
    private readonly notePhotosLoader: NotePhotosLoader,
  ) {}

  @Query(() => [Note])
  async notes(
    @CurrentUser() user: AuthUser,
    @Args('motorcycleId', ParseUUIDPipe) motorcycleId: string,
  ): Promise<Note[]> {
    return this.notesService.findByMotorcycle(user.id, motorcycleId);
  }

  @Mutation(() => Note)
  async createNote(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateNoteSchema)) input: CreateNoteInput,
  ): Promise<Note> {
    return this.notesService.create(user.id, input);
  }

  @Mutation(() => Note)
  async updateNote(
    @CurrentUser() user: AuthUser,
    @Args('id', ParseUUIDPipe) id: string,
    @Args('input', new ZodValidationPipe(UpdateNoteSchema)) input: UpdateNoteInput,
  ): Promise<Note> {
    return this.notesService.update(user.id, id, input);
  }

  @Mutation(() => Boolean)
  async deleteNote(
    @CurrentUser() user: AuthUser,
    @Args('id', ParseUUIDPipe) id: string,
  ): Promise<boolean> {
    return this.notesService.softDelete(user.id, id);
  }

  @Mutation(() => Note)
  async createTaskFromNote(
    @CurrentUser() user: AuthUser,
    @Args('noteId', ParseUUIDPipe) noteId: string,
  ): Promise<Note> {
    return this.notesService.createTaskFromNote(user.id, noteId);
  }

  @Mutation(() => NotePhoto)
  async addNotePhoto(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(AddNotePhotoSchema)) input: AddNotePhotoInput,
  ): Promise<NotePhoto> {
    return this.notesService.addPhoto(
      user.id,
      input.noteId,
      input.storagePath,
      input.fileSizeBytes,
    );
  }

  @Mutation(() => Boolean)
  async deleteNotePhoto(
    @CurrentUser() user: AuthUser,
    @Args('photoId', ParseUUIDPipe) photoId: string,
  ): Promise<boolean> {
    return this.notesService.deletePhoto(user.id, photoId);
  }

  @ResolveField(() => [NotePhoto])
  async photos(@Parent() note: Note): Promise<NotePhoto[]> {
    return this.notePhotosLoader.load(note.id);
  }
}
