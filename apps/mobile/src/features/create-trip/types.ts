export interface LocalWaypoint {
  id: string;
  type: string;
  name: string;
  lat: number;
  lng: number;
  notes?: string;
  sortOrder: number;
  dayIndex: number;
  periodOfDay?: 'morning' | 'afternoon' | 'evening' | null;
}

export type PeriodOfDayLocal = 'morning' | 'afternoon' | 'evening';
