import { palette } from '@motovault/design-system';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView as RNScrollView, Text, TextInput, View } from 'react-native';
import { WaypointTypePicker } from '../../components/trip/waypoint-type-picker';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { PERIOD_LABEL } from '../../utils/period-of-day';
import type { LocalWaypoint, PeriodOfDayLocal } from './types';

interface EditStopModalProps {
  editingWaypoint: LocalWaypoint | null;
  editName: string;
  setEditName: (value: string) => void;
  editType: string;
  setEditType: (value: string) => void;
  editNotes: string;
  setEditNotes: (value: string) => void;
  editPeriod: PeriodOfDayLocal | null;
  setEditPeriod: (value: PeriodOfDayLocal | null) => void;
  onClose: () => void;
  onApply: () => void;
}

export function EditStopModal({
  editingWaypoint,
  editName,
  setEditName,
  editType,
  setEditType,
  editNotes,
  setEditNotes,
  editPeriod,
  setEditPeriod,
  onClose,
  onApply,
}: EditStopModalProps) {
  const { t } = useEditorialTheme();
  const { t: i18n } = useTranslation();
  const titleColor = t.ink;
  const labelColor = t.ink2;
  const inputBg = t.surface2;
  const inputBorder = t.line;
  const inputTextColor = t.ink;
  const placeholderColor = t.ink4;

  return (
    <Modal
      visible={editingWaypoint !== null}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: t.bg,
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 12,
          }}
        >
          <Text
            style={{
              fontFamily: 'InstrumentSerif-Regular',
              fontSize: 22,
              color: titleColor,
            }}
          >
            {i18n('trips.editStop')}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              borderCurve: 'continuous',
              backgroundColor: t.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} color={t.ink3} />
          </Pressable>
        </View>

        <View
          style={{
            height: 1,
            backgroundColor: t.line,
            marginHorizontal: 20,
          }}
        />

        <RNScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 40,
            gap: 20,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name */}
          <View>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: labelColor,
                marginBottom: 6,
              }}
            >
              {i18n('trips.nameLabel')}
            </Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder={i18n('trips.stopNamePlaceholder')}
              placeholderTextColor={placeholderColor}
              maxLength={100}
              style={{
                backgroundColor: inputBg,
                borderWidth: 1,
                borderColor: inputBorder,
                borderRadius: 12,
                borderCurve: 'continuous',
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 15,
                color: inputTextColor,
              }}
            />
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: t.line,
            }}
          />

          {/* Type */}
          <View>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: labelColor,
                marginBottom: 6,
              }}
            >
              {i18n('trips.typeLabel')}
            </Text>
            <WaypointTypePicker selected={editType} onSelect={setEditType} />
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: t.line,
            }}
          />

          {/* Period of day */}
          <View>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: labelColor,
                marginBottom: 6,
              }}
            >
              {i18n('trips.periodOfDayLabel')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['morning', 'afternoon', 'evening'] as const).map((p) => {
                const selected = editPeriod === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => setEditPeriod(selected ? null : p)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      borderCurve: 'continuous',
                      borderWidth: 1,
                      borderColor: selected ? t.warm : inputBorder,
                      backgroundColor: selected ? tint(t.warm, 0.1) : t.surface2,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: selected ? t.warm : labelColor,
                      }}
                    >
                      {PERIOD_LABEL[p]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ fontSize: 11, color: placeholderColor, marginTop: 6 }}>
              {i18n('trips.periodOfDayHint')}
            </Text>
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: t.line,
            }}
          />

          {/* Notes */}
          <View>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: labelColor,
                marginBottom: 6,
              }}
            >
              {i18n('trips.notesLabel')}
            </Text>
            <TextInput
              value={editNotes}
              onChangeText={setEditNotes}
              placeholder={i18n('trips.stopNotesPlaceholder')}
              placeholderTextColor={placeholderColor}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
              style={{
                backgroundColor: inputBg,
                borderWidth: 1,
                borderColor: inputBorder,
                borderRadius: 12,
                borderCurve: 'continuous',
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 15,
                color: inputTextColor,
                minHeight: 100,
              }}
            />
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: t.line,
            }}
          />

          {/* Done button */}
          <Pressable
            onPress={onApply}
            style={{
              paddingVertical: 14,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: t.warm,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: palette.whitePure,
              }}
            >
              {i18n('common.done')}
            </Text>
          </Pressable>
        </RNScrollView>
      </View>
    </Modal>
  );
}
