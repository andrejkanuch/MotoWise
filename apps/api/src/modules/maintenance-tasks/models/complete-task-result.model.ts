import { Field, ObjectType } from '@nestjs/graphql';
import { MaintenanceTask } from './maintenance-task.model';

@ObjectType()
export class CompleteTaskResult {
  @Field(() => MaintenanceTask, {
    description: 'The task that was marked as completed',
  })
  completed: MaintenanceTask;

  @Field(() => MaintenanceTask, {
    nullable: true,
    description: 'The next occurrence if recurring and user opted in, null otherwise',
  })
  nextOccurrence?: MaintenanceTask;
}
