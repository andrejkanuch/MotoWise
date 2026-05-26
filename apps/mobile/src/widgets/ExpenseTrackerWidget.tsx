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
        containerBackground('#1c1814', 'widget'),
        padding({ all: 16 }),
        widgetURL(props.deepLink),
      ]}
    >
      {/* Eyebrow */}
      <Text modifiers={[font({ size: 9, weight: 'bold' }), foregroundStyle('#8e8880')]}>
        {props.monthLabel.toUpperCase()}
      </Text>

      {/* Currency + Total */}
      <HStack modifiers={[padding({ top: 2 })]}>
        <Text modifiers={[font({ size: 14, weight: 'medium' }), foregroundStyle('#c4bdb2')]}>
          {props.currencySymbol}
        </Text>
        <Text
          modifiers={[
            font({ size: 40, weight: 'regular', design: 'serif' }),
            foregroundStyle('#faf5ed'),
          ]}
        >
          {props.monthlyTotal}
        </Text>
      </HStack>

      {/* Delta */}
      {props.deltaLabel ? (
        <Text
          modifiers={[
            font({ size: 10.5, weight: 'semibold' }),
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
        <Text modifiers={[font({ size: 10.5, weight: 'medium' }), foregroundStyle('#c4bdb2')]}>
          {props.topCategory}
        </Text>
        <Spacer />
        <Text modifiers={[font({ size: 10.5, weight: 'semibold' }), foregroundStyle('#c4bdb2')]}>
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
