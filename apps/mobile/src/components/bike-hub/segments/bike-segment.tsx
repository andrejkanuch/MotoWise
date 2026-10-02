import {
  CalendarCog,
  Camera,
  FileText,
  type LucideIcon,
  Pencil,
  ShieldAlert,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useEditorialTheme } from '../../../theme/editorial';
import { BikeDetailsCard } from '../bike-details-card';
import { DocumentsSection } from '../documents-section';
import type { BikeActions } from '../shell/use-bike-actions';
import type { HubBike } from '../shell/use-bike-hub-data';
import { HubCard } from '../ui/hub-card';
import { RowChevron } from '../ui/row-chevron';
import { SectionHeader } from '../ui/section-header';
import { HUB_FONT, HUB_HEIGHT, HUB_RADIUS, HUB_TOUCH_TARGET, hub } from '../ui/tokens';

interface BikeSegmentProps {
  bike: HubBike;
  actions: BikeActions;
  onChangePhoto: () => void;
  isUploadingPhoto: boolean;
}

interface ActionRow {
  id: string;
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  busy?: boolean;
}

function ActionListRow({ row, isLast }: { row: ActionRow; isLast: boolean }) {
  const Icon = row.icon;
  return (
    <Pressable
      testID={`bike-action-${row.id}`}
      onPress={row.onPress}
      disabled={row.busy}
      accessibilityRole="button"
      accessibilityLabel={row.label}
      accessibilityState={{ busy: !!row.busy, disabled: !!row.busy }}
      style={({ pressed }) => ({
        minHeight: HUB_HEIGHT.primary,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 8,
        paddingLeft: 14,
        paddingRight: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: hub.hairline,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: HUB_RADIUS.tile,
          borderCurve: 'continuous',
          backgroundColor: hub.raised,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {row.busy ? (
          <ActivityIndicator size="small" color={hub.dim} />
        ) : (
          <Icon size={18} color={hub.dim} strokeWidth={2} />
        )}
      </View>
      <Text style={{ flex: 1, fontFamily: HUB_FONT.sansSemiBold, fontSize: 15, color: hub.text }}>
        {row.label}
      </Text>
      <RowChevron />
    </Pressable>
  );
}

/**
 * Interim Bike segment (R1): today's `DocumentsSection` and details card,
 * unchanged, plus an action list so nothing reachable on the old screen is lost
 * now that its ⋯ menu, hero camera button and Service Report card are gone.
 * R5 replaces the list with the Bike / BikeDetails screens.
 */
export function BikeSegment({ bike, actions, onChangePhoto, isUploadingPhoto }: BikeSegmentProps) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();

  const rows: ActionRow[] = [
    {
      id: 'edit',
      icon: Pencil,
      label: t('garage.editBike', { defaultValue: 'Edit Motorcycle' }),
      onPress: actions.editBike,
    },
    {
      id: 'photo',
      icon: Camera,
      label: t('garage.changePhoto', { defaultValue: 'Change Photo' }),
      onPress: onChangePhoto,
      busy: isUploadingPhoto,
    },
    {
      id: 'recalls',
      icon: ShieldAlert,
      label: t('recalls.title', { defaultValue: 'Safety Recalls' }),
      onPress: actions.checkRecalls,
    },
    {
      id: 'import-schedule',
      icon: CalendarCog,
      label: t('oem.importButton', { defaultValue: 'Import OEM Schedule' }),
      onPress: actions.importSchedule,
      busy: actions.isImportingSchedule,
    },
    {
      id: 'service-report',
      icon: FileText,
      label: t('healthReport.title', { defaultValue: 'Service Report' }),
      onPress: actions.openServiceReport,
    },
  ];

  return (
    <View style={{ paddingTop: 16 }}>
      <DocumentsSection
        motorcycleId={bike.id}
        bikeName={bike.nickname ?? `${bike.make} ${bike.model}`}
      />
      <BikeDetailsCard bike={bike} delay={0} />

      {/* Same ground as the wrapped sections above (they follow the system
          scheme), so the tab reads as one surface. The eyebrow takes the legacy
          theme's muted ink to stay readable on a light ground. */}
      <View style={{ marginTop: 24, paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
        <SectionHeader label={t('bikeHub.bikeActions.title')} color={theme.ink3} />
        <HubCard style={{ overflow: 'hidden' }}>
          {rows.map((row, index) => (
            <ActionListRow key={row.id} row={row} isLast={index === rows.length - 1} />
          ))}
        </HubCard>

        {/* Destructive = red text only, last (DESIGN-SPEC §2 Buttons). */}
        <Pressable
          testID="bike-action-remove"
          onPress={actions.removeBike}
          accessibilityRole="button"
          style={({ pressed }) => ({
            minHeight: HUB_TOUCH_TARGET,
            marginTop: 8,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ fontFamily: HUB_FONT.sansSemiBold, fontSize: 14, color: hub.late }}>
            {t('garage.deleteBike', { defaultValue: 'Delete Motorcycle' })}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
