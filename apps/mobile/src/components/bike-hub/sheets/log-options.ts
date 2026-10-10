import { Currency } from '@motovault/types';
import type { Href } from 'expo-router';
import {
  Check,
  FileText,
  Gauge,
  type LucideIcon,
  PenLine,
  Receipt,
  ReceiptEuro,
  ReceiptJapaneseYen,
  ReceiptPoundSterling,
  ReceiptSwissFranc,
  ReceiptText,
  ReceiptTurkishLira,
  Wrench,
} from 'lucide-react-native';
import { ADD_TASK_MODE, LOG_OPTION, type LogOption } from '@/lib/bike-hub/constants';
import { EXPENSE_ENTRY_SOURCE } from '@/lib/expense-analytics';
import type { HubColorKey, HubCopyKey } from '../ui/tokens';

export interface LogOptionDefinition {
  id: LogOption;
  icon: LucideIcon;
  /** Set = the icon depends on the rider's currency (the Expense receipt). */
  iconFor?: (currency: Currency) => LucideIcon;
  /** Hub colour of the icon, resolved against the active scheme's hub theme. */
  iconTone: HubColorKey;
  /** Hub colour of the icon's tile. */
  tileTone: HubColorKey;
  titleKey: HubCopyKey;
  subKey: HubCopyKey;
  /** The form this option opens, for the given bike. D3: today's screens. */
  href: (target: { motorcycleId: string; bikeName: string }) => Href;
}

/** Receipts that carry the currency's own sign; `Receipt` is lucide's "$" receipt. */
const RECEIPT_BY_CURRENCY: Partial<Record<Currency, LucideIcon>> = {
  [Currency.USD]: Receipt,
  [Currency.CAD]: Receipt,
  [Currency.AUD]: Receipt,
  [Currency.MXN]: Receipt,
  [Currency.COP]: Receipt,
  [Currency.ARS]: Receipt,
  [Currency.CLP]: Receipt,
  [Currency.EUR]: ReceiptEuro,
  [Currency.GBP]: ReceiptPoundSterling,
  [Currency.JPY]: ReceiptJapaneseYen,
  [Currency.CHF]: ReceiptSwissFranc,
  [Currency.TRY]: ReceiptTurkishLira,
};

/** The Expense option's receipt for the rider's currency; a plain receipt for the rest. */
export function expenseIconFor(currency: Currency): LucideIcon {
  return RECEIPT_BY_CURRENCY[currency] ?? ReceiptText;
}

const EXPENSE: LogOptionDefinition = {
  id: LOG_OPTION.EXPENSE,
  icon: ReceiptText,
  iconFor: expenseIconFor,
  iconTone: 'text',
  tileTone: 'raised',
  titleKey: 'bikeHub.log.expense',
  subKey: 'bikeHub.log.expenseSub',
  href: (params) => ({
    pathname: '/(tabs)/(garage)/add-expense',
    params: { ...params, entrySource: EXPENSE_ENTRY_SOURCE.BIKE_HUB },
  }),
};

const PAST_WORK: LogOptionDefinition = {
  id: LOG_OPTION.PAST_WORK,
  icon: Check,
  iconTone: 'text',
  tileTone: 'raised',
  titleKey: 'bikeHub.log.pastWork',
  subKey: 'bikeHub.log.pastWorkSub',
  href: (params) => ({
    pathname: '/(tabs)/(garage)/add-maintenance-task',
    params: { ...params, mode: ADD_TASK_MODE.LOG },
  }),
};

const ODOMETER: LogOptionDefinition = {
  id: LOG_OPTION.ODOMETER,
  icon: Gauge,
  iconTone: 'text',
  tileTone: 'raised',
  titleKey: 'bikeHub.log.odometer',
  subKey: 'bikeHub.log.odometerSub',
  href: ({ motorcycleId }) => ({
    pathname: '/(tabs)/(garage)/odometer',
    params: { motorcycleId },
  }),
};

const NOTE: LogOptionDefinition = {
  id: LOG_OPTION.NOTE,
  icon: PenLine,
  iconTone: 'dim',
  tileTone: 'raised',
  titleKey: 'bikeHub.log.note',
  subKey: 'bikeHub.log.noteSub',
  href: ({ motorcycleId }) => ({ pathname: '/(tabs)/(garage)/note', params: { motorcycleId } }),
};

/** Planning, not logging: it records something still to do. */
const TASK: LogOptionDefinition = {
  id: LOG_OPTION.TASK,
  icon: Wrench,
  iconTone: 'dim',
  tileTone: 'raised',
  titleKey: 'bikeHub.log.planTask',
  subKey: 'bikeHub.log.taskSub',
  href: (params) => ({ pathname: '/(tabs)/(garage)/add-maintenance-task', params }),
};

const DOCUMENT: LogOptionDefinition = {
  id: LOG_OPTION.DOCUMENT,
  icon: FileText,
  iconTone: 'dim',
  tileTone: 'raised',
  titleKey: 'bikeHub.log.document',
  subKey: 'bikeHub.log.documentSub',
  href: (params) => ({ pathname: '/(tabs)/(garage)/add-document', params }),
};

/**
 * The six things a rider can log, in the order they are drawn: what just
 * happened first (money, work done, the odometer), then notes, then planning
 * and paperwork. None of them is gated: logging is always free.
 */
export const LOG_OPTIONS: readonly LogOptionDefinition[] = [
  EXPENSE,
  PAST_WORK,
  ODOMETER,
  NOTE,
  TASK,
  DOCUMENT,
];
