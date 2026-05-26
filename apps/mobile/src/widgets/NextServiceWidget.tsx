import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
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
  bikeName: string;
  isOverdue: boolean;
  deepLink: string;
};

function NextServiceWidget(props: NextServiceWidgetProps, env: WidgetEnvironment) {
  'widget';

  const isLockScreen = env.widgetFamily === 'accessoryRectangular';
  const accent = props.isOverdue ? '#d44a4a' : '#D4622E';

  if (isLockScreen) {
    return (
      <HStack modifiers={[padding({ horizontal: 8, vertical: 6 })]}>
        <Text
          modifiers={[
            font({ size: 12, weight: 'semibold' }),
            foregroundStyle('rgba(255,255,255,0.85)'),
          ]}
        >
          {props.hasData ? `${props.taskTitle} · ${props.dueLabel}` : 'No upcoming service'}
        </Text>
      </HStack>
    );
  }

  if (!props.hasData) {
    return (
      <VStack
        modifiers={[
          frame({ maxWidth: 99999, maxHeight: 99999 }),
          containerBackground('#1c1814', 'widget'),
          padding({ all: 16 }),
        ]}
      >
        <Spacer />
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle('#faf5ed')]}>
          No upcoming service
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle('#8e8880')]}>Open MotoVault</Text>
        <Spacer />
      </VStack>
    );
  }

  return (
    <VStack
      modifiers={[
        frame({ maxWidth: 99999, maxHeight: 99999, alignment: 'leading' }),
        containerBackground('#1c1814', 'widget'),
        padding({ all: 16 }),
        widgetURL(props.deepLink),
      ]}
    >
      {/* Eyebrow */}
      <Text modifiers={[font({ size: 9, weight: 'bold' }), foregroundStyle(accent)]}>
        {props.isOverdue ? 'OVERDUE' : 'DUE IN'}
      </Text>

      {/* Big number + unit */}
      <HStack modifiers={[padding({ top: 2 })]}>
        <Text
          modifiers={[
            font({ size: 44, weight: 'regular', design: 'serif' }),
            foregroundStyle('#faf5ed'),
          ]}
        >
          {props.daysCount}
        </Text>
        <Text
          modifiers={[
            font({ size: 12, weight: 'medium' }),
            foregroundStyle('#c4bdb2'),
            padding({ bottom: 6 }),
          ]}
        >
          {' days'}
        </Text>
      </HStack>

      <Spacer />

      {/* Task name */}
      <Text modifiers={[font({ size: 12.5, weight: 'semibold' }), foregroundStyle('#faf5ed')]}>
        {props.taskTitle}
      </Text>
      <Text modifiers={[font({ size: 10.5 }), foregroundStyle('#8e8880')]}>{props.bikeName}</Text>
    </VStack>
  );
}

export default createWidget<NextServiceWidgetProps>('NextServiceWidget', NextServiceWidget);
