import DateTimePicker from '@expo/ui/community/datetime-picker';
import { palette, withAlpha } from '@motovault/design-system';
import { Calendar, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { triggerImpact } from '../../utils/haptics';

/** The editorial-theme tokens these shared document form fields consume. */
interface DocumentFieldTheme {
  surface: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  warm: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

/**
 * Category chip selector shared by the add-document and document-detail screens
 * (previously copy-pasted in both, with diverging paddings — U6 review #13).
 */
export function DocumentCategoryChips({
  categories,
  selectedId,
  onSelect,
  theme,
}: {
  categories: CategoryOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  theme: DocumentFieldTheme;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {categories.map((c) => {
        const selected = selectedId === c.id;
        return (
          <Pressable
            key={c.id}
            onPress={() => {
              triggerImpact();
              onSelect(c.id);
            }}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 12,
              borderCurve: 'continuous',
              backgroundColor: selected ? withAlpha(palette.primary500, 0.094) : theme.surface,
              borderWidth: selected ? 1.5 : 1,
              borderColor: selected ? palette.primary500 : theme.line,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: selected ? '700' : '500',
                color: selected ? palette.primary500 : theme.ink2,
              }}
            >
              {c.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Expiry date field (tap-to-reveal inline DateTimePicker) shared by the
 * add-document and document-detail screens (U6 review #13).
 */
export function DocumentExpiryField({
  value,
  onChange,
  show,
  setShow,
  theme,
}: {
  value: Date | null;
  onChange: (d: Date | null) => void;
  show: boolean;
  setShow: (v: boolean) => void;
  theme: DocumentFieldTheme;
}) {
  const { t } = useTranslation();
  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 14,
        borderCurve: 'continuous',
        overflow: 'hidden',
      }}
    >
      <Pressable
        onPress={() => {
          triggerImpact();
          setShow(!show);
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
        }}
      >
        <Calendar size={16} color={theme.warm} strokeWidth={2} />
        <Text style={{ flex: 1, fontSize: 15, color: theme.ink }}>
          {value
            ? value.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : t('documents.noExpiry', { defaultValue: 'No expiry' })}
        </Text>
        {value && (
          <Pressable onPress={() => onChange(null)} hitSlop={8}>
            <X size={16} color={theme.ink3} strokeWidth={2} />
          </Pressable>
        )}
      </Pressable>
      {show && (
        <View style={{ borderTopWidth: 0.5, borderTopColor: theme.line, paddingHorizontal: 8 }}>
          <DateTimePicker
            value={value ?? new Date()}
            mode="date"
            display={process.env.EXPO_OS === 'ios' ? 'inline' : 'default'}
            onChange={(event, selectedDate) => {
              if (process.env.EXPO_OS === 'android') setShow(false);
              if (event.type === 'set' && selectedDate) onChange(selectedDate);
            }}
            style={process.env.EXPO_OS === 'ios' ? { height: 320 } : undefined}
          />
        </View>
      )}
    </View>
  );
}
