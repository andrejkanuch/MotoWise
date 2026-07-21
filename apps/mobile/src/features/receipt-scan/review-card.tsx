import DateTimePicker from '@expo/ui/community/datetime-picker';
import { palette } from '@motovault/design-system';
import { MyMotorcyclesDocument } from '@motovault/graphql';
import {
  type Currency,
  EXPENSE_CATEGORIES,
  MaintenanceServiceType,
  type MeasurementSystem,
  mileageFromDisplayUnit,
  mileageToDisplayUnit,
  mileageUnitLabel,
} from '@motovault/types';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { type Href, router } from 'expo-router';
import {
  AlertTriangle,
  Bike,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Plus,
  Receipt,
  Wrench,
  X,
} from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useCurrency } from '../../hooks/use-currency';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import {
  CATEGORY_LABELS,
  formatCurrencyInput,
  serviceTypeLabel,
} from '../../lib/expense-constants';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { tint } from '../../theme/editorial';
import { triggerSelection } from '../../utils/haptics';
import { localDateFromISODate, toISODateInput } from '../../utils/trip-form-dates';
import {
  RECEIPT_REVIEW_TYPE,
  type ReceiptExtraction,
  type ReceiptReviewHandoff,
  type ReceiptReviewLineItem,
  type ReceiptReviewPayload,
  type ReceiptReviewType,
  type TranslationKey,
} from './scan-flow-constants';
import type { ScanBike } from './use-scan-flow';

// --- Field-key + needs-check constants (no magic strings) --------------------

/** The confidence-scored fields on the extraction result. */
const REVIEW_FIELD = {
  AMOUNT: 'amount',
  CURRENCY: 'currency',
  DATE: 'date',
  VENDOR: 'vendor',
  CATEGORY: 'category',
  ODOMETER: 'odometer',
} as const;
type ReviewField = (typeof REVIEW_FIELD)[keyof typeof REVIEW_FIELD];

/** Editable fields that carry no confidence score (still telemetered on edit). */
const EDIT_FIELD = {
  ITEM_NAME: 'itemName',
  PARTS_COST: 'partsCost',
  LABOR_COST: 'laborCost',
  TAX_AMOUNT: 'taxAmount',
  LINE_ITEMS: 'lineItems',
} as const;

/** Printed odometer unit as it appears on the receipt (KTD-7). */
const ODOMETER_UNIT = { MI: 'mi', KM: 'km' } as const;

/** Below this self-reported confidence a field is flagged needs-check (amber). */
const NEEDS_CHECK_CONFIDENCE_THRESHOLD = 0.7;

/** Cap on Dynamic Type scaling for the hero amount — shrink-to-fit, never truncate. */
const AMOUNT_MAX_FONT_MULTIPLIER = 1.3;

/** Short, per-field non-color cue announced beside the amber icon (WCAG 1.4.1). */
const NEEDS_CHECK_CUE_KEY: Record<ReviewField, TranslationKey> = {
  amount: 'receiptScan.review.checkAmount',
  currency: 'receiptScan.review.checkCurrency',
  date: 'receiptScan.review.checkDate',
  vendor: 'receiptScan.review.checkVendor',
  category: 'receiptScan.review.checkCategory',
  odometer: 'receiptScan.review.checkOdometer',
};

/** Odometer promoted-row visibility (the >, ≤, null matrix — KTD-7 display). */
const ODOMETER_STATE = {
  HIDDEN: 'hidden',
  FIRST_SET: 'firstSet',
  INCREASE: 'increase',
} as const;
type OdometerState = (typeof ODOMETER_STATE)[keyof typeof ODOMETER_STATE];

// --- Pure helpers ------------------------------------------------------------

/**
 * Needs-check = server flags (`result.needsCheck[]`) OR low field confidence.
 * Currency additionally flags when absent/uncertain (Q6). Amount is rendered
 * always-verify regardless — this only drives the extra amber cue.
 */
function deriveNeedsCheck(result: ReceiptExtraction): Set<ReviewField> {
  const flagged = new Set(result.needsCheck.map((r) => r.toLowerCase()));
  const conf = result.fieldConfidence;
  const confByField: Record<ReviewField, number> = {
    amount: conf.amount,
    currency: conf.currency,
    date: conf.date,
    vendor: conf.vendor,
    category: conf.category,
    odometer: conf.odometer,
  };
  const set = new Set<ReviewField>();
  for (const field of Object.values(REVIEW_FIELD)) {
    if (flagged.has(field) || confByField[field] < NEEDS_CHECK_CONFIDENCE_THRESHOLD) {
      set.add(field);
    }
  }
  if (!result.currency) set.add(REVIEW_FIELD.CURRENCY);
  return set;
}

/**
 * Convert the extracted odometer (printed in `odometerUnit`) into the owner's
 * measurement-system unit for DISPLAY (KTD-7 — normalize by the printed unit,
 * never an assumed km). Unknown printed unit → treat as already in-unit.
 */
function extractedOdometerInOwnerUnit(
  result: ReceiptExtraction,
  system: MeasurementSystem,
): number | null {
  if (result.odometerValue == null) return null;
  if (result.odometerUnit == null) return Math.round(result.odometerValue);
  const printedSystem: MeasurementSystem =
    result.odometerUnit === ODOMETER_UNIT.MI ? 'imperial' : 'metric';
  const km = mileageFromDisplayUnit(result.odometerValue, printedSystem);
  return Math.round(mileageToDisplayUnit(km, system));
}

/** The >, ≤, null visibility matrix for the promoted odometer row. */
function resolveOdometerState(odoOwnerUnit: number | null, current: number | null): OdometerState {
  if (odoOwnerUnit == null) return ODOMETER_STATE.HIDDEN;
  if (current == null) return ODOMETER_STATE.FIRST_SET;
  if (odoOwnerUnit > current) return ODOMETER_STATE.INCREASE;
  return ODOMETER_STATE.HIDDEN; // never surface a decrease / no-op
}

function parseNumeric(value: string): number | null {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function isMaintenance(type: ReceiptReviewType): boolean {
  return type === RECEIPT_REVIEW_TYPE.MAINTENANCE;
}

/** The canonical service-type keys, ordered for the picker (OTHER last). */
const SERVICE_TYPE_OPTIONS: readonly string[] = Object.values(MaintenanceServiceType);

/** Seed editable review line items from the extraction result. */
function seedLineItems(result: ReceiptExtraction): ReceiptReviewLineItem[] {
  return (result.lineItems ?? []).map((li) => ({
    label: li.label,
    serviceType: li.serviceType ?? null,
    partRef: li.partRef ?? null,
    quantity: li.quantity ?? null,
    unitPrice: li.unitPrice ?? null,
    lineTotal: li.lineTotal ?? null,
  }));
}

// --- Component ---------------------------------------------------------------

export interface ReviewCardProps {
  handoff: ReceiptReviewHandoff;
  bikeName: string;
  bikes: ScanBike[];
  isDark: boolean;
  onPark: () => void;
  onClose: () => void;
  /** U7d persists this; here the parent may pass a no-op/log. */
  onSave: (payload: ReceiptReviewPayload) => void;
}

/**
 * Receipt-scan review card (U7c). The human confirmation surface: it renders the
 * extracted result, lets the rider correct fields in LOCAL state, and hands a
 * confirmed `ReceiptReviewPayload` to `onSave`. It does NOT persist (U7d wires
 * save/undo). Type switching re-maps live with no new AI call and retains both
 * interpretations on round-trip (all fields live in state; the type toggle only
 * shows/hides the maintenance parts/labor rows).
 */
export function ReviewCard({
  handoff,
  bikeName,
  bikes,
  isDark,
  onPark,
  onClose,
  onSave,
}: ReviewCardProps) {
  const { t } = useTranslation();
  const { result } = handoff;
  const system = useMeasurementSystem();
  const { currency: userCurrency } = useCurrency();

  const motorcyclesQuery = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });
  const motorcycles = motorcyclesQuery.data?.myMotorcycles ?? [];

  // --- Local editable state (nothing cleared on a type round-trip) ---
  const [type, setType] = useState<ReceiptReviewType>(
    result.type === RECEIPT_REVIEW_TYPE.MAINTENANCE
      ? RECEIPT_REVIEW_TYPE.MAINTENANCE
      : RECEIPT_REVIEW_TYPE.EXPENSE,
  );
  const [amount, setAmount] = useState(result.amount != null ? String(result.amount) : '');
  const [currency, setCurrency] = useState(result.currency ?? userCurrency);
  // Parse the extracted `YYYY-MM-DD` as a LOCAL calendar date — `new Date(str)`
  // would treat it as UTC midnight and shift a day earlier west of UTC.
  const [date, setDate] = useState<Date | null>(() => localDateFromISODate(result.date));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [vendor, setVendor] = useState(result.vendor ?? '');
  const [itemName, setItemName] = useState(result.itemName ?? '');
  const [category, setCategory] = useState<string>(result.category ?? 'other');
  const [partsCost, setPartsCost] = useState(
    result.partsCost != null ? String(result.partsCost) : '',
  );
  const [laborCost, setLaborCost] = useState(
    result.laborCost != null ? String(result.laborCost) : '',
  );
  // Maintenance structure (receipt-scan redesign): explicit tax + editable line
  // items, retained across type round-trips. taxRate is printed metadata carried
  // straight through from the extraction.
  const [taxAmount, setTaxAmount] = useState(
    result.taxAmount != null ? String(result.taxAmount) : '',
  );
  const [lineItems, setLineItems] = useState<ReceiptReviewLineItem[]>(() => seedLineItems(result));
  const [serviceTypePickerIndex, setServiceTypePickerIndex] = useState<number | null>(null);
  // P7: canonical types the rider opted into a next-service reminder for.
  const [reminderTypes, setReminderTypes] = useState<Set<string>>(() => new Set());
  const [selectedBikeId, setSelectedBikeId] = useState(handoff.bikeId || '');
  const [applyOdometerPref, setApplyOdometerPref] = useState(true);
  const [zoomOpen, setZoomOpen] = useState(false);

  // Snapshot of extraction values so field_edited counts real corrections.
  const initial = useRef({
    amount: result.amount != null ? String(result.amount) : '',
    currency: result.currency ?? userCurrency,
    date: result.date ?? '',
    vendor: result.vendor ?? '',
    itemName: result.itemName ?? '',
    category: result.category ?? 'other',
    partsCost: result.partsCost != null ? String(result.partsCost) : '',
    laborCost: result.laborCost != null ? String(result.laborCost) : '',
  });

  const needsCheck = useMemo(() => deriveNeedsCheck(result), [result]);

  const selectedBike = motorcycles.find((m) => m.id === selectedBikeId) ?? null;
  const selectedBikeName = bikes.find((b) => b.id === selectedBikeId)?.name ?? bikeName;
  const hasBike = selectedBikeId.length > 0;

  const odoOwnerUnit = useMemo(
    () => extractedOdometerInOwnerUnit(result, system),
    [result, system],
  );
  // Only offer the odometer action once the bike/current-mileage query has resolved.
  // While it is loading or errored, `selectedBike` is null — treating that as "no
  // current odometer" would wrongly show a first-set row and allow a decrease.
  const odometerState = motorcyclesQuery.isSuccess
    ? resolveOdometerState(odoOwnerUnit, selectedBike?.currentMileage ?? null)
    : ODOMETER_STATE.HIDDEN;
  const odometerVisible = odometerState !== ODOMETER_STATE.HIDDEN;
  const applyOdometer = odometerVisible && applyOdometerPref;

  // --- Telemetry: one field_edited per field per session (R8 / Goal 5) ---
  const editedRef = useRef<Set<string>>(new Set());
  const markEdited = useCallback((field: string) => {
    if (editedRef.current.has(field)) return;
    editedRef.current.add(field);
    trackEvent(AnalyticsEvent.RECEIPT_SCAN_FIELD_EDITED, { field });
  }, []);
  const blurField = useCallback(
    (field: string, current: string, original: string) => {
      if (current.trim() !== original.trim()) markEdited(field);
    },
    [markEdited],
  );

  const switchType = useCallback(
    (next: ReceiptReviewType) => {
      if (next === type) return;
      triggerSelection();
      trackEvent(AnalyticsEvent.RECEIPT_SCAN_TYPE_SWITCHED, { from: type, to: next });
      setType(next);
    },
    [type],
  );

  const updateLineItem = useCallback(
    (index: number, patch: Partial<ReceiptReviewLineItem>) => {
      setLineItems((items) => items.map((li, i) => (i === index ? { ...li, ...patch } : li)));
      markEdited(EDIT_FIELD.LINE_ITEMS);
    },
    [markEdited],
  );
  const removeLineItem = useCallback(
    (index: number) => {
      triggerSelection();
      setLineItems((items) => items.filter((_, i) => i !== index));
      markEdited(EDIT_FIELD.LINE_ITEMS);
    },
    [markEdited],
  );
  const addLineItem = useCallback(() => {
    triggerSelection();
    setLineItems((items) => [
      ...items,
      {
        label: '',
        serviceType: null,
        partRef: null,
        quantity: null,
        unitPrice: null,
        lineTotal: null,
      },
    ]);
    markEdited(EDIT_FIELD.LINE_ITEMS);
  }, [markEdited]);

  // Distinct, meaningful service types among the reviewed lines (drives the
  // opt-in reminder chips). 'other'/blank are not remindable types.
  const reminderCandidates = useMemo(() => {
    const seen = new Set<string>();
    for (const li of lineItems) {
      if (li.serviceType && li.serviceType !== MaintenanceServiceType.OTHER)
        seen.add(li.serviceType);
    }
    return [...seen];
  }, [lineItems]);

  const toggleReminderType = useCallback((serviceType: string) => {
    triggerSelection();
    setReminderTypes((prev) => {
      const next = new Set(prev);
      if (next.has(serviceType)) next.delete(serviceType);
      else next.add(serviceType);
      return next;
    });
  }, []);

  const parsedAmount = parseNumeric(amount);
  // Mirror the server's reconcile gate (parts + labor + tax <= total). When the
  // sum exceeds total the API falls back to total-only and silently drops the
  // breakdown — block save here so that path is never reached from review.
  const breakdownExceedsAmount =
    isMaintenance(type) &&
    (parsedAmount ?? 0) > 0 &&
    (parseNumeric(partsCost) ?? 0) +
      (parseNumeric(laborCost) ?? 0) +
      (parseNumeric(taxAmount) ?? 0) >
      (parsedAmount ?? 0) + 0.001;
  const canSave = hasBike && (parsedAmount ?? 0) > 0 && !breakdownExceedsAmount;

  const handleSave = useCallback(() => {
    if (!canSave) return;
    // Success haptic fires on the AUTHORITATIVE save outcome in the U7d save hook
    // (after the duplicate soft-warn + the saveReceiptScan transaction), not here —
    // an optimistic tap haptic would misfire on a duplicate-cancel or a server error.
    onSave({
      motorcycleId: selectedBikeId,
      type,
      amount: parsedAmount,
      currency: currency.trim() || null,
      date: date ? toISODateInput(date) : null,
      vendor: vendor.trim() || null,
      itemName: itemName.trim() || null,
      category: category || null,
      partsCost: isMaintenance(type) ? parseNumeric(partsCost) : null,
      laborCost: isMaintenance(type) ? parseNumeric(laborCost) : null,
      taxAmount: isMaintenance(type) ? parseNumeric(taxAmount) : null,
      // taxRate is printed metadata — carried straight through from extraction.
      taxRate: isMaintenance(type) ? (result.taxRate ?? null) : null,
      // Only send non-empty lines; drop blank rows the rider added but left empty.
      lineItems: isMaintenance(type) ? lineItems.filter((li) => li.label.trim().length > 0) : [],
      // Opt-in reminders, filtered to types still present among the reviewed lines.
      reminderServiceTypes: isMaintenance(type)
        ? reminderCandidates.filter((st) => reminderTypes.has(st))
        : [],
      applyOdometer,
      // Server converts from the printed unit (KTD-7) — send the ORIGINAL.
      odometerValue: result.odometerValue ?? null,
      odometerUnit: result.odometerUnit ?? null,
    });
  }, [
    canSave,
    onSave,
    selectedBikeId,
    type,
    parsedAmount,
    currency,
    date,
    vendor,
    itemName,
    category,
    partsCost,
    laborCost,
    taxAmount,
    lineItems,
    reminderCandidates,
    reminderTypes,
    result.taxRate,
    applyOdometer,
    result.odometerValue,
    result.odometerUnit,
  ]);

  const ink = isDark ? palette.neutral50 : palette.neutral950;
  const muted = palette.neutral400;

  return (
    <Animated.View entering={FadeInUp.duration(220)} style={{ flex: 1 }}>
      <KeyboardAwareScrollView
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32, gap: 18 }}
      >
        {/* Header + prominent bike */}
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: ink }}>
            {t('receiptScan.review.title')}
          </Text>
          <BikeHeader
            hasBike={hasBike}
            label={t('receiptScan.review.forBike', { bike: selectedBikeName })}
            promptLabel={t('receiptScan.review.selectBikePrompt')}
          />
        </View>

        {/* Zero-bike path — select existing or add one before Save is enabled */}
        {!hasBike && (
          <ZeroBikePicker
            bikes={bikes}
            isDark={isDark}
            onSelect={(id) => {
              triggerSelection();
              setSelectedBikeId(id);
            }}
          />
        )}

        <TypeChips type={type} isDark={isDark} onSwitch={switchType} />
        <Text style={{ fontSize: 13, color: muted, marginTop: -8, marginLeft: 2 }}>
          {isMaintenance(type)
            ? t('receiptScan.review.typeMaintenanceHint')
            : t('receiptScan.review.typeExpenseHint')}
        </Text>

        {/* Amount hero + tappable receipt thumbnail (always-verify) */}
        <AmountField
          amount={amount}
          currency={currency}
          isDark={isDark}
          needsCheck={needsCheck.has(REVIEW_FIELD.AMOUNT)}
          currencyNeedsCheck={needsCheck.has(REVIEW_FIELD.CURRENCY)}
          imageUri={handoff.imageUri}
          onAmountChange={(v) => setAmount(formatCurrencyInput(v, userCurrency))}
          onAmountBlur={() => blurField(REVIEW_FIELD.AMOUNT, amount, initial.current.amount)}
          onCurrencyChange={(v) => setCurrency(v.toUpperCase().slice(0, 3))}
          onCurrencyBlur={() =>
            blurField(REVIEW_FIELD.CURRENCY, currency, initial.current.currency)
          }
          onOpenReceipt={() => setZoomOpen(true)}
          checkAmountCue={t('receiptScan.review.checkAmount')}
          checkCurrencyCue={t('receiptScan.review.checkCurrency')}
        />

        {/* Vendor */}
        <TextField
          label={t('receiptScan.review.vendor')}
          value={vendor}
          isDark={isDark}
          needsCheckCue={needsCheck.has(REVIEW_FIELD.VENDOR) ? t(NEEDS_CHECK_CUE_KEY.vendor) : null}
          onChangeText={setVendor}
          onBlur={() => blurField(REVIEW_FIELD.VENDOR, vendor, initial.current.vendor)}
        />

        {/* Date */}
        <DateField
          label={t('receiptScan.review.date')}
          date={date}
          isDark={isDark}
          placeholder={t('receiptScan.review.pickDate')}
          expanded={showDatePicker}
          needsCheckCue={needsCheck.has(REVIEW_FIELD.DATE) ? t(NEEDS_CHECK_CUE_KEY.date) : null}
          onToggle={() => setShowDatePicker((s) => !s)}
          onChange={(d) => {
            setDate(d);
            markEdited(REVIEW_FIELD.DATE);
          }}
          onClose={() => setShowDatePicker(false)}
        />

        {/* Category (constrained to expense categories) */}
        <CategoryField
          category={category}
          isDark={isDark}
          needsCheckCue={
            needsCheck.has(REVIEW_FIELD.CATEGORY) ? t(NEEDS_CHECK_CUE_KEY.category) : null
          }
          label={t('receiptScan.review.category')}
          onSelect={(c) => {
            triggerSelection();
            setCategory(c);
            if (c !== initial.current.category) markEdited(REVIEW_FIELD.CATEGORY);
          }}
        />

        {/* Item name */}
        <TextField
          label={t('receiptScan.review.itemName')}
          value={itemName}
          isDark={isDark}
          needsCheckCue={null}
          onChangeText={(v) => setItemName(v.slice(0, 120))}
          onBlur={() => blurField(EDIT_FIELD.ITEM_NAME, itemName, initial.current.itemName)}
        />

        {/* Maintenance-only parts + labor (retained across type round-trips) */}
        {isMaintenance(type) && (
          <Animated.View
            entering={FadeInUp.duration(180)}
            style={{ flexDirection: 'row', gap: 12 }}
          >
            <View style={{ flex: 1 }}>
              <NumberField
                label={t('receiptScan.review.partsCost')}
                value={partsCost}
                isDark={isDark}
                currency={currency}
                onChangeText={(v) => setPartsCost(formatCurrencyInput(v, userCurrency))}
                onBlur={() =>
                  blurField(EDIT_FIELD.PARTS_COST, partsCost, initial.current.partsCost)
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <NumberField
                label={t('receiptScan.review.laborCost')}
                value={laborCost}
                isDark={isDark}
                currency={currency}
                onChangeText={(v) => setLaborCost(formatCurrencyInput(v, userCurrency))}
                onBlur={() =>
                  blurField(EDIT_FIELD.LABOR_COST, laborCost, initial.current.laborCost)
                }
              />
            </View>
          </Animated.View>
        )}

        {/* Maintenance-only tax (kept out of parts/labor — total stays authoritative) */}
        {isMaintenance(type) && (
          <NumberField
            label={
              result.taxRate != null
                ? t('receiptScan.review.taxWithRate', { rate: result.taxRate })
                : t('receiptScan.review.tax')
            }
            value={taxAmount}
            isDark={isDark}
            currency={currency}
            onChangeText={(v) => setTaxAmount(formatCurrencyInput(v, userCurrency))}
            onBlur={() => markEdited(EDIT_FIELD.TAX_AMOUNT)}
          />
        )}

        {/* Maintenance-only editable line items (the itemized service history) */}
        {isMaintenance(type) && (
          <LineItemsField
            items={lineItems}
            isDark={isDark}
            currency={currency}
            userCurrency={userCurrency}
            title={t('receiptScan.review.lineItemsTitle')}
            addLabel={t('receiptScan.review.addLineItem')}
            labelPlaceholder={t('receiptScan.review.lineItemPlaceholder')}
            serviceTypeFieldLabel={t('receiptScan.review.serviceType')}
            removeLabel={t('receiptScan.review.removeLineItem')}
            onChangeLabel={(i, v) => updateLineItem(i, { label: v })}
            onChangeAmount={(i, v) => updateLineItem(i, { lineTotal: parseNumeric(v) })}
            onOpenServiceType={setServiceTypePickerIndex}
            onRemove={removeLineItem}
            onAdd={addLineItem}
          />
        )}

        {/* P7: opt-in "remind me for the next <type>" — user-confirmed, per type */}
        {isMaintenance(type) && reminderCandidates.length > 0 && (
          <ReminderOptIn
            candidates={reminderCandidates}
            selected={reminderTypes}
            isDark={isDark}
            title={t('receiptScan.review.remindTitle')}
            hint={t('receiptScan.review.remindHint')}
            onToggle={toggleReminderType}
          />
        )}

        {/* Odometer promoted row (only when > current, or first-set when null) */}
        {odometerVisible && odoOwnerUnit != null && (
          <OdometerRow
            isDark={isDark}
            firstSet={odometerState === ODOMETER_STATE.FIRST_SET}
            current={selectedBike?.currentMileage ?? null}
            next={odoOwnerUnit}
            unitLabel={mileageUnitLabel(system)}
            enabled={applyOdometerPref}
            needsCheck={needsCheck.has(REVIEW_FIELD.ODOMETER)}
            checkCue={t(NEEDS_CHECK_CUE_KEY.odometer)}
            onToggle={(v) => {
              setApplyOdometerPref(v);
              markEdited(REVIEW_FIELD.ODOMETER);
            }}
          />
        )}
      </KeyboardAwareScrollView>

      {/* Bottom actions */}
      <View style={{ paddingBottom: 24, paddingTop: 8, gap: 10 }}>
        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
          accessibilityLabel={t('receiptScan.review.save')}
          style={{
            minHeight: 52,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: canSave ? palette.signature500 : palette.neutral500,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Check size={20} color={palette.white} strokeWidth={2.5} />
          <Text style={{ color: palette.white, fontSize: 17, fontWeight: '700' }}>
            {t('receiptScan.review.save')}
          </Text>
        </Pressable>
        <Pressable
          onPress={onPark}
          accessibilityRole="button"
          accessibilityLabel={t('receiptScan.review.reviewLater')}
          style={{
            minHeight: 48,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: isDark ? palette.neutral800 : palette.neutral200,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Clock size={18} color={ink} />
          <Text style={{ fontSize: 16, fontWeight: '600', color: ink }}>
            {t('receiptScan.review.reviewLater')}
          </Text>
        </Pressable>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('receiptScan.common.done')}
          style={{ minHeight: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 15, color: muted, fontWeight: '600' }}>
            {t('receiptScan.common.done')}
          </Text>
        </Pressable>
      </View>

      <ReceiptZoomModal
        uri={handoff.imageUri}
        visible={zoomOpen}
        closeLabel={t('receiptScan.review.closeReceipt')}
        onClose={() => setZoomOpen(false)}
      />

      <ServiceTypePicker
        visible={serviceTypePickerIndex !== null}
        isDark={isDark}
        title={t('receiptScan.review.serviceType')}
        selected={
          serviceTypePickerIndex !== null
            ? (lineItems[serviceTypePickerIndex]?.serviceType ?? null)
            : null
        }
        onSelect={(key) => {
          if (serviceTypePickerIndex !== null) {
            updateLineItem(serviceTypePickerIndex, { serviceType: key });
          }
          setServiceTypePickerIndex(null);
        }}
        onClose={() => setServiceTypePickerIndex(null)}
      />
    </Animated.View>
  );
}

// --- Subcomponents -----------------------------------------------------------

function BikeHeader({
  hasBike,
  label,
  promptLabel,
}: {
  hasBike: boolean;
  label: string;
  promptLabel: string;
}) {
  const color = hasBike ? palette.neutral400 : palette.warning500;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Bike size={15} color={color} />
      <Text style={{ fontSize: 15, fontWeight: hasBike ? '600' : '700', color }}>
        {hasBike ? label : promptLabel}
      </Text>
    </View>
  );
}

function ZeroBikePicker({
  bikes,
  isDark,
  onSelect,
}: {
  bikes: ScanBike[];
  isDark: boolean;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const ink = isDark ? palette.neutral50 : palette.neutral900;

  if (bikes.length === 0) {
    return (
      <View
        style={{
          borderRadius: 14,
          borderCurve: 'continuous',
          backgroundColor: isDark ? palette.warningBgDark : palette.warningBgLight,
          borderWidth: 1,
          borderColor: palette.warningBorder,
          padding: 16,
          gap: 12,
        }}
      >
        <Text style={{ fontSize: 14, color: ink }}>{t('receiptScan.review.noBikePrompt')}</Text>
        <Pressable
          onPress={() => router.push('/(tabs)/(garage)/add-bike' as Href)}
          accessibilityRole="button"
          accessibilityLabel={t('receiptScan.review.addBike')}
          style={{
            minHeight: 44,
            borderRadius: 12,
            borderCurve: 'continuous',
            backgroundColor: palette.signature500,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Plus size={18} color={palette.white} strokeWidth={2.5} />
          <Text style={{ color: palette.white, fontSize: 15, fontWeight: '700' }}>
            {t('receiptScan.review.addBike')}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {bikes.map((bike) => (
        <Pressable
          key={bike.id}
          onPress={() => onSelect(bike.id)}
          accessibilityRole="button"
          accessibilityLabel={bike.name}
          style={{
            minHeight: 48,
            borderRadius: 12,
            borderCurve: 'continuous',
            backgroundColor: isDark ? palette.neutral800 : palette.white,
            borderWidth: 1,
            borderColor: isDark ? palette.neutral700 : palette.neutral200,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: ink }}>{bike.name}</Text>
          <ChevronRight size={18} color={palette.neutral400} />
        </Pressable>
      ))}
    </View>
  );
}

function TypeChips({
  type,
  isDark,
  onSwitch,
}: {
  type: ReceiptReviewType;
  isDark: boolean;
  onSwitch: (next: ReceiptReviewType) => void;
}) {
  const { t } = useTranslation();
  const options: Array<{ value: ReceiptReviewType; label: string; Icon: typeof Wrench }> = [
    {
      value: RECEIPT_REVIEW_TYPE.MAINTENANCE,
      label: t('receiptScan.review.typeMaintenance'),
      Icon: Wrench,
    },
    {
      value: RECEIPT_REVIEW_TYPE.EXPENSE,
      label: t('receiptScan.review.typeExpense'),
      Icon: Receipt,
    },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {options.map(({ value, label, Icon }) => {
        const selected = type === value;
        return (
          <Pressable
            key={value}
            onPress={() => onSwitch(value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            style={{
              flex: 1,
              minHeight: 48,
              borderRadius: 12,
              borderCurve: 'continuous',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: selected
                ? tint(palette.signature500, 0.12)
                : isDark
                  ? palette.neutral800
                  : palette.white,
              borderWidth: selected ? 1.5 : 1,
              borderColor: selected
                ? palette.signature500
                : isDark
                  ? palette.neutral700
                  : palette.neutral200,
            }}
          >
            <Icon
              size={17}
              color={selected ? palette.signature500 : palette.neutral400}
              strokeWidth={2}
            />
            <Text
              style={{
                fontSize: 15,
                fontWeight: selected ? '700' : '600',
                color: selected
                  ? palette.signature500
                  : isDark
                    ? palette.neutral300
                    : palette.neutral600,
              }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function NeedsCheckBadge({ cue }: { cue: string }) {
  return (
    <View
      accessible
      accessibilityLabel={cue}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        alignSelf: 'flex-start',
        backgroundColor: palette.warningBgDark,
        borderRadius: 8,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: palette.warningBorder,
        paddingHorizontal: 8,
        paddingVertical: 4,
      }}
    >
      <AlertTriangle size={13} color={palette.warning500} strokeWidth={2.5} />
      <Text style={{ fontSize: 12, fontWeight: '700', color: palette.warning500 }}>{cue}</Text>
    </View>
  );
}

function FieldLabel({ text, isDark }: { text: string; isDark: boolean }) {
  return (
    <Text
      style={{
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        color: isDark ? palette.neutral400 : palette.neutral500,
        marginBottom: 6,
        marginLeft: 2,
      }}
    >
      {text}
    </Text>
  );
}

function AmountField({
  amount,
  currency,
  isDark,
  needsCheck,
  currencyNeedsCheck,
  imageUri,
  onAmountChange,
  onAmountBlur,
  onCurrencyChange,
  onCurrencyBlur,
  onOpenReceipt,
  checkAmountCue,
  checkCurrencyCue,
}: {
  amount: string;
  currency: string;
  isDark: boolean;
  needsCheck: boolean;
  currencyNeedsCheck: boolean;
  imageUri: string | null;
  onAmountChange: (v: string) => void;
  onAmountBlur: () => void;
  onCurrencyChange: (v: string) => void;
  onCurrencyBlur: () => void;
  onOpenReceipt: () => void;
  checkAmountCue: string;
  checkCurrencyCue: string;
}) {
  const { t } = useTranslation();
  const ink = isDark ? palette.neutral50 : palette.neutral950;
  const cardBg = isDark ? palette.neutral800 : palette.white;
  const border = needsCheck
    ? palette.warningBorder
    : isDark
      ? palette.neutral700
      : palette.neutral200;
  return (
    <View>
      <FieldLabel text={t('receiptScan.review.amount')} isDark={isDark} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: cardBg,
          borderRadius: 16,
          borderCurve: 'continuous',
          borderWidth: needsCheck ? 1.5 : 1,
          borderColor: border,
          padding: 14,
        }}
      >
        <TextInput
          value={currency}
          onChangeText={onCurrencyChange}
          onBlur={onCurrencyBlur}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel={t('receiptScan.review.currency')}
          style={{
            fontSize: 15,
            fontWeight: '700',
            color: palette.neutral400,
            minWidth: 42,
          }}
        />
        <TextInput
          value={amount}
          onChangeText={onAmountChange}
          onBlur={onAmountBlur}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={palette.neutral500}
          accessibilityLabel={t('receiptScan.review.amount')}
          maxFontSizeMultiplier={AMOUNT_MAX_FONT_MULTIPLIER}
          numberOfLines={1}
          style={{ flex: 1, fontSize: 40, fontWeight: '800', color: ink, paddingVertical: 2 }}
        />
        <ReceiptThumbnail
          imageUri={imageUri}
          isDark={isDark}
          label={t('receiptScan.review.viewReceipt')}
          onPress={onOpenReceipt}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {needsCheck && <NeedsCheckBadge cue={checkAmountCue} />}
        {currencyNeedsCheck && <NeedsCheckBadge cue={checkCurrencyCue} />}
      </View>
    </View>
  );
}

function ReceiptThumbnail({
  imageUri,
  isDark,
  label,
  onPress,
}: {
  imageUri: string | null;
  isDark: boolean;
  label: string;
  onPress: () => void;
}) {
  if (!imageUri) return null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={label}
      style={{
        width: 56,
        height: 56,
        borderRadius: 10,
        borderCurve: 'continuous',
        overflow: 'hidden',
        backgroundColor: isDark ? palette.neutral700 : palette.neutral200,
      }}
    >
      <Image source={{ uri: imageUri }} style={{ width: 56, height: 56 }} contentFit="cover" />
    </Pressable>
  );
}

function TextField({
  label,
  value,
  isDark,
  needsCheckCue,
  onChangeText,
  onBlur,
}: {
  label: string;
  value: string;
  isDark: boolean;
  needsCheckCue: string | null;
  onChangeText: (v: string) => void;
  onBlur: () => void;
}) {
  const ink = isDark ? palette.neutral50 : palette.neutral900;
  const border = needsCheckCue
    ? palette.warningBorder
    : isDark
      ? palette.neutral700
      : palette.neutral200;
  return (
    <View>
      <FieldLabel text={label} isDark={isDark} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        accessibilityLabel={label}
        placeholderTextColor={palette.neutral500}
        style={{
          fontSize: 16,
          color: ink,
          backgroundColor: isDark ? palette.neutral800 : palette.white,
          borderRadius: 12,
          borderCurve: 'continuous',
          borderWidth: needsCheckCue ? 1.5 : 1,
          borderColor: border,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      />
      {needsCheckCue && (
        <View style={{ marginTop: 6 }}>
          <NeedsCheckBadge cue={needsCheckCue} />
        </View>
      )}
    </View>
  );
}

function NumberField({
  label,
  value,
  isDark,
  currency,
  onChangeText,
  onBlur,
}: {
  label: string;
  value: string;
  isDark: boolean;
  currency: string;
  onChangeText: (v: string) => void;
  onBlur: () => void;
}) {
  const ink = isDark ? palette.neutral50 : palette.neutral900;
  return (
    <View>
      <FieldLabel text={label} isDark={isDark} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: isDark ? palette.neutral800 : palette.white,
          borderRadius: 12,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: isDark ? palette.neutral700 : palette.neutral200,
          paddingHorizontal: 12,
          paddingVertical: 12,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: '700', color: palette.neutral400 }}>
          {currency}
        </Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={palette.neutral500}
          accessibilityLabel={label}
          style={{ flex: 1, fontSize: 16, fontWeight: '600', color: ink }}
        />
      </View>
    </View>
  );
}

function LineItemsField({
  items,
  isDark,
  currency,
  userCurrency,
  title,
  addLabel,
  labelPlaceholder,
  serviceTypeFieldLabel,
  removeLabel,
  onChangeLabel,
  onChangeAmount,
  onOpenServiceType,
  onRemove,
  onAdd,
}: {
  items: ReceiptReviewLineItem[];
  isDark: boolean;
  currency: string;
  userCurrency: Currency;
  title: string;
  addLabel: string;
  labelPlaceholder: string;
  /** Localized "Service type" field heading (distinct from the per-item value). */
  serviceTypeFieldLabel: string;
  removeLabel: string;
  onChangeLabel: (index: number, value: string) => void;
  onChangeAmount: (index: number, value: string) => void;
  onOpenServiceType: (index: number) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const ink = isDark ? palette.neutral50 : palette.neutral900;
  const cardBg = isDark ? palette.neutral800 : palette.white;
  const border = isDark ? palette.neutral700 : palette.neutral200;
  return (
    <View>
      <FieldLabel text={title} isDark={isDark} />
      <View style={{ gap: 10 }}>
        {items.map((item, index) => (
          <View
            // biome-ignore lint/suspicious/noArrayIndexKey: line items have no stable id pre-save
            key={index}
            style={{
              backgroundColor: cardBg,
              borderRadius: 12,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: border,
              padding: 12,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                value={item.label}
                onChangeText={(v) => onChangeLabel(index, v)}
                placeholder={labelPlaceholder}
                placeholderTextColor={palette.neutral500}
                accessibilityLabel={labelPlaceholder}
                style={{ flex: 1, fontSize: 15, fontWeight: '600', color: ink }}
              />
              <Pressable
                onPress={() => onRemove(index)}
                accessibilityRole="button"
                accessibilityLabel={removeLabel}
                hitSlop={8}
                style={{ padding: 4 }}
              >
                <X size={16} color={palette.neutral400} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                onPress={() => onOpenServiceType(index)}
                accessibilityRole="button"
                accessibilityLabel={serviceTypeFieldLabel}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 9,
                  borderCurve: 'continuous',
                  backgroundColor: tint(palette.signature500, 0.1),
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: palette.signature500 }}>
                  {item.serviceType ? serviceTypeLabel(item.serviceType, t) : serviceTypeFieldLabel}
                </Text>
                <ChevronRight size={13} color={palette.signature500} />
              </Pressable>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  marginLeft: 'auto',
                  backgroundColor: isDark ? palette.neutral900 : palette.neutral50,
                  borderRadius: 9,
                  borderCurve: 'continuous',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: palette.neutral400 }}>
                  {currency}
                </Text>
                <TextInput
                  value={item.lineTotal != null ? String(item.lineTotal) : ''}
                  onChangeText={(v) => onChangeAmount(index, formatCurrencyInput(v, userCurrency))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={palette.neutral500}
                  style={{ minWidth: 64, fontSize: 15, fontWeight: '600', color: ink }}
                />
              </View>
            </View>
          </View>
        ))}
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            minHeight: 44,
            borderRadius: 12,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: border,
            borderStyle: 'dashed',
          }}
        >
          <Plus size={16} color={palette.signature500} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: palette.signature500 }}>
            {addLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ReminderOptIn({
  candidates,
  selected,
  isDark,
  title,
  hint,
  onToggle,
}: {
  candidates: string[];
  selected: Set<string>;
  isDark: boolean;
  title: string;
  hint: string;
  onToggle: (serviceType: string) => void;
}) {
  const { t } = useTranslation();
  const muted = palette.neutral400;
  return (
    <View>
      <FieldLabel text={title} isDark={isDark} />
      <Text style={{ fontSize: 13, color: muted, marginBottom: 8, marginLeft: 2 }}>{hint}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {candidates.map((serviceType) => {
          const isSelected = selected.has(serviceType);
          return (
            <Pressable
              key={serviceType}
              onPress={() => onToggle(serviceType)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={serviceTypeLabel(serviceType, t)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 9,
                paddingHorizontal: 12,
                borderRadius: 11,
                borderCurve: 'continuous',
                backgroundColor: isSelected
                  ? tint(palette.signature500, 0.12)
                  : isDark
                    ? palette.neutral800
                    : palette.white,
                borderWidth: isSelected ? 1.5 : 1,
                borderColor: isSelected
                  ? palette.signature500
                  : isDark
                    ? palette.neutral700
                    : palette.neutral200,
              }}
            >
              {isSelected ? (
                <Check size={14} color={palette.signature500} strokeWidth={2.5} />
              ) : (
                <Plus size={14} color={palette.neutral400} strokeWidth={2} />
              )}
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: isSelected ? '700' : '500',
                  color: isSelected
                    ? palette.signature500
                    : isDark
                      ? palette.neutral300
                      : palette.neutral600,
                }}
              >
                {serviceTypeLabel(serviceType, t)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ServiceTypePicker({
  visible,
  isDark,
  title,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  isDark: boolean;
  title: string;
  selected: string | null;
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const ink = isDark ? palette.neutral50 : palette.neutral900;
  const sheetBg = isDark ? palette.neutral900 : palette.white;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: palette.surfaceOverlay, justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: sheetBg,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderCurve: 'continuous',
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 32,
            maxHeight: '70%',
          }}
        >
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text style={{ fontSize: 17, fontWeight: '800', color: ink }}>{title}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8}>
              <X size={22} color={palette.neutral400} />
            </Pressable>
          </View>
          <ScrollView style={{ marginTop: 12 }} contentContainerStyle={{ gap: 8 }}>
            {SERVICE_TYPE_OPTIONS.map((key) => {
              const isSelected = selected === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => onSelect(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    borderCurve: 'continuous',
                    backgroundColor: isSelected
                      ? tint(palette.signature500, 0.12)
                      : isDark
                        ? palette.neutral800
                        : palette.neutral50,
                    borderWidth: isSelected ? 1.5 : 1,
                    borderColor: isSelected ? palette.signature500 : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: isSelected ? '700' : '500',
                      color: isSelected ? palette.signature500 : ink,
                    }}
                  >
                    {serviceTypeLabel(key, t)}
                  </Text>
                  {isSelected && <Check size={18} color={palette.signature500} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DateField({
  label,
  date,
  isDark,
  placeholder,
  expanded,
  needsCheckCue,
  onToggle,
  onChange,
  onClose,
}: {
  label: string;
  date: Date | null;
  isDark: boolean;
  placeholder: string;
  expanded: boolean;
  needsCheckCue: string | null;
  onToggle: () => void;
  onChange: (d: Date) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const ink = isDark ? palette.neutral50 : palette.neutral900;
  const border = needsCheckCue
    ? palette.warningBorder
    : isDark
      ? palette.neutral700
      : palette.neutral200;
  const display = date
    ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : placeholder;
  return (
    <View>
      <FieldLabel text={label} isDark={isDark} />
      <View
        style={{
          backgroundColor: isDark ? palette.neutral800 : palette.white,
          borderRadius: 12,
          borderCurve: 'continuous',
          borderWidth: needsCheckCue ? 1.5 : 1,
          borderColor: border,
          overflow: 'hidden',
        }}
      >
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${display}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 14,
            paddingVertical: 13,
          }}
        >
          <Calendar size={17} color={palette.neutral400} />
          <Text style={{ flex: 1, fontSize: 16, color: date ? ink : palette.neutral500 }}>
            {display}
          </Text>
        </Pressable>
        {expanded && (
          <View
            style={{
              borderTopWidth: 0.5,
              borderTopColor: palette.neutral700,
              paddingHorizontal: 8,
            }}
          >
            <DateTimePicker
              value={date ?? new Date()}
              mode="date"
              display={process.env.EXPO_OS === 'ios' ? 'inline' : 'default'}
              maximumDate={new Date()}
              onChange={(event, selectedDate) => {
                if (process.env.EXPO_OS === 'android') onClose();
                if (event.type === 'set' && selectedDate) onChange(selectedDate);
              }}
              style={process.env.EXPO_OS === 'ios' ? { height: 320 } : undefined}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 8 }}>
              <Pressable onPress={onClose} accessibilityRole="button">
                <Text style={{ fontSize: 14, fontWeight: '600', color: palette.signature500 }}>
                  {t('receiptScan.common.done')}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
      {needsCheckCue && (
        <View style={{ marginTop: 6 }}>
          <NeedsCheckBadge cue={needsCheckCue} />
        </View>
      )}
    </View>
  );
}

function CategoryField({
  category,
  isDark,
  needsCheckCue,
  label,
  onSelect,
}: {
  category: string;
  isDark: boolean;
  needsCheckCue: string | null;
  label: string;
  onSelect: (c: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <View>
      <FieldLabel text={label} isDark={isDark} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {EXPENSE_CATEGORIES.map((c) => {
          const selected = category === c;
          return (
            <Pressable
              key={c}
              onPress={() => onSelect(c)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t(`expenses.category_${c}` as TranslationKey, {
                defaultValue: CATEGORY_LABELS[c],
              })}
              style={{
                paddingVertical: 9,
                paddingHorizontal: 14,
                borderRadius: 11,
                borderCurve: 'continuous',
                backgroundColor: selected
                  ? tint(palette.signature500, 0.12)
                  : isDark
                    ? palette.neutral800
                    : palette.white,
                borderWidth: selected ? 1.5 : 1,
                borderColor: selected
                  ? palette.signature500
                  : isDark
                    ? palette.neutral700
                    : palette.neutral200,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: selected ? '700' : '500',
                  color: selected
                    ? palette.signature500
                    : isDark
                      ? palette.neutral300
                      : palette.neutral600,
                }}
              >
                {t(`expenses.category_${c}` as TranslationKey, {
                  defaultValue: CATEGORY_LABELS[c],
                })}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {needsCheckCue && (
        <View style={{ marginTop: 6 }}>
          <NeedsCheckBadge cue={needsCheckCue} />
        </View>
      )}
    </View>
  );
}

function OdometerRow({
  isDark,
  firstSet,
  current,
  next,
  unitLabel,
  enabled,
  needsCheck,
  checkCue,
  onToggle,
}: {
  isDark: boolean;
  firstSet: boolean;
  current: number | null;
  next: number;
  unitLabel: string;
  enabled: boolean;
  needsCheck: boolean;
  checkCue: string;
  onToggle: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const ink = isDark ? palette.neutral50 : palette.neutral900;
  const fmt = (n: number) => n.toLocaleString();
  const valueText = firstSet
    ? `${fmt(next)} ${unitLabel}`
    : `${fmt(current ?? 0)} → ${fmt(next)} ${unitLabel}`;
  const title = firstSet
    ? t('receiptScan.review.odometerFirstSet')
    : t('receiptScan.review.odometer');
  const a11y = `${title}, ${valueText}`;
  return (
    <View
      style={{
        backgroundColor: isDark ? palette.neutral800 : palette.white,
        borderRadius: 14,
        borderCurve: 'continuous',
        borderWidth: needsCheck ? 1.5 : 1,
        borderColor: needsCheck
          ? palette.warningBorder
          : isDark
            ? palette.neutral700
            : palette.neutral200,
        padding: 14,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: ink, marginBottom: 2 }}>
            {title}
          </Text>
          <Text style={{ fontSize: 16, fontWeight: '600', color: palette.signature500 }}>
            {valueText}
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          accessibilityLabel={a11y}
          trackColor={{ true: palette.signature500, false: palette.neutral500 }}
        />
      </View>
      {needsCheck && <NeedsCheckBadge cue={checkCue} />}
    </View>
  );
}

/** Full-screen pinch/pan/double-tap zoom for the captured receipt photo. */
function ReceiptZoomModal({
  uri,
  visible,
  closeLabel,
  onClose,
}: {
  uri: string | null;
  visible: boolean;
  closeLabel: string;
  onClose: () => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);

  const reset = () => {
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    sx.value = 0;
    sy.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, savedScale.value * e.scale);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      tx.value = sx.value + e.translationX;
      ty.value = sy.value + e.translationY;
    })
    .onEnd(() => {
      sx.value = tx.value;
      sy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      // Worklet — cannot call the JS `reset` closure; inline the reset here.
      if (scale.value > 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        sx.value = 0;
        sy.value = 0;
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <Modal
      visible={visible && !!uri}
      transparent
      animationType="fade"
      onRequestClose={() => {
        reset();
        onClose();
      }}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', justifyContent: 'center' }}>
          {uri && (
            <GestureDetector gesture={gesture}>
              <Animated.View style={[{ width: '100%', height: '100%' }, imageStyle]}>
                <Image
                  source={{ uri }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                />
              </Animated.View>
            </GestureDetector>
          )}
          <Pressable
            onPress={() => {
              reset();
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            style={{
              position: 'absolute',
              top: 56,
              right: 20,
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: 'rgba(255,255,255,0.16)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={22} color={palette.white} strokeWidth={2} />
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
