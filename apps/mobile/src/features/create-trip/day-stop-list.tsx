import { Calendar, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StopListItem } from '../../components/trip/stop-list-item';
import { useEditorialTheme } from '../../theme/editorial';
import type { RouteLeg } from '../../utils/mapbox-directions';
import { groupByPeriod, PERIOD_HINT } from '../../utils/period-of-day';
import {
  formatDayDate,
  formatSegmentDistance,
  formatSegmentDuration,
} from './format-trip-segments';
import type { LocalWaypoint } from './types';

interface DayStopListProps {
  numDays: number;
  startDate: Date;
  isShowcase: boolean;
  sortedWaypoints: LocalWaypoint[];
  waypointsByDay: Record<number, LocalWaypoint[]>;
  routeLegs: RouteLeg[];
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDelete: (id: string) => void;
  onPressStop: (wp: LocalWaypoint) => void;
  onMoveDay: (waypointId: string) => void;
  onAddDay: () => void;
}

export function DayStopList({
  numDays,
  startDate,
  isShowcase,
  sortedWaypoints,
  waypointsByDay,
  routeLegs,
  onMoveUp,
  onMoveDown,
  onDelete,
  onPressStop,
  onMoveDay,
  onAddDay,
}: DayStopListProps) {
  const { t } = useEditorialTheme();
  const { t: i18n } = useTranslation();
  const titleColor = t.ink;
  const subtitleColor = t.ink3;

  return (
    <>
      {sortedWaypoints.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          {Array.from({ length: numDays }, (_, dayIndex) => dayIndex).map((dayIndex) => {
            const dayWaypoints = waypointsByDay[dayIndex] ?? [];

            // Compute day stats from route legs for stops in this day
            let dayDistanceM = 0;
            let dayDurationS = 0;
            for (const wp of dayWaypoints) {
              const globalIdx = sortedWaypoints.indexOf(wp);
              if (globalIdx > 0 && routeLegs[globalIdx - 1]) {
                dayDistanceM += routeLegs[globalIdx - 1].distanceM;
                dayDurationS += routeLegs[globalIdx - 1].durationS;
              }
            }
            const dayHours = dayDurationS / 3600;
            const rideTimeColor = dayHours > 6 ? t.danger : dayHours > 4 ? t.warm : t.success;

            return (
              <View key={`day-${formatDayDate(startDate, dayIndex)}`}>
                {/* Day header */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: t.surface,
                    borderWidth: 1,
                    borderColor: t.line,
                    borderRadius: 12,
                    borderCurve: 'continuous',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    marginTop: dayIndex > 0 ? 16 : 0,
                    marginBottom: 8,
                    marginHorizontal: 20,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Calendar size={16} color={titleColor} />
                    <Text
                      style={{
                        fontFamily: 'InstrumentSerif-Regular',
                        fontSize: 17,
                        color: titleColor,
                      }}
                    >
                      {isShowcase
                        ? i18n('trips.dayHeaderShort', { day: dayIndex + 1 })
                        : i18n('trips.dayHeader', {
                            day: dayIndex + 1,
                            date: formatDayDate(startDate, dayIndex),
                          })}
                    </Text>
                  </View>
                  {dayWaypoints.length > 0 && dayDurationS > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: t.ink3 }}>
                        {formatSegmentDistance(dayDistanceM)}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: rideTimeColor }}>
                        {formatSegmentDuration(dayDurationS)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Day's stops — grouped by period-of-day when labelled. */}
                {dayWaypoints.length > 0 ? (
                  groupByPeriod(dayWaypoints).map((group) => (
                    <View key={`${dayIndex}-${group.period ?? 'unset'}`}>
                      {group.period && (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'baseline',
                            gap: 8,
                            marginHorizontal: 20,
                            marginTop: 4,
                            marginBottom: 4,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '700',
                              color: subtitleColor,
                              letterSpacing: 0.6,
                              textTransform: 'uppercase',
                            }}
                          >
                            {group.label}
                          </Text>
                          <Text style={{ fontSize: 11, color: subtitleColor, opacity: 0.7 }}>
                            {PERIOD_HINT[group.period]}
                          </Text>
                        </View>
                      )}
                      {group.items.map((wp) => {
                        const globalIdx = sortedWaypoints.indexOf(wp);
                        return (
                          <StopListItem
                            key={wp.id}
                            waypoint={wp}
                            index={globalIdx}
                            isFirst={globalIdx === 0}
                            isLast={globalIdx === sortedWaypoints.length - 1}
                            onMoveUp={() => onMoveUp(globalIdx)}
                            onMoveDown={() => onMoveDown(globalIdx)}
                            onDelete={() => onDelete(wp.id)}
                            onPress={() => onPressStop(wp)}
                            onMoveDay={() => onMoveDay(wp.id)}
                            distance={
                              globalIdx > 0 && routeLegs[globalIdx - 1]
                                ? formatSegmentDistance(routeLegs[globalIdx - 1].distanceM)
                                : undefined
                            }
                            duration={
                              globalIdx > 0 && routeLegs[globalIdx - 1]
                                ? formatSegmentDuration(routeLegs[globalIdx - 1].durationS)
                                : undefined
                            }
                          />
                        );
                      })}
                    </View>
                  ))
                ) : (
                  <Text
                    style={{
                      fontSize: 13,
                      color: subtitleColor,
                      textAlign: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                    }}
                  >
                    {i18n('trips.addStopHint')}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Add Day button */}
      {numDays < 14 && (
        <Pressable
          onPress={onAddDay}
          accessibilityLabel={i18n('trips.addDayA11y')}
          accessibilityRole="button"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginHorizontal: 20,
            marginTop: 12,
            marginBottom: 16,
            paddingVertical: 14,
            borderRadius: 12,
            borderCurve: 'continuous',
            borderWidth: 1.5,
            borderColor: t.warm,
          }}
        >
          <Plus size={18} color={t.warm} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: t.warm }}>
            {i18n('trips.addDay')}
          </Text>
        </Pressable>
      )}
    </>
  );
}
