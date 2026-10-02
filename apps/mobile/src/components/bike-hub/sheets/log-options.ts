import { Currency } from '@motovault/types';
import type { Href } from 'expo-router';
import {
  Check,
  FileText,
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
import { ADD_TASK_MODE, LOG_OPTION, type LogOption } from '../../../lib/bike-hub/constants';
import { type HubCopyKey, hub } from '../ui/tokens';

export interface LogOptionDefinition {
  id: LogOption;
  icon: LucideIcon;
  /** Set = the icon depends on the rider's currency (the Expense receipt). */
  iconFor?: (currency: Currency) => LucideIcon;
  iconColor: string;
  tileBackground: string;
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

/**
 * The five things a rider can log, in the order they are drawn. None of them is
 * gated: logging is always free.
 */
export const LOG_OPTIONS: readonly LogOptionDefinition[] = [
  {
    id: LOG_OPTION.EXPENSE,
    icon: ReceiptText,
    iconFor: expenseIconFor,
    iconColor: hub.soon,
    tileBackground: hub.tagHighBg,
    titleKey: 'bikeHub.log.expense',
    subKey: 'bikeHub.log.expenseSub',
    href: (params) => ({ pathname: '/(tabs)/(garage)/add-expense', params }),
  },
  {
    id: LOG_OPTION.TASK,
    icon: Wrench,
    iconColor: hub.text,
    tileBackground: hub.raised,
    titleKey: 'bikeHub.log.task',
    subKey: 'bikeHub.log.taskSub',
    href: (params) => ({ pathname: '/(tabs)/(garage)/add-maintenance-task', params }),
  },
  {
    id: LOG_OPTION.PAST_WORK,
    icon: Check,
    iconColor: hub.ok,
    tileBackground: hub.raised,
    titleKey: 'bikeHub.log.pastWork',
    subKey: 'bikeHub.log.pastWorkSub',
    href: (params) => ({
      pathname: '/(tabs)/(garage)/add-maintenance-task',
      params: { ...params, mode: ADD_TASK_MODE.LOG },
    }),
  },
  {
    id: LOG_OPTION.NOTE,
    icon: PenLine,
    iconColor: hub.dim,
    tileBackground: hub.raised,
    titleKey: 'bikeHub.log.note',
    subKey: 'bikeHub.log.noteSub',
    href: ({ motorcycleId }) => ({ pathname: '/(tabs)/(garage)/note', params: { motorcycleId } }),
  },
  {
    id: LOG_OPTION.DOCUMENT,
    icon: FileText,
    iconColor: hub.dim,
    tileBackground: hub.raised,
    titleKey: 'bikeHub.log.document',
    subKey: 'bikeHub.log.documentSub',
    href: (params) => ({ pathname: '/(tabs)/(garage)/add-document', params }),
  },
];
