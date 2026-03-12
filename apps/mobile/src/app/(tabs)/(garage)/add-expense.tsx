import { palette } from '@motolearn/design-system';
import { LogExpenseDocument } from '@motolearn/graphql';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, Check, Delete, Fuel, HardHat, Settings, Wrench } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, TextInput, useColorScheme, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

const CATEGORIES = [
  { key: 'fuel', icon: Fuel, label: 'Fuel', color: palette.warning500 },
  { key: 'maintenance', icon: Wrench, label: 'Maintenance', color: palette.success500 },
  { key: 'parts', icon: Settings, label: 'Parts', color: palette.primary500 },
  { key: 'gear', icon: HardHat, label: 'Gear', color: palette.accent500 },
] as const;

const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const;

function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

function hapticMedium() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayAmount(raw: string): string {
  if (!raw || raw === '0') return '$0';
  const num = Number.parseFloat(raw);
  if (Number.isNaN(num)) return '$0';
  // If user is still typing decimals, preserve the raw string
  if (
    raw.endsWith('.') ||
    (raw.includes('.') && raw.endsWith('0') && raw.split('.')[1].length <= 2)
  ) {
    return `$${raw}`;
  }
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: raw.includes('.') ? raw.split('.')[1].length : 0, maximumFractionDigits: 2 })}`;
}

export default function AddExpenseScreen() {
  const { t } = useTranslation();
  const { motorcycleId, bikeName } = useLocalSearchParams<{
    motorcycleId: string;
    bikeName?: string;
  }>();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [amountRaw, setAmountRaw] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [description, setDescription] = useState('');
  const [saved, setSaved] = useState(false);

  const amount = Number.parseFloat(amountRaw) || 0;
  const canSave = amount > 0 && category !== null;

  const handleNumpadPress = useCallback(
    (key: string) => {
      haptic();
      if (key === 'del') {
        setAmountRaw((prev) => prev.slice(0, -1));
        return;
      }
      if (key === '.') {
        if (amountRaw.includes('.')) return;
        setAmountRaw((prev) => (prev === '' ? '0.' : `${prev}.`));
        return;
      }
      setAmountRaw((prev) => {
        // Limit decimals to 2 places
        if (prev.includes('.') && prev.split('.')[1].length >= 2) return prev;
        // Limit total to 99999.99
        const next = prev + key;
        if (Number.parseFloat(next) > 99999.99) return prev;
        // Remove leading zero
        if (prev === '0' && key !== '.') return key;
        return next;
      });
    },
    [amountRaw],
  );

  const currentYear = new Date().getFullYear();

  const logMutation = useMutation({
    mutationFn: () =>
      gqlFetcher(LogExpenseDocument, {
        input: {
          motorcycleId,
          amount,
          category: category as string,
          date: formatDate(date),
          description: description.trim() || undefined,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.byMotorcycle(motorcycleId, currentYear),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.maintenanceTasks.spending(motorcycleId),
      });
      setSaved(true);
      hapticMedium();
      setTimeout(() => router.back(), 600);
    },
    onError: () => {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('expenses.saveFailed', { defaultValue: 'Failed to save expense. Please try again.' }),
      );
    },
  });

  const cardBg = isDark ? palette.neutral800 : palette.white;
  const surfaceBg = isDark ? palette.neutral900 : palette.neutral50;

  return (
    <View style={{ flex: 1, backgroundColor: surfaceBg }}>
      {/* Amount Display */}
      <Animated.View
        entering={FadeIn.duration(300)}
        style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}
      >
        {bikeName && (
          <Text
            style={{
              fontSize: 13,
              fontWeight: '500',
              color: palette.neutral500,
              marginBottom: 4,
            }}
          >
            {bikeName}
          </Text>
        )}
        <Text
          style={{
            fontSize: amountRaw.length > 7 ? 40 : 52,
            fontWeight: '800',
            fontVariant: ['tabular-nums'],
            color:
              amount > 0 ? (isDark ? palette.neutral50 : palette.neutral950) : palette.neutral400,
            letterSpacing: -1,
          }}
        >
          {formatDisplayAmount(amountRaw)}
        </Text>
      </Animated.View>

      {/* Category Pills */}
      <Animated.View
        entering={FadeInDown.delay(50).duration(250)}
        style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginTop: 8 }}
      >
        {CATEGORIES.map((cat) => {
          const selected = category === cat.key;
          const Icon = cat.icon;
          return (
            <Pressable
              key={cat.key}
              onPress={() => {
                haptic();
                setCategory(selected ? null : cat.key);
              }}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 12,
                borderCurve: 'continuous',
                alignItems: 'center',
                gap: 4,
                backgroundColor: selected
                  ? `${cat.color}18`
                  : isDark
                    ? palette.neutral800
                    : palette.white,
                borderWidth: selected ? 1.5 : 1,
                borderColor: selected
                  ? cat.color
                  : isDark
                    ? palette.neutral700
                    : palette.neutral200,
              }}
            >
              <Icon
                size={18}
                color={selected ? cat.color : isDark ? palette.neutral400 : palette.neutral500}
                strokeWidth={selected ? 2.2 : 1.8}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: selected ? '700' : '500',
                  color: selected ? cat.color : isDark ? palette.neutral400 : palette.neutral600,
                }}
              >
                {t(`expenses.category_${cat.key}`, { defaultValue: cat.label })}
              </Text>
            </Pressable>
          );
        })}
      </Animated.View>

      {/* Date + Description */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(250)}
        style={{ paddingHorizontal: 16, marginTop: 12, gap: 8 }}
      >
        {/* Date row */}
        <Pressable
          onPress={() => {
            haptic();
            setShowDatePicker(!showDatePicker);
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: cardBg,
            borderRadius: 12,
            borderCurve: 'continuous',
            paddingHorizontal: 14,
            paddingVertical: 12,
            gap: 10,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              borderCurve: 'continuous',
              backgroundColor: isDark ? palette.primary900 : palette.primary50,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Calendar size={14} color={palette.primary500} strokeWidth={2} />
          </View>
          <Text
            style={{
              flex: 1,
              fontSize: 15,
              fontWeight: '500',
              color: isDark ? palette.neutral50 : palette.neutral950,
            }}
          >
            {t('expenses.date', { defaultValue: 'Date' })}
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: palette.primary500,
            }}
          >
            {date.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: date.getFullYear() !== currentYear ? 'numeric' : undefined,
            })}
          </Text>
        </Pressable>

        {showDatePicker && (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={{
              backgroundColor: cardBg,
              borderRadius: 12,
              borderCurve: 'continuous',
              overflow: 'hidden',
            }}
          >
            <DateTimePicker
              value={date}
              mode="date"
              display="inline"
              maximumDate={new Date()}
              onChange={(_, selectedDate) => {
                if (selectedDate) setDate(selectedDate);
              }}
              style={{ height: 320 }}
            />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                paddingBottom: 8,
                paddingRight: 12,
              }}
            >
              <Pressable
                onPress={() => {
                  haptic();
                  setShowDatePicker(false);
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: palette.primary500 }}>
                  {t('common.done', { defaultValue: 'Done' })}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {/* Description */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 12,
            borderCurve: 'continuous',
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t('expenses.descriptionPlaceholder', {
              defaultValue: 'Note (optional)',
            })}
            placeholderTextColor={palette.neutral400}
            maxLength={200}
            style={{
              fontSize: 15,
              color: isDark ? palette.neutral50 : palette.neutral950,
              paddingVertical: 2,
            }}
          />
        </View>
      </Animated.View>

      {/* Numpad + Save */}
      <Animated.View
        entering={FadeInUp.delay(150).duration(300)}
        style={{
          marginTop: 'auto',
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 8,
        }}
      >
        {/* Numpad Grid */}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 12,
          }}
        >
          {NUMPAD_KEYS.map((key) => (
            <Pressable
              key={key}
              onPress={() => handleNumpadPress(key)}
              style={({ pressed }) => ({
                width: '31.5%',
                aspectRatio: 2.2,
                borderRadius: 12,
                borderCurve: 'continuous',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed
                  ? isDark
                    ? palette.neutral700
                    : palette.neutral200
                  : key === 'del'
                    ? isDark
                      ? palette.neutral800
                      : palette.neutral100
                    : isDark
                      ? palette.neutral800
                      : palette.white,
              })}
            >
              {key === 'del' ? (
                <Delete
                  size={22}
                  color={isDark ? palette.neutral300 : palette.neutral600}
                  strokeWidth={1.8}
                />
              ) : (
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: '600',
                    fontVariant: ['tabular-nums'],
                    color: isDark ? palette.neutral100 : palette.neutral800,
                  }}
                >
                  {key}
                </Text>
              )}
            </Pressable>
          ))}
        </View>

        {/* Save Button */}
        <Pressable
          onPress={() => {
            hapticMedium();
            logMutation.mutate();
          }}
          disabled={!canSave || logMutation.isPending || saved}
          style={{
            backgroundColor: saved
              ? palette.success500
              : canSave
                ? palette.primary500
                : isDark
                  ? palette.neutral700
                  : palette.neutral300,
            borderRadius: 14,
            borderCurve: 'continuous',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 16,
            gap: 8,
          }}
        >
          {saved && <Check size={18} color={palette.white} strokeWidth={2.5} />}
          <Text style={{ fontSize: 16, fontWeight: '700', color: palette.white }}>
            {saved
              ? t('expenses.saved', { defaultValue: 'Saved!' })
              : logMutation.isPending
                ? t('common.saving', { defaultValue: 'Saving...' })
                : t('expenses.logExpense', { defaultValue: 'Log Expense' })}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
