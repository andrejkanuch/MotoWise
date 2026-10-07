import { Module } from '@nestjs/common';
import { MaintenanceTasksModule } from '../maintenance-tasks/maintenance-tasks.module';
import { NotePhotosLoader } from './note-photos.loader';
import { NotesResolver } from './notes.resolver';
import { NotesService } from './notes.service';

@Module({
  imports: [MaintenanceTasksModule],
  providers: [NotesResolver, NotesService, NotePhotosLoader],
})
export class NotesModule {}
