import { HStack, RoundedRectangle, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

type ExpenseTrackerWidgetProps = {
  hasData: boolean;
  monthlyTotal: string;
  currencySymbol: string;
  monthLabel: string;
  topCategory: string;
  topCategoryAmount: string;
  deltaLabel: string;
  deltaPositive: boolean;
  deepLink: string;
};

function ExpenseTrackerWidget(props: ExpenseTrackerWidgetProps, _env: WidgetEnvironment) {
  'widget';

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
          Track expenses
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
        containerBackground('#faf5ed', 'widget'),
        padding({ all: 14 }),
        widgetURL(props.deepLink),
      ]}
    >
      {/* Header */}
      <HStack>
        <Text modifiers={[font({ size: 9, weight: 'bold' }), foregroundStyle('#8e8880')]}>
          THIS MONTH
        </Text>
        <Spacer />
        <RoundedRectangle
          cornerRadius={4}
          modifiers={[frame({ width: 18, height: 18 }), foregroundStyle('#D4622E')]}
        />
      </HStack>

      {/* Currency + Total */}
      <HStack modifiers={[padding({ top: 4 })]}>
        <Text
          modifiers={[
            font({ size: 16, weight: 'medium' }),
            foregroundStyle('#8e8880'),
            padding({ bottom: 4 }),
          ]}
        >
          {props.currencySymbol}
        </Text>
        <Text
          modifiers={[
            font({ size: 36, weight: 'regular', design: 'serif' }),
            foregroundStyle('#2c2824'),
          ]}
        >
          {props.monthlyTotal}
        </Text>
      </HStack>

      {/* Delta vs avg */}
      {props.deltaLabel ? (
        <Text
          modifiers={[
            font({ size: 11, weight: 'semibold' }),
            foregroundStyle(props.deltaPositive ? '#4eba6f' : '#D4622E'),
            padding({ top: 2 }),
          ]}
        >
          {props.deltaLabel}
        </Text>
      ) : null}

      <Spacer />

      {/* Top category */}
      <HStack>
        <Text modifiers={[font({ size: 10.5, weight: 'medium' }), foregroundStyle('#8e8880')]}>
          {'Top: '}
        </Text>
        <Text modifiers={[font({ size: 10.5, weight: 'medium' }), foregroundStyle('#2c2824')]}>
          {props.topCategory}
        </Text>
        <Spacer />
        <Text modifiers={[font({ size: 10.5, weight: 'semibold' }), foregroundStyle('#2c2824')]}>
          {props.topCategoryAmount}
        </Text>
      </HStack>
    </VStack>
  );
}

export default createWidget<ExpenseTrackerWidgetProps>(
  'ExpenseTrackerWidget',
  ExpenseTrackerWidget,
);
