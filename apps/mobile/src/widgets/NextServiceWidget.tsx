import { Capsule, HStack, Image, RoundedRectangle, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

type NextServiceWidgetProps = {
  hasData: boolean;
  taskTitle: string;
  dueLabel: string;
  daysCount: string;
  bikeMileage: string;
  isOverdue: boolean;
  deepLink: string;
};

function NextServiceWidget(props: NextServiceWidgetProps, env: WidgetEnvironment) {
  'widget';

  const isLockScreen = env.widgetFamily === 'accessoryRectangular';

  if (isLockScreen) {
    return (
      <HStack modifiers={[padding({ horizontal: 8, vertical: 6 })]}>
        <Text
          modifiers={[
            font({ size: 12, weight: 'semibold' }),
            foregroundStyle('rgba(255,255,255,0.85)'),
          ]}
        >
          {props?.hasData ? `${props.taskTitle} · ${props.dueLabel}` : 'No upcoming service'}
        </Text>
      </HStack>
    );
  }

  if (!props || !props.hasData) {
    return (
      <VStack
        modifiers={[
          frame({ maxWidth: 99999, maxHeight: 99999 }),
          containerBackground('#faf5ed', 'widget'),
          padding({ all: 14 }),
        ]}
      >
        <Spacer />
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle('#2c2824')]}>
          No upcoming service
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle('#8e8880')]}>Open MotoVault</Text>
        <Spacer />
      </VStack>
    );
  }

  const statusColor = props.isOverdue ? '#C0392B' : '#D4622E';
  const statusLabel = props.isOverdue ? 'OVERDUE' : 'DUE IN';

  return (
    <VStack
      modifiers={[
        frame({ maxWidth: 99999, maxHeight: 99999, alignment: 'leading' }),
        containerBackground('#faf5ed', 'widget'),
        padding({ all: 14 }),
        widgetURL(props.deepLink),
      ]}
    >
      {/* Status + icon row */}
      <HStack>
        <Image systemName="wrench.fill" size={11} color={statusColor} />
        <Text
          modifiers={[
            font({ size: 10, weight: 'bold' }),
            foregroundStyle(statusColor),
            padding({ leading: 3 }),
          ]}
        >
          {statusLabel}
        </Text>
        <Spacer />
        <RoundedRectangle
          cornerRadius={4}
          modifiers={[frame({ width: 18, height: 18 }), foregroundStyle('#D4622E')]}
        />
      </HStack>

      {/* Days count */}
      <HStack modifiers={[padding({ top: 4 })]}>
        <Text
          modifiers={[
            font({ size: 36, weight: 'regular', design: 'serif' }),
            foregroundStyle('#2c2824'),
          ]}
        >
          {props.daysCount}
        </Text>
        <Text
          modifiers={[
            font({ size: 12, weight: 'medium' }),
            foregroundStyle('#8e8880'),
            padding({ bottom: 6 }),
          ]}
        >
          {' days'}
        </Text>
      </HStack>

      {/* Progress bar */}
      <Capsule
        modifiers={[
          frame({ width: props.isOverdue ? 60 : 30, height: 3 }),
          foregroundStyle(statusColor),
          padding({ top: 4 }),
        ]}
      />

      <Spacer />

      {/* Task name */}
      <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle('#2c2824')]}>
        {props.taskTitle}
      </Text>

      {/* Mileage */}
      {props.bikeMileage ? (
        <Text modifiers={[font({ size: 11 }), foregroundStyle('#8e8880'), padding({ top: 1 })]}>
          {props.bikeMileage}
        </Text>
      ) : null}
    </VStack>
  );
}

export default createWidget<NextServiceWidgetProps>('NextServiceWidget', NextServiceWidget);
