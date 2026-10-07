import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import type { NotePhoto } from './models/note-photo.model';
import { NotesService } from './notes.service';

@Injectable({ scope: Scope.REQUEST })
export class NotePhotosLoader {
  private readonly loader: DataLoader<string, NotePhoto[]>;

  constructor(private readonly notesService: NotesService) {
    this.loader = new DataLoader<string, NotePhoto[]>(async (noteIds) => {
      const map = await this.notesService.findPhotosByNoteIds([...noteIds]);
      return noteIds.map((id) => map.get(id) ?? []);
    });
  }

  load(noteId: string): Promise<NotePhoto[]> {
    return this.loader.load(noteId);
  }
}
