import type { AllMaintenanceTasksQuery, MyMotorcyclesQuery } from '@motovault/graphql';

/** Single motorcycle from the MyMotorcycles query — used across home components. */
export type HomeMotorcycle = MyMotorcyclesQuery['myMotorcycles'][number];

/** One maintenance task from the AllMaintenanceTasks query. */
export type TaskItem = AllMaintenanceTasksQuery['allMaintenanceTasks'][number];
